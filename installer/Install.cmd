@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
set "SONA_PS=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if exist "%SystemRoot%\Sysnative\WindowsPowerShell\v1.0\powershell.exe" set "SONA_PS=%SystemRoot%\Sysnative\WindowsPowerShell\v1.0\powershell.exe"
"%SONA_PS%" -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install-Sona.ps1" -NoPause
set "SONA_RESULT=%ERRORLEVEL%"
echo.
if not "%SONA_RESULT%"=="0" echo 安装没有完成，请查看上方提示及安装日志。
pause
exit /b %SONA_RESULT%
