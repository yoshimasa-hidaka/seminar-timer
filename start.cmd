@echo off
rem Seminar Talk Timer - double-click to start (Windows). Needs Node.js.
rem Messages are in English on purpose: cmd.exe cannot reliably show Japanese from a UTF-8 .cmd file.
rem Japanese instructions: README.md
setlocal
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo ======================================================
  echo   Node.js was not found. This app needs Node.js.
  echo ------------------------------------------------------
  echo   1^) Open https://nodejs.org/ and install the LTS version
  echo   2^) Then double-click start.cmd again
  echo ======================================================
  echo.
  pause
  exit /b 1
)

rem Warn if Node is very old (14+ recommended)
for /f "tokens=1 delims=." %%v in ('node --version') do set "major=%%v"
set "major=%major:v=%"
if defined major if %major% LSS 14 (
  echo   [note] Node.js v%major% may be too old. If something fails, install the LTS version from https://nodejs.org/
  echo.
)

rem Sleep is not blocked by this script on Windows. Keep the control screen open in Chrome/Edge
rem (it holds a screen Wake Lock), or set Power settings -^> Sleep to Never while in use.
echo   Starting... To stop: close this window or press Ctrl+C.
node server.js
echo.
pause
