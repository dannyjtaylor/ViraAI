@echo off
cd /d "%~dp0"

REM Start FastAPI server using uvicorn
start "" /B cmd /C "python main.py > server.log 2>&1"

REM Open browser tab after delay
start launch_browser.vbs
