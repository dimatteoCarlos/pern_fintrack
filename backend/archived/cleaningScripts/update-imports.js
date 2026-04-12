const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

// Mapeo de archivos movidos a nuevas rutas
const movedFiles = {
  // Account files
  'utils/accountUtils.js': 'utils/account/accountUtils.js',
  'utils/checkAndInsertAccount.js': 'utils/account/checkAndInsertAccount.js',
  'utils/insertAccount.js': 'utils/account/insertAccount.js',
  'utils/updateAccountBalance.js': 'utils/account/updateAccountBalance.js',
  'utils/updateAffectedAccountBalance.js': 'utils/account/updateAffectedAccountBalance.js',
  'utils/verifyAccountExistence.js': 'utils/account/verifyAccountExistence.js',
  
  // Transactions files
  'utils/determineSourceAndDestinationAccounts.js': 'utils/transactions/determineSourceAndDestinationAccounts.js',
  'utils/determineTransactionType.js': 'utils/transactions/determineTransactionType.js',
  'utils/getTransactionTypeId.js': 'utils/transactions/getTransactionTypeId.js',
  'utils/prepareTransactionOption.js': 'utils/transactions/prepareTransactionOption.js',
  'utils/recordAnnulmentTransaction.js': 'utils/transactions/recordAnnulmentTransaction.js',
  'utils/recordTransaction.js': 'utils/transactions/recordTransaction.js',
  
  // Device files
  'utils/classifyAccessDevice.js': 'utils/device/classifyAccessDevice.js',
  
  // Error files
  'utils/errorHandling.js': 'utils/error/errorHandling.js',
  
  // Helpers files
  'utils/helpers.js': 'utils/helpers/helpers.js',
  'utils/responseHelpers.js': 'utils/helpers/responseHelpers.js',
  
  // Validation files
  'utils/movementInputHandler.js': 'utils/validation/movementInputHandler.js'
};

function updateImportsInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  for (const [oldPath, newPath] of Object.entries(movedFiles)) {
    const oldImport = new RegExp(`from ['"](\\.\\.?/)*${oldPath.replace(/\\/g, '/')}['"]`, 'g');
    const newImport = `from '../${newPath}'`;
    
    if (oldImport.test(content)) {
      content = content.replace(oldImport, newImport);
      modified = true;
      console.log(`  Updated: ${path.basename(filePath)} -> ${newPath}`);
    }
  }
  
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  }
  return false;
}

function walkDirectory(dir) {
  let updatedCount = 0;
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // Saltar carpeta utils (ya actualizada)
      if (file !== 'utils') {
        updatedCount += walkDirectory(filePath);
      }
    } else if (file.endsWith('.js')) {
      if (updateImportsInFile(filePath)) {
        updatedCount++;
      }
    }
  }
  
  return updatedCount;
}

console.log('========================================');
console.log('ACTUALIZANDO IMPORTS DE UTILS');
console.log('========================================\n');

const updatedCount = walkDirectory(srcDir);

console.log(`\n✅ Actualizados ${updatedCount} archivos`);
console.log('\nVerifica los cambios y haz commit si todo está bien.');