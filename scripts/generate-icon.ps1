$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$iconDir = Join-Path $PSScriptRoot "..\src-tauri\icons"
New-Item -ItemType Directory -Force -Path $iconDir | Out-Null

$size = 256
$bmp = New-Object System.Drawing.Bitmap $size, $size
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.Clear([System.Drawing.Color]::FromArgb(255, 45, 45, 58))

$gray = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 170, 170, 185))
$g.FillEllipse($gray, 48, 70, 160, 120)
$g.FillEllipse($gray, 70, 40, 120, 100)
$g.FillEllipse((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 50, 50, 65))), 105, 95, 12, 14)
$g.FillEllipse((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 50, 50, 65))), 135, 95, 12, 14)
$gray.Dispose()
$g.Dispose()

$src = Join-Path $iconDir "source.png"
$bmp.Save($src, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Host "Icon source: $src"
