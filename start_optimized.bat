@echo off
chcp 65001 >nul
echo =================================================
echo 交易圖表系統 - 優化完整啟動
echo =================================================
echo.

echo 此模式將載入所有功能，包括M1和M5數據，
echo 但採用優化策略以平衡性能和功能完整性。
echo.

echo 配置：
echo - 聰明載入模式：大文件採用最近數據策略
echo - 向量化連續性檢查
echo - 詳細進度顯示
echo - 完整功能支援（包含M1/M5）
echo.

set /p confirm=確認啟動優化完整模式？ (Y/N) [Y]: 

if /i not "%confirm%"=="n" (
    echo.
    echo 設置優化環境變數...
    set FAST_STARTUP=true
    set ULTRA_FAST_STARTUP=false
    set CONTINUITY_CHECK_MODE=vectorized
    set USE_V2_CHECKER=true
    set SHOW_PROGRESS=true
    
    echo.
    echo =================================================
    echo 啟動優化完整模式...
    echo =================================================
    echo.
    echo 提醒：首次載入可能需要1-2分鐘，請耐心等待
    echo 系統將顯示詳細進度資訊
    echo.
    
    cd src\backend
    set PYTHONPATH=%PYTHONPATH%;..;..\..
    python app.py
    
) else (
    echo.
    echo 啟動已取消。
    echo 如需快速啟動，請使用 start_fast.bat
)

pause
