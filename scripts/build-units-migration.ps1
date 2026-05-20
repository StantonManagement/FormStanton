# Builds a single SQL migration that:
#   1. DELETEs the known-bad 178 Affleck "4S" row (if present)
#   2. INSERTs the 45 missing units (using canonical properties.address)
#   3. UPDATEs bedroom_count on existing rows where it differs from the AppFolio CSV
#
# Address aliasing is preserved (no normalization) - per user, the short-name vs range-address
# split is intentional for Hartford properties.

$csvPath = 'C:/Users/Alex/Desktop/MouseWithoutBorders/unit_directory-20260518.csv'

$canonical = @{
  'S0001'='90 Park Street'; 'S0002'='97-103 Maple Ave'; 'S0003'='222-224 Maple Ave';
  'S0004'='43-45 Franklin Ave'; 'S0005'='47 Franklin Ave'; 'S0006'='15-17 Whitmore Street';
  'S0007'='36 Whitmore Street'; 'S0008'='38-40 Whitmore Street'; 'S0009'='236 Maple Ave';
  'S0010'='228 Maple Ave'; 'S0011'='110 Martin St'; 'S0012'='120 Martin St';
  'S0013'='152-154 Wooster St'; 'S0014'='160 Wooster St'; 'S0015'='165 Westland St';
  'S0016'='1721 - 1739 Main St'; 'S0017'='69-73 Chestnut St'; 'S0018'='91 Edwards St';
  'S0019'='93-95 Maple Ave'; 'S0020'='31-33 Park St'; 'S0021'='67-73 Park St';
  'S0022'='83-91 Park St'; 'S0023'='57 Park St'; 'S0024'='10 Wolcott St';
  'S0025'='179 Affleck St'; 'S0026'='144-146 Affleck St'; 'S0027'='178 Affleck St';
  'S0028'='182 Affleck St'; 'S0029'='190 Affleck St'; 'S0030'='195 Affleck St';
  'S0031'='88-90 Ward St'; 'S0032'='865 Broad St'; 'S0033'='142 Seymour St';
  'S0034'='158 Seymour St'; 'S0035'='164 Seymour St'; 'S0036'='167 Seymour St';
  'S0037'='169 Seymour St'; 'S0038'='170 Seymour St'; 'S0039'='180 Seymour St';
  'S0040'='213-217 Buckingham St'; 'S0041'='23-31 Squire St';
}
$aliasToAssetId = @{
  '90-100 Park St'      = 'S0001'
  '1721-1739 Main St'   = 'S0016'
  '57-59 Park St'       = 'S0023'
  '182-184 Affleck St'  = 'S0028'
  '190-192 Affleck St'  = 'S0029'
  '228-230 Maple Ave'   = 'S0010'
}
$addrToAssetId = @{}
foreach ($k in $canonical.Keys)      { $addrToAssetId[$canonical[$k]]      = $k }
foreach ($k in $aliasToAssetId.Keys) { $addrToAssetId[$k]                  = $aliasToAssetId[$k] }

# Existing rows pulled earlier
$existingFile = 'C:/Users/Alex/AppData/Local/Temp/windsurf/mcp_output_bcccb145809c93ac.txt'
$rawExisting = Get-Content -Raw $existingFile
$txt = ($rawExisting | ConvertFrom-Json).result
$s = $txt.IndexOf('[{'); $e = $txt.LastIndexOf('}]') + 2
$existing = ($txt.Substring($s, $e - $s) | ConvertFrom-Json)

# Build CSV lookup: asset_id|unit_number -> bedroom_count
$csv = Import-Csv -Path $csvPath
$csvMap = @{}
foreach ($row in $csv) {
  $propName = $row.'Property Name'
  if ([string]::IsNullOrWhiteSpace($propName) -or $propName -notmatch '^(S\d{4})') { continue }
  $aid = $matches[1]
  if (-not $canonical.ContainsKey($aid)) { continue }
  $unit = $row.'Unit Name'
  if ([string]::IsNullOrWhiteSpace($unit)) { continue }
  $bed = 0
  if ($row.'Bedrooms' -ne $null -and $row.'Bedrooms' -ne '') {
    [int]::TryParse($row.'Bedrooms', [ref]$bed) | Out-Null
  }
  $csvMap["$aid|$unit"] = $bed
}

