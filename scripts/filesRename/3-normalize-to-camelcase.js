// scripts/filesRename/3-normalize-to-camelcase.js
// 🔄 Normalize CSS module files from PascalCase to camelCase (Windows compatible)

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// 📍 Get current directory in ES module context
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 🎯 Navigate to project root (scripts/filesRename/ -> three levels up? Let me calculate)
// scripts/filesRename/3-normalize-to-camelcase.js
// Step 1: scripts/filesRename/
// Step 2: scripts/
// Step 3: project root
const projectRoot = path.resolve(__dirname, "..", "..");
process.chdir(projectRoot);

console.log("🔄 Normalizing CSS modules from PascalCase to camelCase...");
console.log(`📍 Project root: ${projectRoot}`);

// ============================================================
// 📋 STEP 1: Get all tracked .module.css files
// ============================================================
let allFiles = [];
try {
  const output = execSync("git ls-files", { encoding: "utf8" });
  allFiles = output.split("\n").filter(Boolean);
} catch (e) {
  console.error("Error running git ls-files:", e.message);
  process.exit(1);
}

// Filter only .module.css files, exclude node_modules, dist, build
const excludedDirs = ["node_modules", "dist", "build", ".git"];
const moduleCssFiles = allFiles.filter(file => {
  if (!file.endsWith(".module.css")) return false;
  const pathParts = file.split("/");
  return !excludedDirs.some(excluded => pathParts.includes(excluded));
});

console.log(`📦 Found ${moduleCssFiles.length} CSS module files tracked`);

// ============================================================
// 🔍 STEP 2: Detect which files are in PascalCase (first letter uppercase)
// ============================================================
const pascalFiles = moduleCssFiles.filter(file => {
  const fileName = path.basename(file);
  return /^[A-Z]/.test(fileName);
});

console.log(`🔍 Found ${pascalFiles.length} files in PascalCase that need conversion`);

if (pascalFiles.length === 0) {
  console.log("✅ All CSS module files are already in camelCase. Nothing to do.");
  process.exit(0);
}

// Show files to convert
console.log("\n📄 Files to convert:");
pascalFiles.forEach(f => console.log(`   - ${f}`));

// ============================================================
// 🧰 STEP 3: Convert each file using 2-step rename (safe for Windows)
// ============================================================
let convertedCount = 0;
let errorCount = 0;

for (const oldPath of pascalFiles) {
  const fileName = path.basename(oldPath);
  const dirName = path.dirname(oldPath);
  const newFileName = fileName.charAt(0).toLowerCase() + fileName.slice(1);
  const newPath = path.join(dirName, newFileName);
  
  // Skip if already camelCase (safety check)
  if (oldPath === newPath) {
    console.log(`   ⏭️  Skipping ${fileName} (already camelCase)`);
    continue;
  }
  
  const tempPath = path.join(dirName, `temp_${Date.now()}_${convertedCount}_${fileName}`);
  
  try {
    console.log(`   🔄 Renaming: ${fileName} → ${newFileName}`);
    
    // Step 1: rename to temp
    execSync(`git mv "${oldPath}" "${tempPath}"`, { stdio: "pipe" });
    
    // Step 2: rename from temp to final camelCase
    execSync(`git mv "${tempPath}" "${newPath}"`, { stdio: "pipe" });
    
    convertedCount++;
    console.log(`   ✅ Done: ${newFileName}`);
  } catch (e) {
    console.error(`   ❌ Error renaming ${fileName}:`, e.message);
    errorCount++;
  }
}

// ============================================================
// 📊 STEP 4: Summary
// ============================================================
console.log("\n📊 SUMMARY:");
console.log(`   ✅ Successfully converted: ${convertedCount} files`);
if (errorCount > 0) console.log(`   ❌ Errors: ${errorCount} files`);

if (convertedCount > 0) {
  console.log("\n📝 Now run:");
  console.log("   git status");
  console.log("   git commit -m 'refactor(files): normalize CSS modules to camelCase'");
} else if (errorCount === 0) {
  console.log("\n✅ No files needed conversion.");
}

// ============================================================
// 🔍 STEP 5: Show git status for verification
// ============================================================
console.log("\n📊 Current git status:");
try {
  const status = execSync("git status --porcelain", { encoding: "utf8" });
  if (status.trim()) {
    console.log(status);
  } else {
    console.log("   Working tree clean (no changes)");
  }
} catch (e) {
  console.log("   Error getting status");
}