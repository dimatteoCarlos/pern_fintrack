//AccountTransactionsList.tsx

import { BoxContainer, BoxRow } from "../../../general_components/boxComponents";
import { CURRENCY_OPTIONS, DATE_TIME_FORMAT_DEFAULT, DEFAULT_CURRENCY } from "../../../helpers/constants";
import { capitalize, currencyFormat,  isDateValid,  } from "../../../helpers/functions";
import { AccountTransactionType } from "../../../types/responseApiTypes";
import './styles/accountTransactionsList-styles.css'
 
 // Configuración por defecto / default config
 const defaultCurrency = DEFAULT_CURRENCY;
 const formatNumberCountry = CURRENCY_OPTIONS[defaultCurrency];
 
 type AccountTransactionsListPropsType = {
   transactions:AccountTransactionType[]
  }
  //-----------------
 const AccountTransactionsList = ({
  transactions}:AccountTransactionsListPropsType) => {
   const formatDate = (dateInput: Date | string | number): string => {
     const date = new Date(dateInput);
     return new Intl.DateTimeFormat(DATE_TIME_FORMAT_DEFAULT).format(date);
   };
 
   return (
     <>
       <div className='list__main__container'>
         {transactions.length>0?transactions.map((item, indx) => {const {movement_type_name, amount,  currency_code,transaction_actual_date,description,account_balance_after_tr  } = item;

           return (
             <BoxContainer key={indx} className='transaction-item'> 
               <BoxRow className="transaction-header">
                 <div className='box__title transaction-movement-type'>{capitalize(movement_type_name)}</div>
   
                 {transaction_actual_date && isDateValid(transaction_actual_date) && (
                   <div className='box__subtitle'>{formatDate(transaction_actual_date)}</div>
                 )}

                 <div className='box__title'
                 style={{marginLeft:'0.8rem'}}
                 >
                   {currencyFormat(currency_code, amount, formatNumberCountry)}
                 </div>
               </BoxRow>
            {/* Description */}
            <BoxRow>
              <BoxRow>
                
          {description && (
            <div className='box__subtitle' style={{ fontSize: '0.75rem', fontWeight: '200', lineHeight: '1rem', letterSpacing: '1px' }}>

            <div className='paragraph'>
              {capitalize(description.split('Date:')[0] || '').trim()}
            </div>

            <div className='paragraph'>
              Date: {(description.split('Date:')[1] || '').split('GMT')[0].trim()}
            </div>
      </div>
)}


              </BoxRow>
            </BoxRow>

            {/* Balance after transacción */}
                <BoxRow>
                  <div className="box__title transaction-balance-afterx">
                    Balance:{' '}
                    {currencyFormat(
                    currency_code,
                     account_balance_after_tr,
                      formatNumberCountry
                    )}
                  </div>
                </BoxRow>
            </BoxContainer>
           );
         })
        :(
            <p className="no-transactions">No transactions found</p>)
            }
       </div>
     </>
   );
 }

export default AccountTransactionsList