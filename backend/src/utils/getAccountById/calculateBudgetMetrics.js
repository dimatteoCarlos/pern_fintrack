// 🧮 CATEGORY BUDGET METRICS CALCULATOR
const calculateBudgetMetrics = (balanceAccount, budgetAccount)=>{
  const remain = Math.round(parseFloat(budgetAccount) - parseFloat(balanceAccount))
  const statusAlert = remain <=0

  return {remain, statusAlert}
  }