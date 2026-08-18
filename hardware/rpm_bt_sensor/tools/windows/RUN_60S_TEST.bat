@echo off
setlocal
cd /d "%~dp0"
if not exist .venv\Scripts\python.exe (echo Aja ensin INSTALL.bat.& pause & exit /b 1)
.venv\Scripts\python.exe rpm_bt_tool.py --seconds 60
pause

