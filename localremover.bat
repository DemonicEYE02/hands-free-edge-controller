@echo off
setlocal EnableExtensions
color 0B
title Hands-Free Edge Controller - Local Asset Remover
cls
echo ============================================================
echo Hands-Free Edge Controller v4 - Legacy Local Asset Remover
echo ============================================================
echo.
echo Version 2.0's setup.bat downloaded only these files into its
echo extracted extension folder: MediaPipe JS/WASM files and the
echo hand_landmarker.task model. It did not install drivers, services,
echo registry entries, Python packages, or system-wide software.
echo.
echo IMPORTANT: Enter the FULL path to the OLD v2.0/v2.1 extracted
echo extension folder (the folder containing manifest.json). This
echo script deletes ONLY the six known files downloaded by setup.bat,
echo then removes their folders only if those folders are empty.
echo It will not remove your extension folder or other files.
echo.
set "TARGET="
set /p "TARGET=Old extension folder path (paste or drag folder here): "
set "TARGET=%TARGET:"=%"
if not defined TARGET (
  echo No path entered. Nothing was changed.
  pause
  exit /b 1
)
if not exist "%TARGET%\manifest.json" (
  echo.
  echo ERROR: manifest.json was not found at:
  echo "%TARGET%"
  echo Use the old extracted extension folder, not the ZIP file.
  echo Nothing was deleted.
  pause
  exit /b 1
)
echo.
echo Target folder: "%TARGET%"
echo.
choice /c YN /m "Delete only the known downloaded v2 tracking files"
if errorlevel 2 (
  echo Cancelled. Nothing was changed.
  pause
  exit /b 0
)
set "REMOVED=0"
for %%F in (
  "vendor\vision_bundle.mjs"
  "vendor\wasm\vision_wasm_internal.js"
  "vendor\wasm\vision_wasm_internal.wasm"
  "vendor\wasm\vision_wasm_nosimd_internal.js"
  "vendor\wasm\vision_wasm_nosimd_internal.wasm"
  "models\hand_landmarker.task"
) do (
  if exist "%TARGET%\%%~F" (
    del /f /q "%TARGET%\%%~F" >nul 2>nul
    if not exist "%TARGET%\%%~F" (
      echo Removed: %%~F
      set /a REMOVED+=1
    ) else (
      echo WARNING: could not remove %%~F
    )
  )
)
for %%D in ("vendor\wasm" "vendor" "models") do (
  if exist "%TARGET%\%%~D\." (
    rd "%TARGET%\%%~D" >nul 2>nul
    if not exist "%TARGET%\%%~D\." echo Removed empty folder: %%~D
  )
)
echo.
echo Cleanup finished. No other files or settings were targeted.
echo Removed file count: %REMOVED%
echo.
echo Note: if any of those exact paths held files before setup.bat ran,
echo their previous contents cannot be reconstructed automatically.
echo.
pause
