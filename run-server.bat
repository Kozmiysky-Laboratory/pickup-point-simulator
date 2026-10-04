@echo off
cd /d "%~dp0"
npx vite --host 127.0.0.1 --port 5175 > vite.log 2>&1
