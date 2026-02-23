# EROS ETL

Browser tabanlı ETL (Extract-Transform-Load) aracı. MSSQL→MSSQL ve MSSQL→Google BigQuery veri aktarımlarını destekler. Sürükle-bırak workflow tasarımı, veri önizleme, mapping, transform ve zamanlayıcı özellikleri içerir.

## İletişim

- Kullanıcıyla her zaman Türkçe iletişim kur.

## Çalışma Dizini (KRİTİK)

**Geliştirme her zaman bu dizinde yapılmalıdır:**
```
C:\Users\eray.gunes\Documents\claude-code\.claude\worktrees\great-sutherland\
```

- **Branch:** `claude/great-sutherland`
- **Git root (main):** `C:\Users\eray.gunes\Documents\claude-code\` — buradan geliştirme YAPMA, sadece git referansı.
- **Production:** `C:\inetpub\wwwroot\ErosETL\` — DOKUNMA, sadece deploy hedefi.
- **Veritabanı:** `C:\Users\eray.gunes\Documents\claude-code\backend\db\dataflow.db` — tüm ortamlar bunu paylaşır.

> ⚠️ Başka klasörden (git root, production vb.) backend/frontend başlatırsan ENCRYPTION_KEY uyumsuzluğu nedeniyle bağlantılar bozulur.

## Tech Stack

- **Frontend:** React + TypeScript, Vite, React Flow (workflow editör)
- **Backend:** Python FastAPI
- **Uygulama DB:** SQLite (workflow tanımları, loglar, zamanlayıcılar)
- **Veri Kaynakları:** MSSQL (pyodbc), Google BigQuery (service account JSON key)
- **Paket Yöneticisi:** npm (frontend), pip + venv (backend)
- **Yapı:** Monorepo

## Proje Yapısı

```
great-sutherland/
├── frontend/          — React + TypeScript (Vite) → port 8462
├── backend/           — Python FastAPI → port 8362
│   ├── venv/          — Python sanal ortam
│   └── .env           — ENCRYPTION_KEY, JWT_SECRET_KEY, DATABASE_URL, CORS_ORIGINS
└── shared/            — Paylaşılan tipler/şemalar (JSON Schema)
```

## Portlar

| Servis | Dev Port | Production Port |
|--------|----------|-----------------|
| Frontend (Vite) | 8462 | 8443 (IIS) |
| Backend (Uvicorn) | 8362 | 8445 (NSSM) |

## Komutlar

```bash
# Frontend
cd C:\Users\eray.gunes\Documents\claude-code\.claude\worktrees\great-sutherland\frontend
npm install           # Bağımlılıkları kur
npm run dev           # Geliştirme sunucusu (port 8462)
npm run build         # Production build
npx tsc --noEmit      # TypeScript kontrolü

# Backend
cd C:\Users\eray.gunes\Documents\claude-code\.claude\worktrees\great-sutherland\backend
venv\Scripts\python.exe -m uvicorn main:app --reload --host 0.0.0.0 --port 8362
```

## Temel Kurallar

- Windows uyumluluğunu her zaman göz önünde bulundur (dosya yolları, komutlar, bağımlılıklar).
- Bellek optimizasyonu kritik: büyük veri setlerini streaming/chunked işle, tamamını belleğe yükleme.
- Workflow editörü React Flow ile sürükle-bırak mantığında olacak.
- BigQuery bağlantısı service account (JSON key) ile yapılacak.
- MSSQL bağlantısı pyodbc ile yapılacak.
- Auth JWT ile çalışıyor (login: eraygunes).
- UI kullanıcı dostu ve modern olmalı (dark tema).

## Veri İşleme Kuralları

- Büyük veri setleri için cursor/streaming kullan, DataFrame'e toplu yükleme yapma.
- Veri önizleme için LIMIT/TOP kullan (maks 100-500 satır).
- Transform işlemleri batch/chunk bazlı olmalı.
- BigQuery'ye yazma işlemi streaming insert veya load job ile yapılmalı.

## Workflow Kuralları

- Her workflow bir JSON dosyası olarak saklanabilir.
- Workflowlar klasörlerle organize edilebilir.
- Workflowlar birbirine bağlanabilir (chaining).
- Başarılı/başarısız durumlar yönetilebilir (hata akışları).
- Periyodik zamanlayıcı (cron/scheduler) desteği olmalı.

## Geliştirme Sonrası Zorunlu Kontroller

Her geliştirme adımının ardından aşağıdaki kontrolleri mutlaka yap:

### 1. TypeScript Kontrolü
```bash
cd C:\Users\eray.gunes\Documents\claude-code\.claude\worktrees\great-sutherland\frontend && npx tsc --noEmit
```
→ Sıfır hata olmalı.

### 2. Frontend Sunucusu
```bash
# Çalışıyor mu kontrol et:
curl -s --max-time 5 http://localhost:8462

