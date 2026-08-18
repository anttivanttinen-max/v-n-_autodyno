@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul || (echo Python 3 is required from python.org & pause & exit /b 1)
if not exist ".venv\Scripts\python.exe" py -3 -m venv .venv || (pause & exit /b 1)
".venv\Scripts\python.exe" -m pip install --disable-pip-version-check -q -r requirements.txt || (pause & exit /b 1)
".venv\Scripts\python.exe" rpm_bt_logger.py %*
if errorlevel 1 pause


