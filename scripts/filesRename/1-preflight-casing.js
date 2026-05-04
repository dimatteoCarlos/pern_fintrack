//scripts/filesRename/1-preflight-casing.js
 // scripts/preflight-casing.js
//node scripts/filesRename/1-preflight-casing.js

// 🔍 Preflight validation before any casing changes (Windows compatible)

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// 📍 Get current directory in ES module context
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 🎯 Navigate to project root (scripts/filesRename/ -> two levels up)
const projectRoot = path.resolve(__dirname, "..", "..");
process.chdir(projectRoot);

console.log("🔍 Preflight: detecting potential casing issues...");
console.log(`📍 Project root: ${projectRoot}`);

// ============================================================
// 📄 STEP 1: Get ALL tracked CSS files using git ls-files (native, no grep)
// ============================================================
let allFiles = [];
try {
  const output = execSync("git ls-files", { encoding: "utf8" });
  allFiles = output.split("\n").filter(Boolean);
} catch (e) {
  console.error("Error running git ls-files:", e.message);
  process.exit(1);
}

// Filter CSS files (.css or .module.css) using JavaScript (Windows compatible)
const allCssFiles = allFiles.filter(file => 
  file.endsWith(".css") || file.endsWith(".module.css")
);

// ============================================================
// 🚫 STEP 2: Exclude node_modules, dist, build folders
// ============================================================
const excludedDirs = ["node_modules", "dist", "build", ".git"];
const filteredCssFiles = allCssFiles.filter(file => {
  const pathParts = file.split("/");
  return !excludedDirs.some(excluded => pathParts.includes(excluded));
});

console.log(`📄 Found ${filteredCssFiles.length} tracked CSS files (excluding node_modules, dist, build)`);

// ============================================================
// 🗂️ STEP 3: Detect files with PascalCase names (first letter uppercase)
// ============================================================
const pascalFiles = filteredCssFiles.filter(file => {
  const fileName = path.basename(file);
  return /^[A-Z]/.test(fileName);
});

if (pascalFiles.length === 0) {
  console.log("✅ No CSS files with PascalCase names found.");
} else {
  console.log(`⚠️ Found ${pascalFiles.length} CSS files with PascalCase names:`);
  // Show first 20 to avoid flooding console
  const toShow = pascalFiles.slice(0, 20);
  toShow.forEach(f => console.log(`   - ${f}`));
  if (pascalFiles.length > 20) {
    console.log(`   ... and ${pascalFiles.length - 20} more`);
  }
}

// ============================================================
// 📝 STEP 4: Detect CSS module files (.module.css)
// ============================================================
const moduleCssFiles = filteredCssFiles.filter(file => file.endsWith(".module.css"));
console.log(`📦 Found ${moduleCssFiles.length} CSS module files`);

// ============================================================
// 🔍 STEP 5: Detect PascalCase within module.css files specifically
// ============================================================
const pascalModuleFiles = moduleCssFiles.filter(file => {
  const fileName = path.basename(file);
  return /^[A-Z]/.test(fileName);
});

if (pascalModuleFiles.length > 0) {
  console.log(`⚠️ PascalCase in CSS module files (critical for imports):`);
  pascalModuleFiles.forEach(f => console.log(`   - ${f}`));
}

// ============================================================
// 🔎 STEP 6: Find imports of CSS modules in source files
// ============================================================
let importFiles = [];
try {
  // Use findstr (Windows native) instead of grep
  const output = execSync('git grep -l "import.*\\.module\\.css"', { encoding: "utf8" });
  importFiles = output.split("\n").filter(Boolean);
} catch (e) {
  // git grep returns exit code 1 when no matches - this is OK
  if (!e.message.includes("exited with code 1")) {
    console.log("⚠️ No CSS module imports found or error running git grep");
  }
}

console.log(`📝 Found ${importFiles.length} files importing CSS modules`);

// ============================================================
// 🌿 STEP 7: Verify current branch
// ============================================================
let branch = "";
try {
  branch = execSync("git branch --show-current", { encoding: "utf8" }).toString().trim();
  console.log(`📍 Current branch: ${branch}`);
} catch (e) {
  console.error("Error getting current branch:", e.message);
  process.exit(1);
}

// ============================================================
// 🧹 STEP 8: Check for uncommitted changes
// ============================================================
const status = execSync("git status --porcelain", { encoding: "utf8" }).toString().trim();
if (status !== "") {
  console.error("❌ There are uncommitted changes. Commit or stash before running preflight.");
  console.error(status);
  process.exit(1);
}

// ============================================================
// 📊 STEP 9: Summary
// ============================================================
console.log("\n📊 SUMMARY:");
console.log(`   Total CSS files tracked: ${filteredCssFiles.length}`);
console.log(`   CSS module files: ${moduleCssFiles.length}`);
console.log(`   PascalCase CSS files (any): ${pascalFiles.length}`);
console.log(`   PascalCase CSS module files: ${pascalModuleFiles.length}`);
console.log(`   Files importing CSS modules: ${importFiles.length}`);

// ============================================================
// ✅ STEP 10: Final validation
// ============================================================
if (pascalModuleFiles.length > 0) {
  console.log("\n⚠️ WARNING: PascalCase CSS module files detected.");
  console.log("   These will cause import conflicts between branches.");
  console.log("   Proceed with alignment phase.");
} else {
  console.log("\n✅ No PascalCase CSS module conflicts detected.");
}

console.log("\n✅ Preflight passed. Ready to proceed.");