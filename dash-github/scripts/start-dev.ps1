# ============================================================
# ZAMANI BURGER — Start backend and frontend in two PowerShell windows
# Run from the project root:
#   powershell -ExecutionPolicy Bypass -File .\scripts\start-dev.ps1
# ============================================================
$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $projectRoot 'backend'
$frontend = Join-Path $projectRoot 'frontend'
$envFile = Join-Path $backend '.env'
$envExample = Join-Path $backend '.env.example'

if (-not (Test-Path -LiteralPath $envFile)) {
    Copy-Item -LiteralPath $envExample -Destination $envFile
    Write-Host 'Created backend\.env from .env.example. Review the secret and admin password.' -ForegroundColor Yellow
}

$venvPython = Join-Path $backend 'venv\Scripts\python.exe'
$python = if (Test-Path -LiteralPath $venvPython) { $venvPython } else { 'python' }

if (-not (Test-Path -LiteralPath (Join-Path $frontend 'node_modules'))) {
    throw 'frontend/node_modules is missing. Run "npm install" in the frontend folder first.'
}

if (-not (Test-Path -LiteralPath (Join-Path $backend 'db.sqlite3'))) {
    Write-Host 'Database not found. Run "python manage.py migrate" and "python manage.py seed_demo" first.' -ForegroundColor Yellow
}

Write-Host 'Starting Django API on http://127.0.0.1:8000 ...' -ForegroundColor Cyan
Start-Process -FilePath 'powershell.exe' -ArgumentList @(
    '-NoExit',
    '-Command',
    "Set-Location '$backend'; & '$python' manage.py runserver 127.0.0.1:8000"
)

Write-Host 'Starting Vite dev server on http://127.0.0.1:5173 ...' -ForegroundColor Cyan
Start-Process -FilePath 'powershell.exe' -ArgumentList @(
    '-NoExit',
    '-Command',
    "Set-Location '$frontend'; npm run dev"
)

Write-Host ''
Write-Host 'ZAMANI BURGER is starting:' -ForegroundColor Green
Write-Host '  App:   http://127.0.0.1:5173'
Write-Host '  API:   http://127.0.0.1:8000/api/'
Write-Host '  Admin: http://127.0.0.1:8000/admin/'
Write-Host 'Close the two PowerShell windows to stop the servers.'
