@echo off
setlocal
title Oficina Facil - Versao Web

where npm.cmd >nul 2>nul || (
  echo ERRO: Instale o Node.js 20 ou superior e tente novamente.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Preparando a tela web pela primeira vez...
  call npm.cmd install
  if errorlevel 1 goto :erro
)

pushd backend
if not exist .env copy /Y .env.example .env >nul
if not exist node_modules (
  echo Preparando o banco de dados local pela primeira vez...
  call npm.cmd install
  if errorlevel 1 goto :errobackend
)
start "Oficina Facil - Banco Local" cmd /k "cd /d ""%CD%"" && npm.cmd run web"
popd
timeout /t 5 /nobreak >nul

echo.
echo Abrindo o sistema no navegador...
echo Mantenha esta janela aberta enquanto estiver usando o sistema.
call npm.cmd run dev
goto :fim

:erro
echo.
echo Nao foi possivel preparar a versao web.
pause
exit /b 1

:errobackend
popd
goto :erro

:fim
