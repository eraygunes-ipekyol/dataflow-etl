# EROS ETL - Initial Deploy
$ErrorActionPreference = 'Continue'

$SRC = 'C:\Users\eray.gunes\Documents\claude-code\.claude\worktrees\great-sutherland'
$DEPLOY = 'C:\inetpub\wwwroot\ErosETL'

Write-Host '=== EROS ETL Initial Deploy ===' -ForegroundColor Cyan

# 1. Frontend kopyala
Write-Host '[1] Frontend kopyalaniyor...' -ForegroundColor Yellow
$frontendDir = Join-Path $DEPLOY 'frontend'
if (-not (Test-Path $frontendDir)) { New-Item -ItemType Directory -Path $frontendDir -Force | Out-Null }
Copy-Item (Join-Path $SRC 'frontend\dist\*') $frontendDir -Recurse -Force
Write-Host '  OK' -ForegroundColor Green

# 2. Backend kopyala
Write-Host '[2] Backend kopyalaniyor...' -ForegroundColor Yellow
$backendDir = Join-Path $DEPLOY 'backend'
if (-not (Test-Path $backendDir)) { New-Item -ItemType Directory -Path $backendDir -Force | Out-Null }
$appDir = Join-Path $backendDir 'app'
if (Test-Path $appDir) { Remove-Item $appDir -Recurse -Force }
Copy-Item (Join-Path $SRC 'backend\app') $appDir -Recurse -Force
Copy-Item (Join-Path $SRC 'backend\main.py') (Join-Path $backendDir 'main.py') -Force
Copy-Item (Join-Path $SRC 'backend\requirements.txt') (Join-Path $backendDir 'requirements.txt') -Force
# pycache temizle
Get-ChildItem $appDir -Recurse -Directory -Filter '__pycache__' -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force
Write-Host '  OK' -ForegroundColor Green

# 3. db klasoru
Write-Host '[3] DB klasoru kontrol...' -ForegroundColor Yellow
$dbDir = Join-Path $backendDir 'db'
if (-not (Test-Path $dbDir)) {
    New-Item -ItemType Directory -Path $dbDir -Force | Out-Null
    Write-Host '  db/ olusturuldu' -ForegroundColor DarkYellow
} else {
    Write-Host '  db/ zaten mevcut' -ForegroundColor DarkGray
}

# 4. .env
Write-Host '[4] .env kontrol...' -ForegroundColor Yellow
$envFile = Join-Path $backendDir '.env'
if (-not (Test-Path $envFile)) {
    $line1 = 'DATABASE_URL=sqlite:///C:/inetpub/wwwroot/ErosETL/backend/db/dataflow.db'
    $line2 = 'CORS_ORIGINS=["https://eros.ipekyol.com.tr:8443"]'
    $envContent = $line1 + "`r`n" + $line2 + "`r`n"
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($envFile, $envContent, $utf8NoBom)
    Write-Host '  .env olusturuldu' -ForegroundColor DarkYellow
} else {
    Write-Host '  .env zaten mevcut - dokunulmadi' -ForegroundColor DarkGray
}

# 5. web.config + start-backend.bat + deploy.ps1
Write-Host '[5] IIS dosyalari kopyalaniyor...' -ForegroundColor Yellow
Copy-Item (Join-Path $SRC 'deploy\web.config') (Join-Path $DEPLOY 'web.config') -Force
Copy-Item (Join-Path $SRC 'deploy\start-backend.bat') (Join-Path $DEPLOY 'start-backend.bat') -Force
Copy-Item (Join-Path $SRC 'deploy\deploy.ps1') (Join-Path $DEPLOY 'deploy.ps1') -Force
Write-Host '  OK' -ForegroundColor Green

# 6. venv + pip
Write-Host '[6] Python venv ve bagimliliklar...' -ForegroundColor Yellow
$venvPython = Join-Path $backendDir 'venv\Scripts\python.exe'
if (-not (Test-Path $venvPython)) {
    Write-Host '  venv olusturuluyor...' -ForegroundColor DarkYellow
    python -m venv (Join-Path $backendDir 'venv')
}
$reqFile = Join-Path $backendDir 'requirements.txt'
& $venvPython -m pip install --upgrade pip --quiet 2>&1 | Out-Null
& $venvPython -m pip install -r $reqFile --quiet 2>&1 | Out-Null
Write-Host '  OK' -ForegroundColor Green

Write-Host ''
Write-Host '=== Deploy tamamlandi! ===' -ForegroundColor Green
Write-Host 'Backend test icin PowerShell ile calistirin:'
Write-Host '  cd C:\inetpub\wwwroot\ErosETL\backend'
Write-Host '  .\venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8445'
