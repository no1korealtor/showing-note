@echo off
chcp 65001 > nul
title 중개사 현장 쇼잉 수첩 - 모바일 연결 서버
cd /d "%~dp0"
python server.py
pause
