# Stops Desktop Cat dev/install instances and clears the single-instance lock.
Get-Process -Name "desktop-cat" -ErrorAction SilentlyContinue | Stop-Process -Force
Remove-Item "$env:TEMP\com.minna.desktop-cat.lock" -Force -ErrorAction SilentlyContinue
Write-Host "Desktop Cat stopped (process + lock file cleared)."
