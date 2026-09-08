//frontend/src/editionAndDeletion/pages/deletionAccount/UIComponents/noImpactReportUI/NoImpactReportUI.tsx


import { DictionaryDataType } from '../../../../utils/languages';
import './impactReportUI.css';

type NoImpactReportUIPropsType = {
  // Same reasoning as ImpactReportUI's prop of this name: the empty answer
  // means "no account would be adjusted" to the annulment and "no account
  // shares movements with this one" to the close, and they are not the same
  // sentence. Defaults to the annulment's wording for existing callers.
  isProjectionShown?: boolean;
  t: (keyText:keyof DictionaryDataType)=>string;
};

export const NoImpactReportUI: React.FC<NoImpactReportUIPropsType> = ({
  isProjectionShown = true,
  t,
}: NoImpactReportUIPropsType) => {
  
  return (
    <div className="no-impact-report">
      <p className="no-impact-title">
        {t(isProjectionShown ? 'noImpactTitle' : 'relatedAccountsNoneTitle')}
      </p>
      <p className="no-impact-message">
        {t(
          isProjectionShown ? 'noImpactMessage' : 'relatedAccountsNoneMessage',
        ).replace(/\*\*/g, '')}
      </p>
    </div>
  );
};
