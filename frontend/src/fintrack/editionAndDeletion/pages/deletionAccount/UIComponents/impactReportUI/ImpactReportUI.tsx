//frontend/src/editionAndDeletion/pages/deletionAccount/UIComponents/loadingReportUI/impactReportUI/ImpactReportUI.ts/

//currency should be configured as a global state
import {
  DEFAULT_CURRENCY,
  DATE_TEXT_FORMAT,
} from '../../../../../helpers/constants.ts';
// Every amount below prints the decimals of its own currency, not a fixed 2.
import { currencyMinorUnit } from '../../../../../helpers/functions.ts';

import {
  ImpactReportRowType,
  MovementBreakdownEntryType,
  RelatedAccountRowType,
} from '../../../../types/deletionTypes.ts';

import { DictionaryDataType } from '../../../../utils/languages.ts';

import './impactReportUI.css';

//-------------------------------
//TYPES DEFINITION AND IMPORT
type ImpactReportUIPropsType = {
  // THE PROJECTION'S ROWS. Read only while isProjectionShown is true.
  report?: ImpactReportRowType[];
  // THE FACT'S ROWS. Read only while isProjectionShown is false.
  //
  // TWO ARRAYS RATHER THAN ONE OF A UNION TYPE, and the reason is the
  // projection: every column it renders - current balance, new balance, net
  // adjustment, currency code - is required on its row. Folding the two shapes
  // into one type would make those four optional and hand the projection mode
  // a row it cannot render, checked by nothing. Kept apart, each mode's row
  // stays exactly as complete as the columns it draws.
  relatedAccounts?: RelatedAccountRowType[];
  // Folded by the server. null when the response does not carry it, which
  // is not the same as 0 and does not render like it.
  totalNetAdjustmentAmount: number | null;
  unattributedAmount: number | null;
  unattributedTransactionCount: number | null;
  // WHICH READING OF THE SAME ACCOUNTS IS ON SCREEN, and it now picks the rows
  // as well as the columns. New balance, net adjustment, the folded total and
  // the unattributed amount are all what ANNULLING this account would do to
  // the accounts listed. CLOSE changes none of them, so on a screen offering
  // only CLOSE those are columns of figures that will never happen.
  //
  // CURRENT BALANCE GOES WITH THEM, on the owner's decision of 2026-09-08. It
  // is not a projection and it is still wrong here: the balance an account
  // holds today has no causal link to closing the account it once transacted
  // with, and standing it beside a close implies one.
  //
  // What replaces all four answers the question the panel is actually asked -
  // why is this account in the list at all. A count of shared movements and
  // the date of the last one answer it; a balance never did.
  //
  // Defaults to true, so every existing caller keeps the report it had.
  isProjectionShown?: boolean;
  // The code the net-moved column is denominated in. It is the TARGET's, not
  // each row's: the figure is summed off the target's own rows, so labelling
  // it with the counterparty's code would name a currency the sum was never
  // taken in. Absent renders the amount with no code rather than a wrong one.
  targetAccountCurrency?: string;
  // language?:LanguageKeyType;
  t: (key: keyof DictionaryDataType) => string;
};

