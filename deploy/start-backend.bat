@echo off
title EROS ETL Backend
cd /d C:\inetpub\wwwroot\ErosETL\backend
echo EROS ETL Backend baslatiliyor...
echo Port: 8445 (sadece localhost)
echo.
venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8445
pause
