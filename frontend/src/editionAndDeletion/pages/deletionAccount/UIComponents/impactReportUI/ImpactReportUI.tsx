//frontend/src/editionAndDeletion/pages/deletionAccount/UIComponents/loadingReportUI/impactReportUI/ImpactReportUI.ts/

//currency should be configured as a global state
import { DEFAULT_CURRENCY } from '../../../../../helpers/constants.ts';

import { ImpactReportRowType } from '../../../../types/deletionTypes.ts'

import {  DictionaryDataType, } from '../../../../utils/languages.ts';

import './impactReportUI.css'

//-------------------------------
//TYPES DEFINITION AND IMPORT
type ImpactReportUIPropsType ={
 report:ImpactReportRowType[];
 // language?:LanguageKeyType;
 t:(key:keyof DictionaryDataType )=>string
}

//=============================
// UI COMPONENT: ImpactReportUI
//=============================
const ImpactReportUI = ({
 report,
 t

}:ImpactReportUIPropsType) => {

 const totalNetAdjustment = report.reduce((total,row)=>(total+row.affectedAccountNetAdjustmentAmount), 0)

//Replace {count}
 const formatImpactReportTitle = (title:string)=>(title.replace('{count}',report.length.toString()))

//---------
//RENDER
 return (
  <div className="impact-report-container ">
   <div className="impact-report-warning bordered">

    <p className="impact-warning-title ">
      {formatImpactReportTitle(t( 'impactDetectedTitle'))}
    </p>
    <p className="impact-warning-message">{t('impactDetectedMessage')}</p>
   </div>

    <div className="impact-report-table-wrapper">
    <table className="impact-report-table"
     aria-label={t('tableOfAffectedAccountsDetails')}
     >
     <thead>
      <tr>
       <th>{t('affectedAccountColumn')}</th>
       <th>{t('currentBalanceColumn')}</th>
       <th>{t('newBalanceColumn')}</th>
       <th>{t('netAdjustmentColumn')}</th>
       <th>{t('affectedAccountTypeColumn')}</th>
      </tr> 
    </thead> 
    <tbody>
     {
      report.map((row)=>(
       // INCLUIRE UN HOVER QUE CAMBIE EL BACKGROUND A GRIS CLARO DE LA LINEA ROW O TR.
       <tr key={row.affectedAccountId}>
        <td className="account-name">
         {row.affectedAccountName} 
         </td> 

        <td className="current-balance">{row.affectedAccountCurrentBalance.toFixed(2)} {row.affectedAccountCurrencyCode}
        </td> 

        <td className="new-balance">
        {(row.affectedAccountCurrentBalance + row.affectedAccountNetAdjustmentAmount).toFixed(2)} {row.affectedAccountCurrencyCode}
        </td>
        
        <td className={`net-adjustment
        ${row.affectedAccountNetAdjustmentAmount >=0 ?'positive':'negative'}` 
         }>
          {row.affectedAccountNetAdjustmentAmount.toFixed(2)} {row.affectedAccountCurrencyCode}
        </td>
        
        <td className="account-type">{t(`${row.affectedAccountType as keyof DictionaryDataType}`)}</td> 
      </tr> 
      ))
     }

    </tbody>
   </table>
  </div>

  <p className="impact-report-total">
   {t('totalNetAdjustment')}
   <span className={`total-amount ${totalNetAdjustment > 0 ? 'positive': 'negative'}`}>
    {totalNetAdjustment.toFixed(2)} {DEFAULT_CURRENCY}
   </span>
  </p>
 </div>
  )
}

ImpactReportUI.propTypes = {}

export default ImpactReportUI