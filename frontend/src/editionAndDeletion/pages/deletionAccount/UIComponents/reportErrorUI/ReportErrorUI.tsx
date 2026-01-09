//frontend/src/editionAndDeletion/pages/deletionAccount/UIComponents/reportErrorUI/ReportErrorUI.tsx

import { DictionaryDataType } from "../../../../utils/languages";

import './ReportErrorUI.css';

//TYPE DEFINITIONS
type ReportErrorUIPropType ={
 errorMessage:string;
 t:(keyText:keyof DictionaryDataType)=>string;
}

const ReportErrorUI = ({errorMessage,t}:ReportErrorUIPropType) => {
 return (
<div className="report-error">
 <p className="error-title">
  {t('reportErrorTitle')}
  </p>

  <p className="error-message" >
   <span className="api-error">
   <strong>{errorMessage}</strong> {t('reportErrorMessage')}
   </span>
   </p>
</div>
 )
}

export default ReportErrorUI