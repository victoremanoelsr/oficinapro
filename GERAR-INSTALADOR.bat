@echo off
setlocal
title Gerar instalador - Oficina Facil

where npm.cmd >nul 2>nul || (
  echo ERRO: Instale o Node.js 20 ou superior e tente novamente.
  pause
  exit /b 1
)
where cargo >nul 2>nul || (
  echo ERRO: Instale o Rust pelo site https://rustup.rs e tente novamente.
  pause
  exit /b 1
)

echo.
echo [1/2] Baixando dependencias...
call npm.cmd install
if errorlevel 1 goto :erro

echo.
echo [2/2] Gerando o instalador Windows...
call npm.cmd run desktop:build
if errorlevel 1 goto :erro

echo.
echo PRONTO! Abra a pasta abaixo para encontrar o instalador .exe:
echo %CD%\src-tauri\target\release\bundle\nsis
start "" "%CD%\src-tauri\target\release\bundle\nsis"
pause
exit /b 0

:erro
echo.
echo Nao foi possivel gerar o instalador. Confira a mensagem acima.
pause
exit /b 1
