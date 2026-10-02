@echo off
title POS iPay - Minimarket & PPOB ipay.my.id
cd /d "%~dp0"
echo ========================================================
echo   POS iPay - Minimarket & PPOB ipay.my.id
echo ========================================================
echo.
echo Sedang menjalankan server backend dan frontend...
echo Buka browser di: http://localhost:5173
echo.
npm run dev
pause
