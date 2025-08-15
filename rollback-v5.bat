@echo off
echo ====================================
echo   v5 回滾腳本
echo ====================================
echo.

echo [1/2] 回滾到備份版本...
copy src\frontend\index-v2-backup.html src\frontend\index-v2.html
echo      已回滾到之前的版本

echo.
echo [2/2] 檢查檔案...
echo      當前檔案:
dir src\frontend\index-v2.html | findstr /i "index"

echo.
echo ====================================
echo   回滾完成！
echo   請清除瀏覽器快取並重新載入
echo ====================================
echo.
pause