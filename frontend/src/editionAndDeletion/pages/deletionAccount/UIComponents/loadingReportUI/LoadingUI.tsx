//frontend/src/editionAndDeletion/pages/deletionAccount/UIComponents/loadingReportUI/LoadingUI.tsx
import { LanguageKeyType } from "../../../../utils/languages"

import './loadingUI.css';

type LoadingUIProps = {
  loadingText?: string; // 🎯 Opcional: texto personalizado
  size?: 'small' | 'medium' | 'large'; // 🎯 Tamaño del spinner
  className?: string; // 🎯 Clases CSS adicionales
  language:LanguageKeyType;

};
// =================================
// LOADING UI COMPONENT
// =================================
export const LoadingUI = ({loadingText, 
  size = 'medium',
  className = '' }:LoadingUIProps) => {

   const sizeClasses = {
    small: 'loading-spinner-small',
    medium: 'loading-spinner-medium', 
    large: 'loading-spinner-large'
  };  

//RENDER
  return (
    <div className={`loading-ui ${className}`}>
    <svg className={`loading-spinner ${sizeClasses[size]}`} xmlns="http://www.w3.org/2000/svg" 
    fill="none"
    viewBox="0 0 24 24"
    aria-hidden="true"
    >
      <circle className="spinner-circle" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>

      <path className="spinner-path" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
     </svg>

     {loadingText && (
        <p className="loading-text">{loadingText}</p>
      )}
    </div>
  )
}

export default LoadingUI