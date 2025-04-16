//determine transaction type from sign of amount and account_type_name.
export const determineTransactionType = (
  account_starting_amount,
  account_type_name
) => {
  let transactionType = 'account-opening';
  let counterTransactionType = 'account-opening';

  if (account_type_name === 'category_budget') {
    return { transactionType, counterTransactionType };
  }

  if (
    account_type_name !== 'debtor' &&
    account_type_name !== 'category_budget'
  ) {
    if (account_starting_amount > 0) {
      transactionType = 'deposit';
      counterTransactionType = 'withdraw';
    }
  } else {
    if (account_type_name === 'debtor' && account_starting_amount > 0) {
      transactionType = 'lend';
      counterTransactionType = 'borrow';
    } else if (account_starting_amount < 0) {
      transactionType = 'borrow';
      counterTransactionType = 'lend';
    }
  }

  return { transactionType, counterTransactionType };
};
