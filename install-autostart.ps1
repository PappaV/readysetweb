# Registers the autopilot to start automatically when you log into Windows.
# Run once as Administrator.

$taskName = "SiteCraftAutopilot"
$launcher = "C:\Users\User\demo-site-generator\start-all.ps1"

$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$launcher`"" -WorkingDirectory "C:\Users\User\demo-site-generator"
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 5 -RestartInterval (New-TimeSpan -Minutes 2) -ExecutionTimeLimit ([TimeSpan]::Zero)

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -RunLevel Highest -Force | Out-Null

Write-Host "Autopilot registered to start at every Windows logon (task: $taskName)"
Write-Host ""
Write-Host "To control it:"
Write-Host "  Start now:     Start-ScheduledTask -TaskName $taskName"
Write-Host "  Stop now:      Stop-ScheduledTask -TaskName $taskName"
