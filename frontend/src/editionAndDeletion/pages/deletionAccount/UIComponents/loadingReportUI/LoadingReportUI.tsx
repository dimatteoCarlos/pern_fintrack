// frontend/src/editionAndDeletion/pages/deletionAccount/UIComponents/loadingReportUI/LoadingReportUI.tsx

import { useLanguageTranslation } from "../../../../hooks/useLangTranslation"
import { LanguageKeyType } from "../../../../utils/languages"

import './loadingReportUI.css';

type LoadingReportUIProps={
language:LanguageKeyType
}

export const LoadingReportUI = ({language='en'}:LoadingReportUIProps) => {
 const {translateText}=useLanguageTranslation(language)
  return (
    <div className="loading-report">
     <svg className="loading-spinner" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="spinner-circle" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="spinner-path" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <p className="loading-text">{translateText('loadingReportText')}</p>
    </div>
  )
}

export default LoadingReportUI