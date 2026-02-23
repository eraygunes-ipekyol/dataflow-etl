#Requires -RunAsAdministrator
<#
.SYNOPSIS
    EROS ETL — IIS Production Deployment Script
.DESCRIPTION
    Worktree'den frontend build + backend kodu kopyalar.
    .env, db/ ve venv/ klasörlerine DOKUNMAZ (production verisi korunur).
.NOTES
    Kullanim: PowerShell'i yönetici olarak aç → .\deploy.ps1
#>

$ErrorActionPreference = "Stop"

# ── Yollar ─────────────────────────────────────────────────────────────────
$SOURCE_DIR   = "C:\Users\eray.gunes\Documents\claude-code\.claude\worktrees\great-sutherland"
$DEPLOY_DIR   = "C:\inetpub\wwwroot\ErosETL"
$BACKEND_SRC  = "$SOURCE_DIR\backend"
$FRONTEND_SRC = "$SOURCE_DIR\frontend"
$BACKEND_DST  = "$DEPLOY_DIR\backend"
$FRONTEND_DST = "$DEPLOY_DIR\frontend"
$SERVICE_NAME = "ErosETL-Backend"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  EROS ETL — Production Deployment" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ── 1. Frontend Build ──────────────────────────────────────────────────────
Write-Host "[1/6] Frontend build baslatiliyor..." -ForegroundColor Yellow
Push-Location $FRONTEND_SRC
try {
    npm run build 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Frontend build basarisiz!" }
    Write-Host "  OK — Frontend build tamamlandi." -ForegroundColor Green
} finally {
    Pop-Location
}

# ── 2. Frontend Kopyalama ─────────────────────────────────────────────────
Write-Host "[2/6] Frontend dosyalari kopyalaniyor..." -ForegroundColor Yellow
if (Test-Path $FRONTEND_DST) {
    Remove-Item "$FRONTEND_DST\*" -Recurse -Force
} else {
    New-Item -ItemType Directory -Path $FRONTEND_DST -Force | Out-Null
}
Copy-Item "$FRONTEND_SRC\dist\*" $FRONTEND_DST -Recurse -Force
Write-Host "  OK — Frontend kopyalandi: $FRONTEND_DST" -ForegroundColor Green

# ── 3. Backend Kodu Kopyalama ─────────────────────────────────────────────
Write-Host "[3/6] Backend kodu kopyalaniyor..." -ForegroundColor Yellow
if (-not (Test-Path $BACKEND_DST)) {
    New-Item -ItemType Directory -Path $BACKEND_DST -Force | Out-Null
}

# app/ klasörünü tamamen yenile (eski pyc'ler temizlensin)
if (Test-Path "$BACKEND_DST\app") {
    Remove-Item "$BACKEND_DST\app" -Recurse -Force
}
Copy-Item "$BACKEND_SRC\app" "$BACKEND_DST\app" -Recurse -Force
# __pycache__ temizle
Get-ChildItem "$BACKEND_DST\app" -Recurse -Directory -Filter "__pycache__" | Remove-Item -Recurse -Force

# main.py ve requirements.txt kopyala
Copy-Item "$BACKEND_SRC\main.py" "$BACKEND_DST\main.py" -Force
Copy-Item "$BACKEND_SRC\requirements.txt" "$BACKEND_DST\requirements.txt" -Force

# db/ klasörü yoksa oluştur (ilk deploy)
if (-not (Test-Path "$BACKEND_DST\db")) {
    New-Item -ItemType Directory -Path "$BACKEND_DST\db" -Force | Out-Null
    Write-Host "  db/ klasoru olusturuldu (ilk deploy)." -ForegroundColor DarkYellow
}

# .env yoksa ilk kez oluştur
if (-not (Test-Path "$BACKEND_DST\.env")) {
    $ENCRYPTION_KEY = python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())" 2>$null
    if (-not $ENCRYPTION_KEY) {
        $ENCRYPTION_KEY = "GENERATE-ME-AFTER-VENV-SETUP"
    }
    @"
