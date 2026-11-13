@echo off
rem Checks for a new Roblox version every hour while you're signed in to Windows, with no window.
rem Run unschedule.cmd to stop it.
schtasks /Create /F /SC HOURLY /TN "Roblox version archive" /TR "wscript.exe \"%~dp0run-hidden.vbs\""
echo.
pause
