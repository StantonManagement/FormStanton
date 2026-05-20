# Computes the set of unit_bedroom_map rows that are missing relative to the AppFolio CSV.
# Outputs:
#   - exports/missing-units-preview.csv   : rows that would be inserted
#   - exports/insert-missing-units.sql    : SQL to insert them

$csvPath = 'C:/Users/Alex/Desktop/MouseWithoutBorders/unit_directory-20260518.csv'

# asset_id -> canonical properties.address (from public.properties)
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

# Existing unit_bedroom_map.building_address values that don't match canonical;
# map them to the canonical asset_id so we can de-dup against canonical addresses.
$aliasToAssetId = @{
  '90-100 Park St'      = 'S0001'  # canonical: 90 Park Street
  '1721-1739 Main St'   = 'S0016'  # canonical: 1721 - 1739 Main St
  '57-59 Park St'       = 'S0023'  # canonical: 57 Park St
  '182-184 Affleck St'  = 'S0028'  # canonical: 182 Affleck St
  '190-192 Affleck St'  = 'S0029'  # canonical: 190 Affleck St
}

# Build reverse: canonical address -> asset_id
$addrToAssetId = @{}
foreach ($k in $canonical.Keys) { $addrToAssetId[$canonical[$k]] = $k }
foreach ($k in $aliasToAssetId.Keys) { $addrToAssetId[$k] = $aliasToAssetId[$k] }

# Pull existing rows live from Supabase via psql? No — use the cached data we already fetched.
# Instead, we re-pull via the supabase REST endpoint isn't trivial here, so we re-use the
# data we already got and store it inline. To keep this script accurate, the caller should
# pass the latest existing rows file. For now we read the raw query output we cached.
$existingFile = 'C:/Users/Alex/AppData/Local/Temp/windsurf/mcp_output_bcccb145809c93ac.txt'
$rawExisting = Get-Content -Raw $existingFile
$outerExisting = $rawExisting | ConvertFrom-Json
$txt = $outerExisting.result
$s = $txt.IndexOf('[{'); $e = $txt.LastIndexOf('}]') + 2
$existing = ($txt.Substring($s, $e - $s) | ConvertFrom-Json)

# Build set of existing (asset_id|unit_number) keys
$existingKeys = New-Object System.Collections.Generic.HashSet[string]
foreach ($r in $existing) {
  $aid = $addrToAssetId[$r.building_address]
  if (-not $aid) { continue }
  [void]$existingKeys.Add("$aid|$($r.unit_number)")
}

# Parse the CSV
$csv = Import-Csv -Path $csvPath

$missing = @()
$skipped = @()
foreach ($row in $csv) {
  $propName = $row.'Property Name'
  if ([string]::IsNullOrWhiteSpace($propName)) { continue }
  if ($propName -notmatch '^(S\d{4})') { $skipped += $propName; continue }
  $aid = $matches[1]
  if (-not $canonical.ContainsKey($aid)) { $skipped += $propName; continue }
  $unit = $row.'Unit Name'
  if ([string]::IsNullOrWhiteSpace($unit)) { continue }

  $bedRaw = $row.'Bedrooms'
  $bed = 0
  if ($bedRaw -ne $null -and $bedRaw -ne '') {
    [int]::TryParse($bedRaw, [ref]$bed) | Out-Null
  }

  $key = "$aid|$unit"
  if ($existingKeys.Contains($key)) { continue }

  $missing += [PSCustomObject]@{
    asset_id         = $aid
    canonical_address = $canonical[$aid]
    unit_number      = $unit
    bedroom_count    = $bed
  }
}

New-Item -ItemType Directory -Force -Path 'exports' | Out-Null
$missing | Export-Csv -NoTypeInformation -Encoding UTF8 -Path 'exports/missing-units-preview.csv'

# Build SQL
$sb = [System.Text.StringBuilder]::new()
[void]$sb.AppendLine('-- Insert units from AppFolio unit_directory-20260518.csv that are missing from public.unit_bedroom_map.')
[void]$sb.AppendLine('-- Building address uses canonical properties.address for the matching asset_id.')
[void]$sb.AppendLine('BEGIN;')
[void]$sb.AppendLine('INSERT INTO public.unit_bedroom_map (building_address, unit_number, bedroom_count) VALUES')
$lines = @()
foreach ($m in $missing) {
  $a = $m.canonical_address.Replace("'", "''")
  $u = $m.unit_number.Replace("'", "''")
  $lines += "  ('$a', '$u', $($m.bedroom_count))"
}
[void]$sb.AppendLine(($lines -join ",`r`n") + ';')
[void]$sb.AppendLine('COMMIT;')
Set-Content -Path 'exports/insert-missing-units.sql' -Value $sb.ToString() -Encoding UTF8

Write-Host "Existing rows: $($existing.Count)"
Write-Host "CSV rows total: $($csv.Count)"
Write-Host "Missing units (would be inserted): $($missing.Count)"
Write-Host "Skipped CSV rows (non-property, e.g. totals/portfolio): $(($skipped | Select-Object -Unique).Count)"
Write-Host ""
Write-Host "Per-property breakdown of missing units:"
$missing | Group-Object asset_id | Sort-Object Name | ForEach-Object {
  $addr = $canonical[$_.Name]
  Write-Host ("  {0}  {1,-22}  +{2} units" -f $_.Name, $addr, $_.Count)
}
