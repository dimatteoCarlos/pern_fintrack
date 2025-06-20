
const AccountTransactionsList: React.FC<AccountTransactionsListProps> = ({ transactions }) => {
  return (
    <>
      <div className="list__main__container">
        {transactions.length > 0 ? (
          transactions.map((transaction, indx) => {
            const {
              movement_type_name,
              amount,
              currency_code,
              transaction_actual_date,
              description,
              account_balance_after_tr,
            } = transaction;

            // Convert amount and balance to numbers for formatting
            const parsedAmount = parseFloat(amount);
            const parsedBalanceAfterTr = parseFloat(account_balance_after_tr);

            return (
              <BoxContainer key={indx} className="transaction-item">
                {/* Encabezado: Movement Type, Amount y Date */}
                <BoxRow className="transaction-header">
                  <div className="box__title transaction-movement-type">
                    {capitalize(movement_type_name)}
                  </div>
                  <div className="box__title transaction-amount">
                    {currencyFormat(currency_code, parsedAmount, formatNumberCountry)}
                  </div>
                  
                  <div className="box__subtitle transaction-date">
                    {formatDateToDDMMYYYY(transaction_actual_date)}
                  </div>
                </BoxRow>

                {/* Descripción */}
                <BoxRow>
                  <div
                    className="box__subtitle transaction-description"
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: '200',
                      lineHeight: '1rem',
                      letterSpacing: '1px',
                      textTransform: 'none',
                    }}
                  >
                    {truncateText(capitalize(description), 150)}
                  </div>
                </BoxRow>

                {/* Balance después de la transacción */}
                <BoxRow>
                  <div className="box__subtitle transaction-balance-after">
                    Balance After Transaction:{' '}
                    {currencyFormat(
                      currency_code,
                      parsedBalanceAfterTr,
                      formatNumberCountry
                    )}
                  </div>
                </BoxRow>
                {/* This is the dashed line separator between transactions */}
                <div className="transaction-separator"></div>
              </BoxContainer>
            );
          })
        ) : (
          <p className="no-transactions">No transactions found for this period.</p>
        )}
      </div>
    </>
  );
};

export default AccountTransactionsList;