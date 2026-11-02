@echo off
title K-Cine - Canal de Filmes e Series
chcp 65001 > nul
cls
echo ======================================================================
echo                 K-CINE - CANAL DE FILMES E SERIES
echo ======================================================================
echo.
echo Iniciando servidor local e abrindo o portal no navegador...
echo.

set "PY_EXE="
where python >nul 2>nul
if %ERRORLEVEL% equ 0 (
    set "PY_EXE=python"
) else (
    where py >nul 2>nul
    if %ERRORLEVEL% equ 0 (
        set "PY_EXE=py"
    ) else if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" (
        set "PY_EXE=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
    ) else if exist "%LOCALAPPDATA%\Programs\Python\Launcher\py.exe" (
        set "PY_EXE=%LOCALAPPDATA%\Programs\Python\Launcher\py.exe"
    )
)

if defined PY_EXE (
    "%PY_EXE%" servidor.py
) else (
    where node >nul 2>nul
    if %ERRORLEVEL% equ 0 (
        echo Iniciando com Node.js...
        node servidor.js
    ) else (
        echo Erro: Python ou Node.js nao foram encontrados.
    )
)

pause
