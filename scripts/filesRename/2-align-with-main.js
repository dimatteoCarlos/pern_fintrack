// scripts/filesRename/2-align-with-main.js
// 🔄 Align feat/vercel-serverless with main (PascalCase) - Windows compatible

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// 📍 Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 🎯 Navigate to project root
const projectRoot = path.resolve(__dirname, "..", "..");
process.chdir(projectRoot);

console.log("🔄 Aligning feat branch with main casing...");
console.log(`📍 Project root: ${projectRoot}`);

// ============================================================
// 📋 STEP 1: Define the 7 conflicting files
// ============================================================
const conflicts = [
  {
    camelFile: "frontend/src/assets/fintrackDemo.png",
    pascalFile: "frontend/src/assets/fintrackDemo.PNG"
  },
  {
    camelFile: "frontend/src/auth/components/formUIComponents/styles/inputField.module.css",
    pascalFile: "frontend/src/auth/components/formUIComponents/styles/InputField.module.css"
  },
  {
    camelFile: "frontend/src/auth/components/formUIComponents/styles/loadingSpinner.module.css",
    pascalFile: "frontend/src/auth/components/formUIComponents/styles/LoadingSpinner.module.css"
  },
  {
    camelFile: "frontend/src/auth/components/formUIComponents/styles/resetButton.module.css",
    pascalFile: "frontend/src/auth/components/formUIComponents/styles/ResetButton.module.css"
  },
  {
    camelFile: "frontend/src/auth/components/formUIComponents/styles/selectField.module.css",
    pascalFile: "frontend/src/auth/components/formUIComponents/styles/SelectField.module.css"
  },
  {
    camelFile: "frontend/src/auth/components/formUIComponents/styles/submitButton.module.css",
    pascalFile: "frontend/src/auth/components/formUIComponents/styles/SubmitButton.module.css"
  },
  {
    camelFile: "frontend/src/auth/components/formUIComponents/styles/userForms.module.css",
    pascalFile: "frontend/src/auth/components/formUIComponents/styles/UserForms.module.css"
  }
];

// ============================================================
// 🔍 STEP 2: Check which files exist and need alignment
// ============================================================
let filesToProcess = [];

for (const conflict of conflicts) {
  const camelExists = fs.existsSync(conflict.camelFile);
  const pascalExists = fs.existsSync(conflict.pascalFile);
  
  if (camelExists && !pascalExists) {
    filesToProcess.push(conflict);
    console.log(`📄 Need to align: ${conflict.camelFile} → ${conflict.pascalFile}`);
  } else if (camelExists && pascalExists) {
    console.log(`⚠️ Both exist: ${conflict.camelFile} and ${conflict.pascalFile} - manual intervention needed`);
  } else if (!camelExists && pascalExists) {
    console.log(`✅ Already aligned: ${conflict.pascalFile}`);
  } else {
    console.log(`❓ Neither file found: ${conflict.camelFile}`);
  }
}

if (filesToProcess.length === 0) {
  console.log("✅ No files need alignment. Ready to checkout main.");
  process.exit(0);
}

console.log(`\n🔄 Processing ${filesToProcess.length} files...`);

// ============================================================
// 🧰 STEP 3: Add files to git and rename using 2-step process
// ============================================================
for (const file of filesToProcess) {
  const camelPath = file.camelFile;
  const pascalPath = file.pascalFile;
  const tempPath = `${path.dirname(camelPath)}/temp_${Date.now()}_${path.basename(camelPath)}`;
  
  try {
    // Step 1: Add the untracked file to git
    execSync(`git add -f "${camelPath}"`);
    console.log(`   Added: ${camelPath}`);
    
    // Step 2: 2-step rename to PascalCase
    execSync(`git mv "${camelPath}" "${tempPath}"`);
    execSync(`git mv "${tempPath}" "${pascalPath}"`);
    console.log(`   Renamed: ${path.basename(camelPath)} → ${path.basename(pascalPath)}`);
  } catch (e) {
    console.error(`   Error processing ${camelPath}:`, e.message);
  }
}

// ============================================================
// ✅ STEP 4: Verify the alignment
// ============================================================
console.log("\n📊 Alignment complete. New status:");
try {
  const status = execSync("git status --porcelain", { encoding: "utf8" });
  console.log(status);
} catch (e) {
  console.log("Error getting status");
}

console.log("\n✅ Alignment complete. Now run:");
console.log("   git commit -m 'fix(casing): align with main (PascalCase) - temporary'");
console.log("   git checkout main");