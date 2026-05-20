$raw = Get-Content -Raw 'C:/Users/Alex/AppData/Local/Temp/windsurf/mcp_output_2a608adabf74f8e2.txt'
$outer = $raw | ConvertFrom-Json
$text = $outer.result

# Find the JSON array (starts with [ and ends with ] before the closing tag)
$arrStart = $text.IndexOf('[{')
$arrEnd = $text.LastIndexOf('}]') + 2
$json = $text.Substring($arrStart, $arrEnd - $arrStart)

$rows = $json | ConvertFrom-Json
New-Item -ItemType Directory -Force -Path 'exports' | Out-Null
$rows |
  Select-Object asset_id, llc_name, portfolio, address, year_built, units_count, unit_number, bedroom_count |
  Export-Csv -NoTypeInformation -Encoding UTF8 -Path 'exports/buildings_units.csv'

Write-Host "Rows written: $($rows.Count)"
$addresses = $rows | Select-Object -ExpandProperty address -Unique
Write-Host "Distinct addresses: $($addresses.Count)"
$orphan = $rows | Where-Object { $_.asset_id -eq $null }
Write-Host "Orphan unit rows (no matching property): $($orphan.Count)"
$orphanAddrs = $orphan | Select-Object -ExpandProperty address -Unique
if ($orphanAddrs) { Write-Host "Orphan addresses: $($orphanAddrs -join ', ')" }
$noUnits = $rows | Where-Object { $_.unit_number -eq $null -and $_.asset_id -ne $null }
Write-Host "Buildings with zero mapped units: $($noUnits.Count)"
if ($noUnits) { Write-Host "  $(($noUnits | ForEach-Object { $_.address }) -join ', ')" }
