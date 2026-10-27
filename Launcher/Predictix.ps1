# Predictix launcher (started by Predictix.vbs from the desktop shortcut, with no console window).
#  1. Starts the backend (port 8080) and the website (port 5173) in the background, unless they are
#     already running (for example from a VS Code terminal - then they are left alone).
#  2. Opens the site in its own browser window (Edge, or Chrome if Edge is missing).
#  3. When that window is closed, stops the servers it started.
# Server output goes to %LOCALAPPDATA%\Predictix\server.log

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $root "Backend"
$frontendDir = Join-Path $root "Frontend"
$dataDir = Join-Path $env:LOCALAPPDATA "Predictix"
$logFile = Join-Path $dataDir "server.log"
$profileDir = Join-Path $dataDir "browser-profile"  # own browser profile = its own window we can watch
New-Item -ItemType Directory -Force $dataDir | Out-Null

function Test-Port([int]$port) {
    [bool](Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
}

function Start-Hidden([string]$dir, [string]$script, [string]$name) {
    Add-Content $logFile "`r`n===== $name started $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') =====" -Encoding utf8
    Start-Process cmd.exe -ArgumentList "/d /c npm run $script >> `"$logFile`" 2>&1" `
        -WorkingDirectory $dir -WindowStyle Hidden -PassThru
}

function Stop-Tree($proc) {
    if ($proc -and -not $proc.HasExited) { & taskkill.exe /PID $proc.Id /T /F *> $null }
}

# Node processes still listening on a port we started (in case one escaped the process tree)
function Stop-PortOwner([int]$port) {
    Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
        $p = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue
        if ($p -and $p.ProcessName -eq "node") { Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue }
    }
}

function Get-AppWindowProcesses {
    Get-CimInstance Win32_Process -Filter "Name='msedge.exe' OR Name='chrome.exe'" |
        Where-Object { $_.CommandLine -and $_.CommandLine.Contains($profileDir) }
}

$browser = @(
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

$splash = ([Uri](Join-Path $PSScriptRoot "starting.html")).AbsoluteUri + "?log=" + [Uri]::EscapeDataString($logFile)

# Only one launcher manages the servers; a second click just opens/focuses the window
$mutex = New-Object System.Threading.Mutex($false, "Local\PredictixLauncher")
$owner = $mutex.WaitOne(0)

$backend = $null
$frontend = $null
try {
    if ($owner) {
        if (-not (Test-Port 8080)) { $backend = Start-Hidden $backendDir "server" "backend" }
        if (-not (Test-Port 5173)) { $frontend = Start-Hidden $frontendDir "dev" "website" }
    }

    if (-not $browser) {
        # No Edge/Chrome: open the default browser; its window cannot be watched, so servers keep running
        Start-Process "http://localhost:5173/"
        return
    }

    $browserArgs = @(
        "--app=$splash",
        "--user-data-dir=`"$profileDir`"",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-background-mode",
        "--window-size=1300,880"
    )
    Start-Process $browser -ArgumentList $browserArgs | Out-Null
    if (-not $owner) { return }

    # Wait for the window to appear, then until every process of this browser profile has exited
    $deadline = (Get-Date).AddSeconds(30)
    while (-not (Get-AppWindowProcesses) -and (Get-Date) -lt $deadline) { Start-Sleep -Milliseconds 500 }
    while (Get-AppWindowProcesses) { Start-Sleep -Seconds 2 }
}
finally {
    if ($owner) {
        Stop-Tree $backend
        Stop-Tree $frontend
        Start-Sleep -Milliseconds 500
        if ($backend) { Stop-PortOwner 8080 }
        if ($frontend) { Stop-PortOwner 5173 }
        if ($backend -or $frontend) {
            Add-Content $logFile "===== stopped $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') =====" -Encoding utf8
        }
        $mutex.ReleaseMutex()
    }
    $mutex.Dispose()
}
