@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul || (echo Python 3 puuttuu. Asenna python.org:sta ja valitse Add Python to PATH.& pause & exit /b 1)
py -3 -m venv .venv || (pause & exit /b 1)
call .venv\Scripts\activate.bat
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
echo.
echo Asennus valmis. Kaynnista RUN_RPM_BT.bat.
pause

