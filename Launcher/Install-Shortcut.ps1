# Creates (or updates) the "Predictix" shortcut on the desktop. Run again if the project folder moves.
$launcher = Join-Path $PSScriptRoot "Predictix.vbs"
$icon = Join-Path $PSScriptRoot "predictix.ico"
$desktop = [Environment]::GetFolderPath("Desktop")
$path = Join-Path $desktop "Predictix.lnk"

$shell = New-Object -ComObject WScript.Shell
$link = $shell.CreateShortcut($path)
$link.TargetPath = Join-Path $env:SystemRoot "System32\wscript.exe"
$link.Arguments = "`"$launcher`""
$link.WorkingDirectory = $PSScriptRoot
$link.IconLocation = "$icon,0"
$link.Description = "Start Predictix and open it"
$link.Save()
Write-Output "Shortcut created: $path"
