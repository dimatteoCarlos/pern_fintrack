// 🧮 CATEGORY BUDGET METRICS CALCULATOR
// Calculates remaining budget and triggers alert when budget limit is exceeded
//
// DEPRECATED — legacy budget calculation, scheduled for removal (Plan C, C8).
// Do not extend it and do not add callers. The const below is module-local and
// never exported, so importing this file yields nothing. The second copy of the
// same function, in getAccountController.js, is now commented out along with the
// enrichment block that called it, and the only remaining call site,
// getAccountDataById.js, is commented out too.
// It reads the legacy cba.budget column against an account balance with no
// period, which is not what the budget endpoints compute. Replacement:
// GET /api/fintrack/budget/summary.
const calculateBudgetMetrics = (balanceAccount, budgetAccount)=>{
  const remain = Math.round(parseFloat(budgetAccount) - parseFloat(balanceAccount))
  const statusAlert = remain <=0

  return {remain, statusAlert}
  }