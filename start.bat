@echo off
setlocal

echo Iniciando Sistema de Check-in Escolar...
echo.

:: Salva o diretorio raiz do projeto
set ROOT=%~dp0

:: Libera porta 8000
echo Verificando porta 8000...
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":8000"') do taskkill /PID %%a /F >nul 2>&1

:: Libera porta 5173
echo Verificando porta 5173...
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":5173"') do taskkill /PID %%a /F >nul 2>&1

timeout /t 1 /nobreak >nul

:: Inicia backend
echo Iniciando backend...
start "Backend - FastAPI" cmd /k "cd /d %ROOT%backend && python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000"

timeout /t 4 /nobreak >nul

:: Inicia frontend
echo Iniciando frontend...
start "Frontend - React" cmd /k "cd /d %ROOT%frontend && npm run dev -- --host"

echo.
echo ============================================
echo  Sistema iniciado!
echo ============================================
echo  Backend:   http://localhost:8000
echo  Frontend:  http://localhost:5173
echo  API Docs:  http://localhost:8000/docs
echo.
echo  Login admin: admin@escola.com / admin123
echo  Check-in:    http://localhost:5173/chegada
echo ============================================
echo.
pause
endlocal
