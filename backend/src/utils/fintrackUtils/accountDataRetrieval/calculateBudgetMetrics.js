// 🧮 CATEGORY BUDGET METRICS CALCULATOR
// Calculates remaining budget and triggers alert when budget limit is exceeded
const calculateBudgetMetrics = (balanceAccount, budgetAccount)=>{
  const remain = Math.round(parseFloat(budgetAccount) - parseFloat(balanceAccount))
  const statusAlert = remain <=0

  return {remain, statusAlert}
  }