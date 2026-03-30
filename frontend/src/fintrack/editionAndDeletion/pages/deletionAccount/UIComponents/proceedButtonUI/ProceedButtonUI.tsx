//frontend/src/editionAndDeletion/pages/deletionAccount/UIComponents/proceedButtonUI/ProceedButtonUI.tsx

import { DictionaryDataType } from "../../../../utils/languages.ts";

import './ProceedButtonUI.css';

//TYPE DEFINITIONS
type ProceedButtonUIPropsType = {
  onClick: () => void;
  disabled?: boolean;
  t:(keyText:keyof DictionaryDataType)=>string;
};
const ProceedButtonUI = ({onClick,
disabled,t}:ProceedButtonUIPropsType) => {

 return (
  <button className="proceed-button"
    onClick={onClick}
    disabled={disabled}
    aria-label={t('proceedToDeletionButton')}
  >
   {t('proceedToDeletionButton')}

  </button>
 )
}

export default ProceedButtonUI