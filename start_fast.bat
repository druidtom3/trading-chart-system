@echo off
echo ========================================
echo Trading Chart System - Fast Startup Mode
echo ========================================
echo.
echo This mode will skip time-consuming continuity checks
echo to significantly reduce system startup time.
echo.
echo Configuration:
echo - Skip continuity checks
echo - Use hybrid optimization mode
echo - Disable detailed progress display
echo - Enable fast FVG detection
echo.
set /p confirm=Confirm fast startup? (Y/N) [Y]: 

if /i not "%confirm%"=="n" (
    echo.
    echo Setting up fast startup environment variables...
    set FAST_STARTUP=true
    set CONTINUITY_CHECK_MODE=hybrid
    set USE_V2_CHECKER=true
    set SHOW_PROGRESS=false
    
    echo.
    echo ========================================
    echo Starting up quickly...
    echo ========================================
    echo.
    
    cd src
    python backend\app.py
    
) else (
    echo.
    echo Fast startup cancelled.
    echo For normal startup, please use start.bat
)

pause