@echo off
cd /d "%~dp0"

:: Optional: activate virtual environment if you have one
:: call venv\Scripts\activate

:: Launch the browser in the background
start "" launch_browser.vbs

:: Start the FastAPI server
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8080
pause
