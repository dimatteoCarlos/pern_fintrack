// prepareTransactionOption.js
// Prepares a standardized transaction option object for database insertion
// Maps account information to the required transaction record structure

export function prepareTransactionOption(
  accountInfo,
  source_account_id,
  destination_account_id,
  movement_type_id
) {
  // console.log('userId from prepare:', accountInfo.user_id);

  const option = {
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

// Propagate FX metadata if present
  if (accountInfo.original_amount !== undefined) {
    option.original_amount = accountInfo.original_amount;
    option.original_currency_id = accountInfo.original_currency_id;
    option.exchange_rate = accountInfo.exchange_rate;
    option.exchange_rate_source = accountInfo.exchange_rate_source;
    option.exchange_rate_timestamp = accountInfo.exchange_rate_timestamp;
    option.exchange_rate_target_currency_id = accountInfo.exchange_rate_target_currency_id;
  }
 return option;
}
