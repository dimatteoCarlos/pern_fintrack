import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

// Obtener el directorio actual
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ajusta esto si tu root no es frontend
const ROOT_DIR = path.resolve(__dirname, '../..');
const SRC_DIR = path.join(ROOT_DIR, 'src');

// Extensiones a analizar
const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];

// Cambiar al directorio frontend (donde está src/)

const frontendDir = path.resolve(__dirname, '../..');
process.chdir(frontendDir);

const filesToVerify = [
  'svg.d.ts',
  'src/tests/Tests.tsx',
  'src/assets/auth/GoogleLogo.tsx',
  'src/auth/auth_utils/navigationHelper.ts',
  'src/auth/auth_utils/transformFromApiToFormErrors.ts',
  'src/auth/hooks/useCallbackDebounce.ts',
  'src/auth/hooks/useSuccessAutoClose.ts',
  'src/fintrack/hooks/useAutoClose.ts',
  'src/fintrack/hooks/useClickOutside.ts',
  'src/fintrack/hooks/useEscapeKey.ts',
  'src/fintrack/hooks/useFetchPost.tsx',
  'src/auth/validation/hook/useAuthValidation.ts',
  'src/fintrack/editionAndDeletion/hooks/useAutoClose.ts',
  'src/fintrack/editionAndDeletion/hooks/useEscapeKey.ts',
  'src/fintrack/editionAndDeletion/types/editionTypes.ts',
  'src/fintrack/editionAndDeletion/utils/debounce.ts',
  'src/fintrack/components/summaryDetailBox/SummaryDetailBox.tsx',
  'src/fintrack/loader/spin/SpinLoader.tsx',
  'src/fintrack/pages/error/NotFoundPage.tsx',
  'src/fintrack/validations/inputConstraints/inputConstraintsTypes.ts',
  'src/fintrack/pages/overview/components/SeeMore.tsx',
  'src/fintrack/components/languageSelector/LanguageSelector.tsx',
  'src/fintrack/account/UIComponents/loadingReportUI/LoadingUI.tsx',
  'src/fintrack/components/successMessageUI/SuccessMessageUI.tsx',
];

function searchInFile(filePath, searchTerm) {
  try {
    // Usar comillas dobles para Windows
    const cmd = `findstr /s /i /m /c:"${searchTerm}" "src\\*.ts" "src\\*.tsx" "src\\*.js" "src\\*.jsx" 2>nul`;
    const result = execSync(cmd, { encoding: 'utf8', shell: 'cmd.exe' });
    const lines = result.split('\n').filter((l) => l.trim());
    // Excluir el propio archivo si aparece
    const normalizedFilePath = filePath.replace(/\\/g, '/');
    return lines.some((line) => !line.includes(normalizedFilePath));
  } catch (e) {
    return false;
  }
}

function analyzeFile(filePath) {
  const fullPath = path.join(process.cwd(), filePath);

  if (!fs.existsSync(fullPath)) {
    return { file: filePath, exists: false, recommendation: 'NOT_FOUND' };
  }

  console.log(`\n🔍 Analizando: ${filePath}`);

  const fileName = path.basename(filePath, path.extname(filePath));

  // Búsqueda en 3 niveles
  const importUsage = searchInFile(filePath, `from.*${fileName}`);

  const exportUsage = searchInFile(filePath, `export.*${fileName}`);

  const directUsage = searchInFile(filePath, fileName);

  const isUsed = importUsage || exportUsage || directUsage;

  let recommendation = '';
  let reasons = [];

  if (!isUsed) {
    recommendation = 'SAFE_TO_ARCHIVE';
    reasons.push('No se encontró ninguna referencia a este archivo');
  } else if (importUsage) {
    recommendation = 'KEEP';
    reasons.push('El archivo es importado en otro lugar');
  } else if (exportUsage) {
    recommendation = 'REVIEW';
    reasons.push('Exporta elementos que podrían usarse');
  } else if (directUsage) {
    recommendation = 'REVIEW';
    reasons.push('El nombre del archivo aparece en otro lugar');
  }

  return {
    file: filePath,
    exists: true,
    isUsed,
    recommendation,
    reasons,
    metrics: { importUsage, exportUsage, directUsage },
  };
}

function generateReport(results) {
  const reportPath = path.join(
    __dirname,
    '../verification_reports/verification-report.json',
  );

  // Asegurar que el directorio existe
  const reportDir = path.dirname(reportPath);
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total: results.length,
      exists: results.filter((r) => r.exists).length,
      notFound: results.filter((r) => !r.exists).length,
      used: results.filter((r) => r.isUsed).length,
      unused: results.filter((r) => r.exists && !r.isUsed).length,
    },
    results: results,
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(
    `\n📊 Reporte guardado en: archived/verification_reports/verification-report.json`,
  );

  // Mostrar resumen
  console.log('\n📈 RESUMEN:');
  console.log(`✅ Archivos en uso: ${report.summary.used}`);
  console.log(`❌ No usados (seguro archivar): ${report.summary.unused}`);
  console.log(`⚠️  No encontrados: ${report.summary.notFound}`);

  console.log('\n🏷️ ARCHIVOS SEGUROS PARA ARCHIVAR:');
  report.results
    .filter((r) => r.recommendation === 'SAFE_TO_ARCHIVE')
    .forEach((r) => console.log(`  - ${r.file}`));

  return report;
}