// The reader's own zone, not UTC. transaction_actual_date is TIMESTAMPTZ and
// MAX() folds it into an instant, so a movement recorded at 21:00 in a UTC-4
// zone is already the next calendar day in UTC. Formatting off UTC parts would
// print tomorrow's date for it.
const formatInteractionDate = (isoInstant: string) => {
  const parsed = new Date(isoInstant);

  // A date that does not parse renders as a dash, never as "Invalid Date".
  if (Number.isNaN(parsed.getTime())) {
    return '—';
  }

  return parsed.toLocaleDateString(DATE_TEXT_FORMAT, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

// THE DICTIONARY KEY FOR A MOVEMENT TYPE NAME. The catalog names carry hyphens
// ('account-opening') and the dictionary is a flat record of identifiers, so
// the hyphens become underscores. The prefix is what keeps these entries apart
// from the account-type entries beside them: 'investment' is both an account
// type and a movement type, and one shared entry would make renaming either
// label silently rename the other.
const movementLabelKey = (movementTypeName: string) =>
  `movement_${movementTypeName.replace(/-/g, '_')}` as keyof DictionaryDataType;

// THE NAME THE OWNER READS, or the name the database holds. getLangText returns
// the key itself when the dictionary has no entry (languages.ts:229), so a
// movement type added to the catalog and not to this dictionary renders as
// 'account-opening' rather than as 'movement_account_opening'. Wrong-looking is
// better than meaningless, and neither is silent.
const movementLabel = (
  t: (key: keyof DictionaryDataType) => string,
  movementTypeName: string,
) => {
  const key = movementLabelKey(movementTypeName);
  const translated = t(key);

  return translated === key ? movementTypeName : translated;
};

// A COUNT OF ONE STATES ONLY THE MOVEMENT. "1 Account opening" reads as a
// quantity of openings; the row already says the count once, in the figure
// above this line, and repeating it for the single-entry case is noise.
const movementBreakdownText = (
  t: (key: keyof DictionaryDataType) => string,
  breakdown: MovementBreakdownEntryType[],
) =>
  breakdown
    .map((entry) =>
      entry.count === 1
        ? movementLabel(t, entry.movementTypeName)
        : `${entry.count} × ${movementLabel(t, entry.movementTypeName)}`,
    )
    .join(' · ');

//=============================
// UI COMPONENT: ImpactReportUI
//=============================
const ImpactReportUI = ({
  report = [],
  relatedAccounts = [],
  totalNetAdjustmentAmount,
  unattributedAmount,
  unattributedTransactionCount,
  isProjectionShown = true,
  targetAccountCurrency,
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

  // The count in the title comes from whichever array is on screen. Both are
  // built from one CTE on the server, so they agree on the population, but the
  // title has to count the rows the reader can actually see.
  const displayedRowCount = isProjectionShown
    ? report.length
    : relatedAccounts.length;

  //Replace {count}
  const formatImpactReportTitle = (title: string) =>
    title.replace('{count}', displayedRowCount.toString());

  const formatUnattributedNote = (note: string) =>
    note.replace('{count}', (unattributedTransactionCount ?? 0).toString());

  //---------
  //RENDER
  return (
    <div className='impact-report-container '>
      <div className='impact-report-warning impact-report-warning--informational'>
        {/* THE SAME TITLE IN BOTH MODES. "Impact detected: N affected
            accounts" named the rows by an operation nobody had chosen yet,
            and under CLOSE by one that never runs. They are the accounts this
            one has transacted with, which is what they are before any method
            is picked and after. */}
        <p className='impact-warning-title '>
          {formatImpactReportTitle(t('relatedAccountsTitle'))}
        </p>
        {/* The lede is where the two modes differ, because the columns are
            what differ. */}
        <p className='impact-warning-message'>
          {t(
            isProjectionShown
              ? 'relatedAccountsLedeAdjustment'
              : 'relatedAccountsLede',
          )}
        </p>
      </div>

      <div className='impact-report-table-wrapper'>
        <table
          className='impact-report-table'
          aria-label={t(
            isProjectionShown
              ? 'tableOfAffectedAccountsDetails'
              : 'tableOfRelatedAccountsDetails',
          )}
        >
          <thead>
            <tr>
              <th>{t('affectedAccountColumn')}</th>
              {isProjectionShown && <th>{t('currentBalanceColumn')}</th>}
              {isProjectionShown && <th>{t('newBalanceColumn')}</th>}
              {isProjectionShown && <th>{t('netAdjustmentColumn')}</th>}
              <th>{t('affectedAccountTypeColumn')}</th>
              {!isProjectionShown && <th>{t('interactionsColumn')}</th>}
              {!isProjectionShown && <th>{t('netMovedColumn')}</th>}
              {!isProjectionShown && <th>{t('lastInteractionColumn')}</th>}
            </tr>
          </thead>
          <tbody>
            {isProjectionShown
              ? report.map((row) => (
                  // INCLUIRE UN HOVER QUE CAMBIE EL BACKGROUND A GRIS CLARO DE LA LINEA ROW O TR.
                  <tr key={row.affectedAccountId}>
                    <td className='account-name'>{row.affectedAccountName}</td>

                    <td className='current-balance'>
                      {row.affectedAccountCurrentBalance.toFixed(
                        currencyMinorUnit(row.affectedAccountCurrencyCode),
                      )}{' '}
                      {row.affectedAccountCurrencyCode}
                    </td>

                    <td className='new-balance'>
                      {(
                        row.affectedAccountCurrentBalance +
                        row.affectedAccountNetAdjustmentAmount
                      ).toFixed(
                        currencyMinorUnit(row.affectedAccountCurrencyCode),
                      )}{' '}
                      {row.affectedAccountCurrencyCode}
                    </td>

                    <td
                      className={`net-adjustment
        ${row.affectedAccountNetAdjustmentAmount >= 0 ? 'positive' : 'negative'}`}
                    >
                      {row.affectedAccountNetAdjustmentAmount.toFixed(
                        currencyMinorUnit(row.affectedAccountCurrencyCode),
                      )}{' '}
                      {row.affectedAccountCurrencyCode}
                    </td>

                    <td className='account-type'>
                      {t(
                        `${row.affectedAccountType as keyof DictionaryDataType}`,
                      )}
                    </td>
                  </tr>
                ))
              : relatedAccounts.map((row) => (
                  <tr key={row.accountId}>
                    <td className='account-name'>{row.accountName}</td>

                    <td className='account-type'>
                      {t(`${row.accountTypeName as keyof DictionaryDataType}`)}
                    </td>

                    {/* WHAT THE INTERACTIONS WERE, under how many there
                        were. Written into the cell rather than into a title
                        attribute alone: a tooltip is invisible to a touch
                        screen and to a keyboard, and the reason the
                        compensation account is in this list - a funded opening
                        brings the money in from outside the application, and
                        that arrival is recorded against it - is the whole
                        answer to the question the row raises. An older row
                        from a response without the field renders the count
                        alone rather than an empty line. */}
                    <td className='interaction-count'>
                      <span className='interaction-count__total'>
                        {row.interactionCount}
                      </span>

                      {row.movementBreakdown?.length ? (
                        <span className='interaction-count__movements'>
                          {movementBreakdownText(t, row.movementBreakdown)}
                        </span>
                      ) : null}
                    </td>

                    {/* Zero takes neither colour. It is a real answer here -
                        two accounts that moved money both ways in equal
                        measure - and painting it green would read as a gain. */}
                    <td
                      className={`net-moved${
                        row.netAmount > 0
                          ? ' positive'
                          : row.netAmount < 0
                            ? ' negative'
                            : ''
                      }`}
                    >
                      {row.netAmount.toFixed(
                        currencyMinorUnit(targetAccountCurrency ?? DEFAULT_CURRENCY),
                      )}
                      {targetAccountCurrency ? ` ${targetAccountCurrency}` : ''}
                    </td>

                    <td className='last-interaction'>
                      {formatInteractionDate(row.lastInteractionDate)}
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {/* REMOVED FROM THE CLOSE'S PANEL, not renamed. Total Net Adjustment
          reads as a change in net worth, and with the three money columns gone
          there is nothing left to total. */}
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
            ? `${totalNetAdjustmentAmount.toFixed(currencyMinorUnit(DEFAULT_CURRENCY))} ${DEFAULT_CURRENCY}`
            : '—'}
        </span>
      </p>
      )}

      {showsUnattributed && (
        <p className='impact-report-unattributed'>
          <span className='unattributed-label'>{t('unattributedAmount')}</span>
          <span className='unattributed-amount'>
            {unattributedAmount.toFixed(currencyMinorUnit(DEFAULT_CURRENCY))}{' '}
            {DEFAULT_CURRENCY}
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
