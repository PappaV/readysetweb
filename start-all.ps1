# SiteCraft Autopilot - 24/7 launcher (PowerShell)
# Starts: dashboard, generator API, autopilot. Run on login.
$ErrorActionPreference = "Continue"
Set-Location "C:\Users\User\demo-site-generator"

Write-Host "Starting SiteCraft Autopilot (24/7)..."

# Load .env
$envFile = "C:\Users\User\demo-site-generator\apps\generator-api\.env"
Get-Content $envFile | ForEach-Object {
  if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
    $name = $Matches[1].Trim()
    $value = $Matches[2].Trim()
    [Environment]::SetEnvironmentVariable($name, $value, "Process")
  }
}

# Start Dashboard on 3001
Start-Process -FilePath "powershell" -ArgumentList "-NoProfile","-Command","Set-Location 'C:\Users\User\demo-site-generator'; pnpm --filter dashboard start" -WindowStyle Minimized

# Start API on 3000
Start-Process -FilePath "powershell" -ArgumentList "-NoProfile","-Command","Set-Location 'C:\Users\User\demo-site-generator'; pnpm --filter generator-api dev" -WindowStyle Minimized

# Start Autopilot (discovery loop)
Start-Process -FilePath "powershell" -ArgumentList "-NoProfile","-Command","Set-Location 'C:\Users\User\demo-site-generator'; pnpm --filter autopilot-runner start" -WindowStyle Minimized

Write-Host "All services started."
Write-Host "  Dashboard: http://localhost:3001"
Write-Host "  API:       http://localhost:3000"
