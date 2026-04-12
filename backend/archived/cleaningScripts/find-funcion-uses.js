import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const functionsToCheck = [
  // transactionAccountHelpers
  'determineTransactionType',
  'determineTransactionType_v1',
  'validateRequiredFields',
  'getAccountTypeId',
  'getCurrencyId',
  'filterCurrencyId',
  'handleTransactionRecording',
  
  // dataFormatHelpers
  'formatDateToISO',
  'validateAndNormalizeDate',
  'validateAndNormalizeDateFn',
  'formatDateToDDMMYYYY',
  'formatDate',
  'isValidDate',
  'convertToISO',
  'getMonthName',
  'numberToWords',
  'capitalize'
];

const srcDir = path.join(__dirname, 'src');
const ignoreDirs = ['node_modules', 'archived'];

function searchFunctionInFile(filePath, functionName) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const usages = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Buscar importaciones o usos de la función
    if (line.includes(functionName) && 
        !line.includes('export function') && 
        !line.includes('export const') &&
        !line.includes(`function ${functionName}`) &&
        !line.includes(`const ${functionName} =`)) {
      usages.push({
        line: i + 1,
        text: line.trim()
      });
    }
  }
  return usages;
}

function walkDirectory(dir, functionName) {
  const results = [];
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      if (!ignoreDirs.includes(file)) {
        results.push(...walkDirectory(filePath, functionName));
      }
    } else if (file.endsWith('.js')) {
      const usages = searchFunctionInFile(filePath, functionName);
      if (usages.length > 0) {
        results.push({
          file: path.relative(srcDir, filePath),
          usages
        });
      }
    }
  }
  return results;
}

console.log('========================================');
console.log('VERIFICANDO USOS DE FUNCIONES EN HELPERS');
console.log('========================================\n');

for (const func of functionsToCheck) {
  console.log(`\n📌 ${func}:`);
  const results = walkDirectory(srcDir, func);
  
  if (results.length === 0) {
    console.log('  ❌ NO SE USA');
  } else {
    for (const result of results) {
      console.log(`  📁 ${result.file}`);
      for (const usage of result.usages) {
        console.log(`     Línea ${usage.line}: ${usage.text.substring(0, 80)}${usage.text.length > 80 ? '...' : ''}`);
      }
    }
  }
}

console.log('\n========================================');
console.log('VERIFICACION COMPLETADA');
console.log('========================================');