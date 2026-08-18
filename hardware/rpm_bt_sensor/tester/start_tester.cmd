@echo off
cd /d "%~dp0"
start "MotoLab RPM-BT tester" http://127.0.0.1:8765
node server.js
pause
