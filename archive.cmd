@echo off
rem Saves the newest Roblox version to the archive (does nothing if it's already saved).
cd /d "%~dp0"
node archive.js
echo.
pause
