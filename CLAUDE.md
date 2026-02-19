# DataFlow ETL

Browser tabanlı ETL (Extract-Transform-Load) aracı. MSSQL→MSSQL ve MSSQL→Google BigQuery veri aktarımlarını destekler. Sürükle-bırak workflow tasarımı, veri önizleme, mapping, transform ve zamanlayıcı özellikleri içerir.

## İletişim

- Kullanıcıyla her zaman Türkçe iletişim kur.

## Tech Stack

- **Frontend:** React + TypeScript, Vite, React Flow (workflow editör)
- **Backend:** Python FastAPI
- **Uygulama DB:** SQLite (workflow tanımları, loglar, zamanlayıcılar)
- **Veri Kaynakları:** MSSQL (pyodbc), Google BigQuery (service account JSON key)
- **Paket Yöneticisi:** npm (frontend), pip + venv (backend)
- **Yapı:** Monorepo

## Proje Yapısı

```
/frontend          — React + TypeScript (Vite)
/backend           — Python FastAPI
/shared            — Paylaşılan tipler/şemalar (JSON Schema)
```

## Komutlar

```bash
# Frontend
cd frontend && npm install        # Bağımlılıkları kur
cd frontend && npm run dev        # Geliştirme sunucusu
cd frontend && npm run build      # Production build
cd frontend && npm test           # Testleri çalıştır

# Backend
cd backend && python -m venv venv && source venv/bin/activate  # Sanal ortam
cd backend && pip install -r requirements.txt                   # Bağımlılıkları kur
cd backend && uvicorn main:app --reload                         # Geliştirme sunucusu
cd backend && pytest                                            # Testleri çalıştır
```

## Temel Kurallar

- Windows uyumluluğunu her zaman göz önünde bulundur (dosya yolları, komutlar, bağımlılıklar).
- Bellek optimizasyonu kritik: büyük veri setlerini streaming/chunked işle, tamamını belleğe yükleme.
- Workflow editörü React Flow ile sürükle-bırak mantığında olacak.
- BigQuery bağlantısı service account (JSON key) ile yapılacak.
- MSSQL bağlantısı pyodbc ile yapılacak.
- Auth şimdilik yok, ileride eklenebilir yapıda tasarla.
- UI kullanıcı dostu ve modern olmalı.

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
cd frontend && npx tsc --noEmit
```
→ Sıfır hata olmalı.

### 2. Frontend Sunucusu
```bash
# Çalışıyor mu kontrol et:
lsof -ti:5173 && echo "Çalışıyor" || echo "ÇALIŞMIYOR"

# Başlatmak için:
cd frontend && nohup npm run dev > /tmp/frontend.log 2>&1 &
sleep 5 && curl -s --max-time 5 http://localhost:5173 | head -3
```
→ HTML dönmeli.

### 3. Backend Sunucusu
```bash
# Çalışıyor mu kontrol et:
curl -s --max-time 5 http://localhost:8000/api/v1/health

# Başlatmak için:
cd backend && source venv/bin/activate
nohup uvicorn main:app --reload --host 0.0.0.0 --port 8000 > /tmp/backend.log 2>&1 &
sleep 3 && curl -s --max-time 5 http://localhost:8000/api/v1/health
```
→ `{"status":"ok","service":"DataFlow ETL"}` dönmeli.

### 4. Port Temizleme (Gerektiğinde)
```bash
lsof -ti:8000 | xargs kill -9 2>/dev/null   # Backend portu temizle
lsof -ti:5173 | xargs kill -9 2>/dev/null   # Frontend portu temizle
```

### Kural
**Her geliştirme oturumu sonunda frontend ve backend'in çalıştığını doğrulamadan kullanıcıya teslim etme.**