// Ejecutar
console.log('🚀 INICIANDO VERIFICACIÓN DE ARCHIVOS NO USADOS');
console.log('===============================================\n');

const results = filesToVerify.map(analyzeFile);
const report = generateReport(results);

console.log('\n✨ Verificación completada');
console.log('📁 Revisa archived/verification_reports/verification-report.json');

/**
explicame suscinta y brevemente: que es, que hace, y la sintaxis, y cuando se usa de: child_process, fileURLToPath(import.meta.url...,  path.resolve(__dirname, '../..');
process.chdir(frontendDir);,findstr /s /i /m /c:",  src\\*.ts" "src\\*.tsx" "src\\*.js" "src\\*.jsx" 2>nul., execSync(cmd, { encoding: 'utf8', shell: 'cmd.exe' });, que se refleja dentro de result?. ,  path.basename(filePath, path.extname(filePath)),   error: 'process' is not defined.. 'report' is assigned a value but never used., node archived/scripts/verify-unused-files.mjs
node:internal/modules/cjs/loader:1247
  throw err;
  ^

Error: Cannot find module 'C:\AA1-WEB_DEVELOPER\REACT\apps\FINTRACK\pern_fintrack\frontend\archived\scripts\verify-unused-files.mjs'
    at Function._resolveFilename (node:internal/modules/cjs/loader:1244:15)
    at Function._load (node:internal/modules/cjs/loader:1070:27)
    at TracingChannel.traceSync (node:diagnostics_channel:322:14)
    at wrapModuleLoad (node:internal/modules/cjs/loader:217:24)
    at Function.executeUserEntryPoint [as runMain] (node:internal/modules/run_main:170:5)
    at node:internal/main/run_main_module:36:49 {
  code: 'MODULE_NOT_FOUND',
  requireStack: []
}

Node.js v22.13.1, explica que hay que hacer, no escribas mas codigo.
 */

/**
Explicación breve de cada elemento:
1. child_process
Qué es: Módulo nativo de Node.js para ejecutar comandos del sistema operativo

Qué hace: Permite correr comandos de terminal (como findstr, grep, ls, etc.) desde JavaScript

Sintaxis: import { execSync } from 'child_process'

Cuándo se usa: Cuando necesitas buscar archivos, ejecutar scripts del sistema, o integrar herramientas externas

2. fileURLToPath(import.meta.url)
Qué es: Convierte una URL de archivo a una ruta de sistema operativo

Qué hace: import.meta.url da la ubicación del archivo actual como URL (file:///C:/ruta/archivo.mjs), y fileURLToPath la convierte a C:\ruta\archivo.mjs

Sintaxis: const __filename = fileURLToPath(import.meta.url)

Cuándo se usa: En módulos ES (.mjs) para obtener la ruta del directorio actual (reemplaza a __dirname de CommonJS)

3. path.resolve(__dirname, '../..')
Qué es: Normaliza y resuelve rutas relativas a absolutas

Qué hace: Convierte '../..' (subir dos niveles) en una ruta completa desde __dirname

Sintaxis: path.resolve('/a/b/c', '../../d') → '/a/d'

Cuándo se usa: Para navegar entre directorios de forma segura sin importar el sistema operativo

4. process.chdir(frontendDir)
Qué es: Cambia el directorio de trabajo actual del proceso Node.js

Qué hace: Como hacer cd en terminal, pero desde código

Sintaxis: process.chdir('/nueva/ruta')

Cuándo se usa: Cuando necesitas ejecutar comandos relativos a otra carpeta

5. findstr /s /i /m /c:"texto" "src\\*.ts"
Qué es: Comando de Windows para buscar texto en archivos

Qué hace:

/s: busca en subdirectorios

/i: case-insensitive

/m: muestra solo nombres de archivo (no el contenido)

/c:"texto": busca el texto exacto

Sintaxis: findstr /s /i /m "patrón" "*.ts"

Cuándo se usa: En Windows para buscar imports o usos de archivos

6. execSync(cmd, { encoding: 'utf8', shell: 'cmd.exe' })
Qué es: Ejecuta un comando de forma síncrona (espera el resultado)

Qué hace: Corre el comando y devuelve la salida como string

Sintaxis: const resultado = execSync('dir', { encoding: 'utf8' })

Cuándo se usa: Cuando necesitas el resultado inmediato del comando para procesarlo

7. Qué refleja result
Contiene todo el texto que el comando imprimiría en la terminal

Para findstr: lista de nombres de archivo que contienen el texto buscado

Ejemplo: "src/App.tsx\nsrc/main.tsx"

8. path.basename(filePath, path.extname(filePath))
Qué hace: Extrae el nombre del archivo sin extensión

Ejemplo: path.basename('src/hooks/useAuth.ts', '.ts') → 'useAuth'

Cuándo se usa: Para buscar solo el nombre sin la extensión

9. Error: 'process' is not defined
Causa: En algunos entornos (Vite, browser) process no existe

Solución: Asegurar que ejecutas con Node.js, no con un bundler

10. Error: 'report' is assigned but never used
Qué es: Advertencia de ESLint (no un error real)

Qué significa: Declaraste una variable pero no la usaste

Se puede ignorar: No afecta la ejecución

11. Error: MODULE_NOT_FOUND
Qué significa: Node.js no encontró el archivo que intentas ejecutar

Causa: El archivo verify-unused-files.mjs no existe en esa ruta

Qué hacer:

Verifica que creaste el archivo exactamente en frontend/archived/scripts/verify-unused-files.mjs
Confirma que el nombre es exactamente igual (mayúsculas/minúsculas)
Lista el contenido de la carpeta: dir archived\scripts\
Si no existe, créalo con el código que te proporcioné
Resumen: El error solo significa que el archivo no está creado físicamente en tu disco. Crea los archivos .mjs con el código que te di en las ubicaciones correctas y luego ejecuta de nuevo.


 */

