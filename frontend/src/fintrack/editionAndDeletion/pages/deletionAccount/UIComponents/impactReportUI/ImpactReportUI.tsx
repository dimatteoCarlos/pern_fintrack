//frontend/src/editionAndDeletion/pages/deletionAccount/UIComponents/loadingReportUI/impactReportUI/ImpactReportUI.ts/

//currency should be configured as a global state
import { DEFAULT_CURRENCY } from '../../../../../helpers/constants.ts';

import { ImpactReportRowType } from '../../../../types/deletionTypes.ts';

import { DictionaryDataType } from '../../../../utils/languages.ts';

import './impactReportUI.css';

//-------------------------------
//TYPES DEFINITION AND IMPORT
type ImpactReportUIPropsType = {
  report: ImpactReportRowType[];
  // Folded by the server. null when the response does not carry it, which
  // is not the same as 0 and does not render like it.
  totalNetAdjustmentAmount: number | null;
  unattributedAmount: number | null;
  unattributedTransactionCount: number | null;
  // WHETHER THE ANNULMENT'S PROJECTION IS SHOWN, and it is the difference
  // between two readings of the same rows. New balance, net adjustment, the
  // folded total and the unattributed amount are all what ANNULLING this
  // account would do to the accounts listed. CLOSE changes none of them, so on
  // a screen offering only CLOSE those four are columns of figures that will
  // never happen. What survives is true either way: which accounts share
  // movements with this one, what they are, and what they hold today.
  //
  // Defaults to true, so every existing caller keeps the report it had.
  isProjectionShown?: boolean;
  // language?:LanguageKeyType;
  t: (key: keyof DictionaryDataType) => string;
};

//=============================
// UI COMPONENT: ImpactReportUI
//=============================
const ImpactReportUI = ({
  report,
  totalNetAdjustmentAmount,
  unattributedAmount,
  unattributedTransactionCount,
  isProjectionShown = true,
  t,
}: ImpactReportUIPropsType) => {
  // The total is read, not summed here. A reduce over report is short by
  // unattributedAmount, which no row carries: those transactions were
  // already reversed by an earlier deletion and name no live account.
  const hasTotal = totalNetAdjustmentAmount !== null;

  // Zero is the ordinary answer and gets no line. A nonzero amount is the
  // reason the rows do not add up to the total, so the screen states it
  // rather than leaving the reader to find the gap.
  const showsUnattributed =
    isProjectionShown &&
    unattributedAmount !== null &&
    unattributedAmount !== 0;

  //Replace {count}
  const formatImpactReportTitle = (title: string) =>
    title.replace('{count}', report.length.toString());

  const formatUnattributedNote = (note: string) =>
    note.replace('{count}', (unattributedTransactionCount ?? 0).toString());

  //---------
  //RENDER
  return (
    <div className='impact-report-container '>
      <div
        className={
          isProjectionShown
            ? 'impact-report-warning'
            : 'impact-report-warning impact-report-warning--informational'
        }
      >
        <p className='impact-warning-title '>
          {formatImpactReportTitle(
            t(isProjectionShown ? 'impactDetectedTitle' : 'relatedAccountsTitle'),
          )}
        </p>
        <p className='impact-warning-message'>
          {t(isProjectionShown ? 'impactDetectedMessage' : 'relatedAccountsLede')}
        </p>
      </div>

      <div className='impact-report-table-wrapper'>
        <table
          className='impact-report-table'
          aria-label={t('tableOfAffectedAccountsDetails')}
        >
          <thead>
            <tr>
              <th>{t('affectedAccountColumn')}</th>
              <th>{t('currentBalanceColumn')}</th>
              {isProjectionShown && <th>{t('newBalanceColumn')}</th>}
              {isProjectionShown && <th>{t('netAdjustmentColumn')}</th>}
              <th>{t('affectedAccountTypeColumn')}</th>
            </tr>
          </thead>
          <tbody>
            {report.map((row) => (
              // INCLUIRE UN HOVER QUE CAMBIE EL BACKGROUND A GRIS CLARO DE LA LINEA ROW O TR.
              <tr key={row.affectedAccountId}>
                <td className='account-name'>{row.affectedAccountName}</td>

                <td className='current-balance'>
                  {row.affectedAccountCurrentBalance.toFixed(2)}{' '}
                  {row.affectedAccountCurrencyCode}
                </td>

                {isProjectionShown && (
                  <td className='new-balance'>
                    {(
                      row.affectedAccountCurrentBalance +
                      row.affectedAccountNetAdjustmentAmount
                    ).toFixed(2)}{' '}
                    {row.affectedAccountCurrencyCode}
                  </td>
                )}

                {isProjectionShown && (
                  <td
                    className={`net-adjustment
        ${row.affectedAccountNetAdjustmentAmount >= 0 ? 'positive' : 'negative'}`}
                  >
                    {row.affectedAccountNetAdjustmentAmount.toFixed(2)}{' '}
                    {row.affectedAccountCurrencyCode}
                  </td>
                )}

                <td className='account-type'>
                  {t(`${row.affectedAccountType as keyof DictionaryDataType}`)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isProjectionShown && (
      <p className='impact-report-total'>
        {t('totalNetAdjustment')}
        <span
          className={`total-amount ${
            hasTotal
              ? totalNetAdjustmentAmount > 0
                ? 'positive'
                : 'negative'
              : 'absent'
          }`}
        >
          {hasTotal
            ? `${totalNetAdjustmentAmount.toFixed(2)} ${DEFAULT_CURRENCY}`
            : '—'}
        </span>
      </p>
      )}

      {showsUnattributed && (
        <p className='impact-report-unattributed'>
          <span className='unattributed-label'>{t('unattributedAmount')}</span>
          <span className='unattributed-amount'>
            {unattributedAmount.toFixed(2)} {DEFAULT_CURRENCY}
          </span>
          <span className='unattributed-note'>
            {formatUnattributedNote(t('unattributedNote'))}
          </span>
        </p>
      )}
    </div>
  );
};

ImpactReportUI.propTypes = {};

export default ImpactReportUI;
