@echo off
chcp 65001 > nul
setlocal
cd /d "%~dp0"

echo ======================================================
echo  [중개노트] C드라이브 초고속 직접 배포
echo ======================================================

echo.
echo [1/1] GitHub Pages 저장소로 즉시 배포 중...
git add index.html style.css app.js guide.html connect.html icon-192.png icon-512.png
git commit -m "chore(showing-note): fast deploy from C:\antigravity\showing-note"
git push origin main

if errorlevel 1 (
    echo.
    echo [안내] Git 푸시 중 오류가 발생했거나 최신 변경사항 동기화가 필요합니다.
    pause
    exit /b 1
)

echo.
echo ======================================================
echo  ✨ 중개노트가 초고속으로 안전하게 배포되었습니다!
echo ======================================================
pause
