export function prepareTransactionOption(
  accountInfo,
  source_account_id,
  destination_account_id,
  movement_type_id
) {
  console.log('userId from prepare:', accountInfo.user_id);

  return {
    userId: accountInfo.user_id,
    description: accountInfo.description,
    transaction_type_id: accountInfo.transaction_type_id, 
    amount: accountInfo.amount, //initial balance
    currency_id: accountInfo.currency_id,
    account_id: accountInfo.account_id,
    source_account_id,
    destination_account_id,
    movement_type_id,
    status: 'complete',
    transaction_actual_date: accountInfo.transaction_actual_date,
    account_balance:accountInfo.account_balance 
  };
}
