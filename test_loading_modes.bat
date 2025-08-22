@echo off
echo ============================================
echo 智能載入模式測試
echo ============================================
echo.

echo 1. 測試生產模式 (只載入1個FVG渲染器)
echo    預期: fvg-renderer-optimized.js
start "Production Mode" "src/frontend/index-v2.html?mode=production"
timeout /t 3 /nobreak > nul

echo.
echo 2. 測試調試模式 (載入3個FVG渲染器)
echo    預期: optimized, ultra-minimal, safe
start "Debug Mode" "src/frontend/index-v2.html?mode=debug"
timeout /t 3 /nobreak > nul

echo.
echo 3. 測試開發模式 (載入全部6個FVG渲染器)
echo    預期: optimized, multiline, ultra-minimal, safe, fixed, minimal
start "Development Mode" "src/frontend/index-v2.html?mode=development"

echo.
echo 4. 打開測試工具頁面
start "Test Tool" "test_smart_loading.html"

echo.
echo ============================================
echo 測試完成！請檢查瀏覽器中的載入日誌
echo 在瀏覽器控制台中查看詳細載入信息
echo ============================================
pause