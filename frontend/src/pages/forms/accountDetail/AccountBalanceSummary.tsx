//AccountBalanceSummary.tsx
import { AccountSummaryBalanceType } from '../../../types/responseApiTypes';
import { currencyFormat, formatDateToDDMMYYYY } from '../../../helpers/functions';
import './styles/accountBalanceSummary-styles.css'

type AccountBalanceSummaryPropsType = {
  summaryAccountBalance:AccountSummaryBalanceType
}

const AccountBalanceSummary = ({summaryAccountBalance}:AccountBalanceSummaryPropsType) => {
const {initialBalance, finalBalance }=summaryAccountBalance

  return (
   <div className="balance-summary__container">
      <div className="balance-summary__item">
        <span className="balance-summary__label">Initial Balance</span>
        <span className="balance-summary__value">
         {currencyFormat(initialBalance.currency,initialBalance.amount)}
        </span>
        <span className="balance-summary__date">
          ({formatDateToDDMMYYYY(initialBalance.date)})
        </span>
      </div>

      <div className="balance-summary__item border-left ">
        <span className="balance-summary__label">Final Balance</span>
        <span className="balance-summary__value">
         {currencyFormat(finalBalance.currency,finalBalance.amount)}
        </span>
        <span className="balance-summary__date">
          ({formatDateToDDMMYYYY(finalBalance.date)})
        </span>
      </div>
    </div>
  )
}

export default AccountBalanceSummary