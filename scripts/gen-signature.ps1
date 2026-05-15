Add-Type -AssemblyName System.Drawing

$width = 300
$height = 80
$bmp = New-Object System.Drawing.Bitmap($width, $height)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.Clear([System.Drawing.Color]::Transparent)

$font = New-Object System.Drawing.Font("Segoe Script", 16, [System.Drawing.FontStyle]::Regular)
$brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::Black)
$g.DrawString("Maria Garcia-Rodriguez", $font, $brush, 4, 20)
$g.Dispose()

$outPath = Join-Path (Get-Location) "docs\templates\sample-signature.png"
$bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()

Write-Host "Saved signature PNG to $outPath"
