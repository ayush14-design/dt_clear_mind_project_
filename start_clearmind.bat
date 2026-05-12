@echo off
TITLE ClearMind Server Launcher
:: Navigate to the project directory
cd /d "C:\Users\AYUSH\OneDrive\dt clear mind project"

:: Check if the server is already running on port 3000
netstat -ano | findstr :3000 > nul
if %errorlevel% equ 0 (
    echo ClearMind Server is already running.
) else (
    echo Starting ClearMind Server...
    :: Start the node server in a minimized or separate window
    :: We use 'start' to keep the server running independently of this batch script
    start "ClearMind Server" node server.js
    :: Wait for 2 seconds to let it initialize
    timeout /t 2 /nobreak > nul
)

:: Open the browser to the application
echo Opening ClearMind in your browser...
start http://localhost:3000
exit