DATABASE_URL=sqlite:///C:/inetpub/wwwroot/ErosETL/backend/db/dataflow.db
CORS_ORIGINS=["https://eros.ipekyol.com.tr:8443"]
ENCRYPTION_KEY=$ENCRYPTION_KEY
"@ | Set-Content "$BACKEND_DST\.env" -Encoding UTF8
    Write-Host "  .env olusturuldu (ilk deploy). JWT_SECRET_KEY ilk calistirmada otomatik uretilecek." -ForegroundColor DarkYellow
} else {
    Write-Host "  .env zaten mevcut — dokunulmadi." -ForegroundColor DarkGray
}

Write-Host "  OK — Backend kodu kopyalandi." -ForegroundColor Green

# ── 4. Python venv + Bağımlılıklar ───────────────────────────────────────
Write-Host "[4/6] Python venv ve bagimliliklar kontrol ediliyor..." -ForegroundColor Yellow
if (-not (Test-Path "$BACKEND_DST\venv\Scripts\python.exe")) {
    Write-Host "  venv olusturuluyor..." -ForegroundColor DarkYellow
    python -m venv "$BACKEND_DST\venv"
}
& "$BACKEND_DST\venv\Scripts\python.exe" -m pip install --upgrade pip --quiet 2>&1 | Out-Null
& "$BACKEND_DST\venv\Scripts\python.exe" -m pip install -r "$BACKEND_DST\requirements.txt" --quiet 2>&1 | Out-Null
Write-Host "  OK — Bagimliliklar kuruldu/guncellendi." -ForegroundColor Green

# ── 5. web.config Kopyalama ───────────────────────────────────────────────
Write-Host "[5/6] web.config kopyalaniyor..." -ForegroundColor Yellow
Copy-Item "$SOURCE_DIR\deploy\web.config" "$DEPLOY_DIR\web.config" -Force
Copy-Item "$SOURCE_DIR\deploy\start-backend.bat" "$DEPLOY_DIR\start-backend.bat" -Force
Write-Host "  OK — IIS konfigurasyonu kopyalandi." -ForegroundColor Green

# ── 6. Backend Servisi Yeniden Başlatma ───────────────────────────────────
Write-Host "[6/6] Backend servisi yeniden baslatiliyor..." -ForegroundColor Yellow
$nssmExists = Get-Command nssm -ErrorAction SilentlyContinue
if ($nssmExists) {
    $svcStatus = nssm status $SERVICE_NAME 2>$null
    if ($svcStatus -match "SERVICE_RUNNING") {
        nssm restart $SERVICE_NAME 2>$null
        Write-Host "  OK — $SERVICE_NAME servisi yeniden baslatildi." -ForegroundColor Green
    } elseif ($svcStatus -match "SERVICE_STOPPED") {
        nssm start $SERVICE_NAME 2>$null
        Write-Host "  OK — $SERVICE_NAME servisi baslatildi." -ForegroundColor Green
    } else {
        Write-Host "  UYARI: '$SERVICE_NAME' servisi bulunamadi." -ForegroundColor DarkYellow
        Write-Host "  Servisi kaydetmek icin:" -ForegroundColor DarkYellow
        Write-Host "    nssm install $SERVICE_NAME `"$BACKEND_DST\venv\Scripts\python.exe`" `"-m uvicorn main:app --host 127.0.0.1 --port 8445`"" -ForegroundColor White
        Write-Host "    nssm set $SERVICE_NAME AppDirectory `"$BACKEND_DST`"" -ForegroundColor White
        Write-Host "    nssm start $SERVICE_NAME" -ForegroundColor White
    }
} else {
    Write-Host "  UYARI: NSSM bulunamadi. Backend'i manuel baslatin:" -ForegroundColor DarkYellow
    Write-Host "    cd $BACKEND_DST" -ForegroundColor White
    Write-Host "    venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8445" -ForegroundColor White
}

# ── Sonuç ─────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Deployment tamamlandi!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Kontrol:" -ForegroundColor Cyan
Write-Host "  Backend health : curl http://127.0.0.1:8445/api/v1/health" -ForegroundColor White
Write-Host "  IIS site       : https://eros.ipekyol.com.tr:8443/" -ForegroundColor White
Write-Host ""