# Existing key set for INSERT de-dup
$existingKeys = New-Object System.Collections.Generic.HashSet[string]
foreach ($r in $existing) {
  $aid = $addrToAssetId[$r.building_address]
  if ($aid) { [void]$existingKeys.Add("$aid|$($r.unit_number)") }
}

# 1) Missing inserts
$missing = @()
foreach ($k in $csvMap.Keys) {
  if ($existingKeys.Contains($k)) { continue }
  $parts = $k.Split('|', 2)
  $missing += [PSCustomObject]@{ asset_id=$parts[0]; unit_number=$parts[1]; bedroom_count=$csvMap[$k] }
}

# 2) Updates (existing rows whose bedroom_count differs from CSV)
$updates = @()
$noMatch = @()
foreach ($r in $existing) {
  $aid = $addrToAssetId[$r.building_address]
  if (-not $aid) { $noMatch += $r; continue }
  $key = "$aid|$($r.unit_number)"
  if (-not $csvMap.ContainsKey($key)) { $noMatch += $r; continue }
  $newBed = $csvMap[$key]
  if ($newBed -ne $r.bedroom_count) {
    $updates += [PSCustomObject]@{
      building_address = $r.building_address
      unit_number      = $r.unit_number
      old              = $r.bedroom_count
      new              = $newBed
    }
  }
}

# Build SQL
$sb = [System.Text.StringBuilder]::new()
[void]$sb.AppendLine('-- Sync public.unit_bedroom_map with AppFolio unit_directory-20260518.csv')
[void]$sb.AppendLine('-- 1) Remove known bad row (178 Affleck "4S" never existed)')
[void]$sb.AppendLine('-- 2) Insert missing units (canonical properties.address)')
[void]$sb.AppendLine('-- 3) Update bedroom_count on existing rows to match AppFolio')
[void]$sb.AppendLine('BEGIN;')
[void]$sb.AppendLine('')
[void]$sb.AppendLine("DELETE FROM public.unit_bedroom_map WHERE building_address = '178 Affleck St' AND unit_number = '4S';")
[void]$sb.AppendLine('')

if ($missing.Count -gt 0) {
  [void]$sb.AppendLine('INSERT INTO public.unit_bedroom_map (building_address, unit_number, bedroom_count) VALUES')
  $rows = @()
  foreach ($m in $missing | Sort-Object asset_id, unit_number) {
    $a = $canonical[$m.asset_id].Replace("'", "''")
    $u = $m.unit_number.Replace("'", "''")
    $rows += "  ('$a', '$u', $($m.bedroom_count))"
  }
  [void]$sb.AppendLine(($rows -join ",`r`n") + ';')
  [void]$sb.AppendLine('')
}

foreach ($u in $updates | Sort-Object building_address, unit_number) {
  $a = $u.building_address.Replace("'", "''")
  $n = $u.unit_number.Replace("'", "''")
  [void]$sb.AppendLine("UPDATE public.unit_bedroom_map SET bedroom_count = $($u.new) WHERE building_address = '$a' AND unit_number = '$n'; -- was $($u.old)")
}

[void]$sb.AppendLine('')
[void]$sb.AppendLine('COMMIT;')

New-Item -ItemType Directory -Force -Path 'exports' | Out-Null
Set-Content -Path 'exports/sync-unit-bedroom-map.sql' -Value $sb.ToString() -Encoding UTF8

Write-Host "Inserts:           $($missing.Count)"
Write-Host "Updates:           $($updates.Count)"
Write-Host "Existing rows w/ no CSV match: $($noMatch.Count)"
if ($noMatch.Count -gt 0) {
  Write-Host "  Unmatched rows:"
  $noMatch | ForEach-Object { Write-Host "    $($_.building_address) | $($_.unit_number)" }
}
Write-Host ""
Write-Host "Update bedroom_count distribution (new value):"
$updates | Group-Object new | Sort-Object Name | ForEach-Object {
  Write-Host ("  bedroom_count={0}: {1} rows" -f $_.Name, $_.Count)
}
