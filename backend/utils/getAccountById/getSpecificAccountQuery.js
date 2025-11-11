/**
 * 🗂️ GENERA QUERIES ESPECÍFICAS POR TIPO DE CUENTA
 */
const getSpecificAccountQuery = (accountType, userId, accountId) => {
  const queries = {
    category_budget: {
      text: `SELECT ua.*, act.*, cba.*, ct.currency_code, cnt.category_nature_type_name
             FROM user_accounts ua
             JOIN account_types act ON ua.account_type_id = act.account_type_id
             JOIN currencies ct ON ua.currency_id = ct.currency_id
             JOIN category_budget_accounts cba ON ua.account_id = cba.account_id
             JOIN category_nature_types cnt ON cba.category_nature_type_id = cnt.category_nature_type_id
             WHERE ua.user_id = $1 AND ua.account_id = $2`,
      values: [userId, accountId]
    },
    pocket_saving: {
      text: `SELECT ua.*, act.account_type_name, ct.currency_code, ps.* 
             FROM user_accounts ua
             JOIN account_types act ON ua.account_type_id = act.account_type_id
             JOIN currencies ct ON ua.currency_id = ct.currency_id
             JOIN pocket_saving_accounts ps ON ua.account_id = ps.account_id
             WHERE ua.user_id = $1 AND ua.account_id = $2`,
      values: [userId, accountId]
    },
    debtor: {
      text: `SELECT ua.*, act.account_type_name, ct.currency_code, da.*
             FROM user_accounts ua
             JOIN account_types act ON ua.account_type_id = act.account_type_id
             JOIN currencies ct ON ua.currency_id = ct.currency_id
             JOIN debtor_accounts da ON ua.account_id = da.account_id
             WHERE ua.user_id = $1 AND ua.account_id = $2`,
      values: [userId, accountId]
    }
  };

  return queries[accountType];
};