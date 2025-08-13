@echo off
chcp 65001 > nul
echo === Trading Chart System Startup ===
echo.

echo Checking Python environment...
python --version
if errorlevel 1 (
    echo ERROR: Python not found. Please install Python 3.8+
    pause
    exit /b 1
)

echo.
echo Installing dependencies...
pip install -r requirements.txt

echo.
echo Starting system...
cd src\backend
python app.py

pause