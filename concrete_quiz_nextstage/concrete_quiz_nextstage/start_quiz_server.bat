@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
  start "" http://127.0.0.1:8000/index.html
  py -m http.server 8000
  goto :eof
)
where python >nul 2>nul
if %errorlevel%==0 (
  start "" http://127.0.0.1:8000/index.html
  python -m http.server 8000
  goto :eof
)
start "" "%~dp0index.html"
echo Python が見つからないため、index.html を直接開きました。
pause