# Başlatmak için (Windows):
cd C:\Users\eray.gunes\Documents\claude-code\.claude\worktrees\great-sutherland\frontend
npm run dev -- --port 8462
```
→ HTTP 200 dönmeli.

### 3. Backend Sunucusu
```bash
# Çalışıyor mu kontrol et:
curl -s --max-time 5 http://localhost:8362/api/v1/health

# Başlatmak için (Windows):
cd C:\Users\eray.gunes\Documents\claude-code\.claude\worktrees\great-sutherland\backend
venv\Scripts\python.exe -m uvicorn main:app --reload --host 0.0.0.0 --port 8362
```
→ `{"status":"ok","service":"EROS - ETL"}` dönmeli.

### 4. Port Temizleme (Gerektiğinde — Windows)
```powershell
Get-Process -Id (Get-NetTCPConnection -LocalPort 8362 -ErrorAction SilentlyContinue).OwningProcess | Stop-Process -Force
Get-Process -Id (Get-NetTCPConnection -LocalPort 8462 -ErrorAction SilentlyContinue).OwningProcess | Stop-Process -Force
```

### Kural
**Her geliştirme oturumu sonunda frontend ve backend'in çalıştığını doğrulamadan kullanıcıya teslim etme.**

## Production Deploy (Dev → Canlı)

Kullanıcı "canlıya geç", "deploy et", "production'a al" dediğinde aşağıdaki adımları izle.

### Deploy Kuralları (KRİTİK)

1. **Veritabanı olduğu gibi taşınmaz.** Dev DB ile Production DB farklıdır. Yeni tablo/kolon eklendiyse Production DB'ye ALTER TABLE / CREATE TABLE ile migration uygula. Mevcut verilere DOKUNMA.
2. **Production .env dosyasına DOKUNMA.** Zaten doğru yapılandırılmış (kendi ENCRYPTION_KEY, DATABASE_URL, CORS_ORIGINS, JWT_SECRET_KEY değerleri var).
3. **Port farkları:** Dev frontend relative URL (`/api/v1`) kullanır, production'da IIS reverse proxy bunu port 8445'e yönlendirir. Frontend kodunda port hardcode YOKTUR.
4. **Admin yetkisi gerekir:** IIS durdurup başlatmak ve NSSM servisi yönetmek için `Start-Process -Verb RunAs` kullan.

### Deploy Ortam Bilgileri

| | Dev | Production |
|---|---|---|
| **Kaynak** | `great-sutherland\` | `C:\inetpub\wwwroot\ErosETL\` |
| **Frontend** | Vite dev server (8462) | IIS static files (8443 HTTPS) |
| **Backend** | Uvicorn --reload (8362) | NSSM servisi `ErosETL-Backend` (8445) |
| **DB** | `claude-code\backend\db\dataflow.db` | `ErosETL\backend\db\dataflow.db` |
| **URL** | `http://localhost:8462` | `https://eros.ipekyol.com.tr:8443` |

### Deploy Adımları

```
1. TypeScript kontrolü: cd frontend && npx tsc --noEmit
2. Frontend build: cd frontend && npm run build
3. IIS + Backend durdur (admin gerekli):
   - IIS: iisreset /stop
   - NSSM: nssm stop ErosETL-Backend
4. Frontend kopyala:
   - Eski: Remove-Item "C:\inetpub\wwwroot\ErosETL\frontend\*" -Recurse -Force
   - Yeni: Copy-Item "great-sutherland\frontend\dist\*" → ErosETL\frontend\
5. Backend kopyala:
   - Remove-Item "ErosETL\backend\app" -Recurse -Force
   - Copy-Item "great-sutherland\backend\app" → ErosETL\backend\app\
   - Copy-Item main.py, requirements.txt, workflow_ai.md
   - __pycache__ temizle
   - .env ve db/ klasörüne DOKUNMA
6. pip install: ErosETL\backend\venv\Scripts\python.exe -m pip install -r requirements.txt
7. web.config + start-backend.bat kopyala (deploy/ klasöründen)
8. DB migration (gerekiyorsa):
   - Production DB'de yeni tablo/kolon oluştur (ALTER TABLE / CREATE TABLE)
   - Mevcut verilere dokunma
9. Servisleri başlat (admin gerekli):
   - IIS: Start-Website -Name ErosETL (veya iisreset /start)
   - NSSM: nssm start ErosETL-Backend
10. Doğrulama:
    - Backend health: http://127.0.0.1:8445/api/v1/health
    - IIS site: https://eros.ipekyol.com.tr:8443/
    - Tarayıcıda giriş yap ve test et
```

### Deploy Script

Hazır script: `deploy/deploy-now.ps1` — Admin PowerShell'de çalıştırılmalı.
Alternatif: `deploy/deploy.ps1` (eski versiyon).

### Doğrulama Sonrası

Deploy sonrası şunları tarayıcıda kontrol et:
- Login sayfası açılıyor mu?
- Giriş yapılabiliyor mu?
- Bağlantılar sayfasında DB bağlantı testleri çalışıyor mu?
- Ayarlar sayfasında AI Yapılandırması görünüyor mu?
- Workflow editöründe AI Asistan butonu var mı?