/**
 * Voy directo y sin ruido, como pediste:

---

## 🧩 1. ¿Qué es cada cosa?

### 🔹 `child_process`

* **Qué es:** módulo nativo de Node.js
* **Qué hace:** ejecuta comandos del sistema (como si estuvieras en terminal)
* **Uso típico:** correr `findstr`, `git`, `ls`, etc.

---

### 🔹 `fileURLToPath(import.meta.url)`

* **Qué es:** conversor de URL → ruta de archivo
* **Qué hace:** transforma
  `file:///C:/ruta/app.mjs` → `C:\ruta\app.mjs`
* **Uso:** obtener la ruta del archivo actual en ES Modules (.mjs)

---

### 🔹 `path.resolve(__dirname, '../..')`

* **Qué es:** resolvedor de rutas absolutas
* **Qué hace:** sube 2 niveles desde `__dirname`
* **Uso:** navegar carpetas de forma segura

---

### 🔹 `process.chdir(frontendDir)`

* **Qué es:** cambio de directorio del proceso
* **Qué hace:** equivalente a hacer `cd` en terminal
* **Uso:** ejecutar comandos relativos a otra carpeta

---

### 🔹 `findstr /s /i /m /c:"..." "src\\*.ts"...`

* **Qué es:** buscador de texto en Windows
* **Qué hace:**

  * `/s` → subcarpetas
  * `/i` → ignora mayúsculas
  * `/m` → solo nombres de archivos
  * `/c:` → texto exacto
* **Uso:** detectar imports/usos en código

---

### 🔹 `execSync(cmd, { encoding: 'utf8', shell: 'cmd.exe' })`

* **Qué es:** ejecutor síncrono de comandos
* **Qué hace:** corre el comando y devuelve su salida como string
* **Uso:** cuando necesitas el resultado inmediatamente

---

### 🔹 `result`

* **Qué contiene:** salida del comando
* En tu caso (`findstr`):
  👉 lista de archivos donde aparece el texto

  ```
  src/App.tsx
  src/hooks/useX.ts
  ```

---

### 🔹 `path.basename(filePath, path.extname(filePath))`

* **Qué hace:** obtiene nombre sin extensión
* Ejemplo:
  `src/test/useAuth.ts` → `useAuth`

---

## ⚠️ 2. Errores y qué significan

### ❌ `'process' is not defined`

* **Causa:** estás ejecutando en entorno browser/Vite
* **Realidad:** `process` solo existe en Node.js
* **Qué hacer:**

  * Ejecuta con Node (no desde React/Vite)
  * No importes este script en frontend

---

### ⚠️ `'report' is assigned but never used`

* **Qué es:** warning de ESLint
* **No rompe nada**
* Puedes ignorarlo o usar la variable

---

### ❌ `MODULE_NOT_FOUND`

```
Cannot find module '...verify-unused-files.mjs'
```

* **Qué significa:** el archivo **NO existe en esa ruta**

* **Causas típicas:**

  1. Ruta incorrecta
  2. Archivo no creado
  3. Nombre mal escrito
  4. Extensión incorrecta (`.js` vs `.mjs`)

---

## ✅ 3. Qué tienes que hacer (esto es lo importante)

1. **Verifica físicamente el archivo**

   * Debe existir en:

     ```
     frontend/archived/scripts/verify-unused-files.mjs
     ```

2. **Confirma el nombre EXACTO**

   * `verify-unused-files.mjs`
   * cuidado con:

     * mayúsculas
     * `.js` vs `.mjs`

3. **Ejecuta desde la carpeta correcta**

   * Estás en `frontend/`
   * o usa la ruta correcta relativa

4. **Lista la carpeta para validar**

   * Si no aparece → no existe realmente

5. **Asegúrate que es Node**

   * No correr dentro de React/Vite
   * Esto es un script backend/tooling

---

## 🧠 Conclusión clara

* Tu script está **bien conceptualmente**
* El problema **NO es el código**
* El problema es **filesystem + ejecución**

👉 Node te está diciendo: *“ese archivo no existe ahí”*
 */
