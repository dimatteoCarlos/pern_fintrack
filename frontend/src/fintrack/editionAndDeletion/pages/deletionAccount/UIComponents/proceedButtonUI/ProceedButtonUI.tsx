//frontend/src/editionAndDeletion/pages/deletionAccount/UIComponents/proceedButtonUI/ProceedButtonUI.tsx

import { DictionaryDataType } from "../../../../utils/languages.ts";

import './proceedButtonUI.css';

//TYPE DEFINITIONS
type ProceedButtonUIPropsType = {
  onClick: () => void;
  disabled?: boolean;
  // WHICH OF THE TWO BUTTONS ON THE SCREEN THIS IS. Filled red is the
  // design system's treatment for the destructive action a screen exists
  // for, and on the close screen that is CLOSE. This route is the
  // alternative offered only while a balance refuses the close, so drawing
  // it filled too left two red buttons side by side and nothing saying
  // which one the page is for. Defaults to primary for existing callers.
  variant?: 'primary' | 'secondary';
  t:(keyText:keyof DictionaryDataType)=>string;
};
const ProceedButtonUI = ({onClick,
disabled, variant = 'primary', t}:ProceedButtonUIPropsType) => {

 return (
  <button className={
    variant === 'secondary'
     ? 'proceed-button proceed-button--secondary'
     : 'proceed-button'
   }
    onClick={onClick}
    disabled={disabled}
    aria-label={t('proceedToDeletionButton')}
  >
   {t('proceedToDeletionButton')}

  </button>
 )
}

export default ProceedButtonUI