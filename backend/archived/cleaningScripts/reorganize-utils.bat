@echo off
echo ========================================
echo REORGANIZANDO CARPETA UTILS
echo ========================================
echo.

cd /d C:\AA1-WEB_DEVELOPER\REACT\apps\FINTRACK\pern_fintrack\backend\src\utils

echo [1/4] Creando nuevas carpetas...
mkdir account transactions device error helpers validation 2>nul
echo OK
echo.

echo [2/4] Moviendo archivos de account...
move accountUtils.js account\ 2>nul
move checkAndInsertAccount.js account\ 2>nul
move insertAccount.js account\ 2>nul
move updateAccountBalance.js account\ 2>nul
move updateAffectedAccountBalance.js account\ 2>nul
move verifyAccountExistence.js account\ 2>nul
echo OK
echo.

echo [3/4] Moviendo archivos de transactions...
move determineSourceAndDestinationAccounts.js transactions\ 2>nul
move determineTransactionType.js transactions\ 2>nul
move getTransactionTypeId.js transactions\ 2>nul
move prepareTransactionOption.js transactions\ 2>nul
move recordAnnulmentTransaction.js transactions\ 2>nul
move recordTransaction.js transactions\ 2>nul
echo OK
echo.

echo [4/4] Moviendo archivos individuales...
move classifyAccessDevice.js device\ 2>nul
move errorHandling.js error\ 2>nul
move helpers.js helpers\ 2>nul
move responseHelpers.js helpers\ 2>nul
move movementInputHandler.js validation\ 2>nul
echo OK
echo.

echo ========================================
echo REORGANIZACION COMPLETADA
echo ========================================
echo.
echo Ahora ejecuta: node update-imports.js