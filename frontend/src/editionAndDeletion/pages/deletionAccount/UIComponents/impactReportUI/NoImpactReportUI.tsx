//frontend/src/editionAndDeletion/pages/deletionAccount/UIComponents/noImpactReportUI/NoImpactReportUI.tsx


import { DictionaryDataType } from '../../../../utils/languages';
import './impactReportUI.css';

type NoImpactReportUIPropsType = {
  t: (keyText:keyof DictionaryDataType)=>string;
};

export const NoImpactReportUI: React.FC<NoImpactReportUIPropsType> = ({t}:NoImpactReportUIPropsType) => {
  
  return (
    <div className="no-impact-report">
      <p className="no-impact-title">{t('noImpactTitle')}</p>
      <p className="no-impact-message">
        {t('noImpactMessage').replace(/\*\*/g, '')}
      </p>
    </div>
  );
};
