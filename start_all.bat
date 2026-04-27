@echo off
start "Expense Tracker Backend" cmd /k "cd /d "%~dp0backend" && python -m uvicorn main:app --host 127.0.0.1 --port 8001 --reload"
start "Expense Tracker Frontend" cmd /k "cd /d "%~dp0frontend" && python -m http.server 8000"
