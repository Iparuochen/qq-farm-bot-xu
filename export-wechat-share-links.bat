@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ==============================================
echo  Export WeChat share cards (QQ Farm invites)
echo ==============================================
echo.

set "SCRIPT=.agents\skills\wechat-share-card-extract\scripts\extract-cards.py"
set "PYEXE="

rem --- candidate 1: WorkBuddy bundled venv (has pywxdump + wxdump CLI) ---
if exist "%USERPROFILE%\.workbuddy\binaries\python\envs\default\Scripts\python.exe" (
    "%USERPROFILE%\.workbuddy\binaries\python\envs\default\Scripts\python.exe" -c "import pywxdump, Crypto, lz4" >nul 2>nul
    if not errorlevel 1 set "PYEXE=%USERPROFILE%\.workbuddy\binaries\python\envs\default\Scripts\python.exe"
)

rem --- candidate 2: python on PATH with all deps ---
if not defined PYEXE (
    where python >nul 2>nul
    if not errorlevel 1 (
        python -c "import pywxdump, Crypto, lz4" >nul 2>nul
        if not errorlevel 1 set "PYEXE=python"
    )
)

rem --- candidate 3: py launcher ---
if not defined PYEXE (
    where py >nul 2>nul
    if not errorlevel 1 (
        py -3 -c "import pywxdump, Crypto, lz4" >nul 2>nul
        if not errorlevel 1 set "PYEXE=py -3"
    )
)

if not defined PYEXE (
    echo [ERROR] No usable Python found with pywxdump installed.
    echo.
    echo Tried: WorkBuddy bundled python, python on PATH, py launcher.
    echo Fix: open a terminal and run
    echo   pip install pywxdump pycryptodome lz4
    echo.
    pause
    exit /b 1
)

echo Using python: %PYEXE%
echo Prereq: WeChat 3.9.12.x must be running and logged in.
echo.
echo --- export output ---
echo.

rem Make sure wxdump.exe (installed alongside pywxdump) is reachable
set "PATH=%PATH%;%USERPROFILE%\.workbuddy\binaries\python\envs\default\Scripts"

%PYEXE% "%SCRIPT%" --export-dir exports
set "RC=%errorlevel%"

if not "%RC%"=="0" (
    echo.
    echo [ERROR] Export failed with exit code %RC%. See message above.
    echo Common causes:
    echo   1. WeChat 3.9.12 not running / not logged in
    echo   2. wxdump CLI missing - reinstall with: pip install pywxdump
    echo   3. pywxdump cannot read key - retry while WeChat is open
    echo.
    pause
    exit /b %RC%
)

echo.
echo Done. exports folder is opening - paste the .txt links into
echo Settings - Batch Add Friends tab.
start "" "exports"
pause
