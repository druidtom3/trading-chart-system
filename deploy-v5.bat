@echo off
echo ====================================
echo   v5 升級部署腳本
echo ====================================
echo.

REM 取得當前日期時間
for /f "tokens=2 delims==" %%a in ('wmic OS Get localdatetime /value') do set "dt=%%a"
set "timestamp=%dt:~0,8%_%dt:~8,6%"

echo [1/4] 備份當前生產版本...
copy src\frontend\index-v2.html "src\frontend\backups\index-v2-backup-%timestamp%.html" >nul 2>&1
if not exist src\frontend\backups mkdir src\frontend\backups
copy src\frontend\index-v2.html "src\frontend\backups\index-v2-backup-%timestamp%.html"
echo      備份完成: index-v2-backup-%timestamp%.html

echo.
echo [2/4] 部署v5版本...
copy src\frontend\index-v5-test.html src\frontend\index-v2.html
echo      v5版本已部署到 index-v2.html

echo.
echo [3/4] 檢查檔案...
echo      檔案列表:
dir src\frontend\index*.html | findstr /i "index"

echo.
echo [4/4] 部署完成！
echo.
echo ====================================
echo   請執行以下步驟：
echo   1. 清除瀏覽器快取 (Ctrl+Shift+R)
echo   2. 訪問 http://localhost:8080/index-v2.html
echo   3. 確認版本顯示為 v5
echo   4. 執行功能測試
echo ====================================
echo.
echo 如需回滾，請執行: rollback-v5.bat
echo.
pause