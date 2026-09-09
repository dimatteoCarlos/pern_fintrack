// frontend/src/fintrack/pages/overview/OverviewLayout.tsx
//
// The three figures at the top of Overview, for one month.
//
// It used to issue five requests to /dashboard/balance/type and add the answers
// up here: three of them fed a net worth computed in this file, and income and
// expenses were ACCOUNT BALANCES over all time — the cumulative income ever
// received and the cumulative spend ever recorded, with no period at all. One
// request to /overview replaces all five, and the arithmetic moves to the
// service that owns it, so the figure on this screen and the figure on a domain
// screen cannot disagree.
//
// /dashboard is untouched and still answers: the two aggregates run side by side
// while the frontend switches screen by screen (D6).

import { useCallback, useEffect } from 'react';
import { Outlet, useSearchParams } from 'react-router-dom';

import { BigBoxResult } from './components/BigBoxResult.tsx';
import HeroIndicators from './components/HeroIndicators.tsx';
import { TitleHeader } from '../../general_components/titleHeader/TitleHeader.tsx';
import MonthPicker from '../../general_components/monthPicker/MonthPicker.tsx';
import ScrollJump from '../../general_components/scrollJump/ScrollJump';
import CoinSpinner from '../../loader/coin/CoinSpinner.tsx';
import { useOverviewStore } from '../../stores/useOverviewStore.ts';

import './styles/overview-styles.css';

//==================
//==MAIN COMPONENT==
//==================
function OverviewLayout() {
 // The page's single request. This header and every block the Outlet renders are
 // drawn from it, which is why it is issued here rather than per component.
 const hero = useOverviewStore((state) => state.hero);
 const domainCards = useOverviewStore((state) => state.domainCards);
 const referenceMonth = useOverviewStore((state) => state.referenceMonth);
 const currentMonth = useOverviewStore((state) => state.currentMonth);
 const isLoading = useOverviewStore((state) => state.isLoading);
 const error = useOverviewStore((state) => state.error);
 const fetchOverview = useOverviewStore((state) => state.fetchOverview);

 // The month lives in the URL, the convention the budget and pocket boards
 // already use. It is not held in state here: the account and level-3
 // destinations are routes declared BESIDE this layout (App.tsx:342-354), so a
 // month in state would die the moment one of them is opened.
 const [searchParams, setSearchParams] = useSearchParams();
 const monthParam = searchParams.get('month');

 // Absent, nothing is sent and the server resolves the current month on the
 // owner's calendar. Only a month the reader stepped to ever travels.
 useEffect(() => {
  fetchOverview(monthParam ?? undefined);
 }, [fetchOverview, monthParam]);

 // Replaced, not pushed: the month is the scope of the page, not a step the back
 // button should walk through one month at a time.
 //
 // Merged rather than written whole, so a query parameter another block owns is
 // not cleared by picking a month.
 const selectMonth = useCallback(
  (month: string) => {
   setSearchParams(
    (previous) => {
     const next = new URLSearchParams(previous);
     next.set('month', month);
     return next;
    },
    { replace: true },
   );
  },
  [setSearchParams],
 );

 // The same argument the effect sends, so the button asks for the month on
 // screen and not for whatever the server would resolve today.
 const retry = useCallback(() => {
  fetchOverview(monthParam ?? undefined);
 }, [fetchOverview, monthParam]);

 //==================================
 // null and never 0: a figure that has not arrived is not a figure of zero, and
 // BigBoxResult renders null as a dash. Both sources are read from the payload
 // and nothing is added up here.
 //
 // No negation on income. The legacy figure was the income_source account
 // balance, which is a sum of WITHDRAW rows and therefore negative, so this file
 // flipped its sign. The card publishes the month's income as a flow, and
 // flipping a flow would report every month's income as a loss.
 //
 // THREE ROWS AGAIN, and this time nothing is thrown away. The hero grew to
 // seven when liquidNetWorth, cashPosition, freeCash and netMonthlyFlow turned
 // out to be computed on every request and rendered nowhere. Four of those
 // seven answer narrower questions than the three below, and a reader who is
 // not asking one of them was reading past four rows to reach the page: they
 // moved to HeroIndicators, which opens and closes and carries a definition for
 // each. Published, and no longer in the way.
 //
 // savingsRate is still absent from both: it is a RATE on a 0-1 scale and every
 // row here is an amount in the accounting currency, so BigBoxResult would
 // format 0.23 as $0.23. It gets its own row when a component carries a unit.
 const bigScreenInfo = [
  // What is owned, receivable leg included.
  { title: 'net worth', amount: hero?.netWorth ?? null },
  // The two flows of the month, under the position.
  { title: 'income', amount: domainCards?.income.totalAmount ?? null },
  { title: 'expenses', amount: domainCards?.expense.totalAmount ?? null },
 ];

 return (
  <main className='overviewLayout '>
   <div className='layout__header'>
    <div className='headerContent__container '>
     <TitleHeader />

     {/* Same level the budget and pocket boards put it at, floated out of the
         header's flow by CSS: the header is positioned from a constant height,
         so a child adding to it would move every absolute box below.

         surface='cream', which is the third of the three and the one this
         header wants: a cream pill with dark ink, on the white band. 'light' -
         the default it used to take - is the same band with a near-black pill,
         and 'dark' is the page's own ground. All three name the surface the
         pill SITS ON; only the third says the pill itself is light, which is
         what makes "black on hover" a step up for its chevrons rather than a
         step into the fill.

         The arrows are the shared component's, behind its opt-in prop, so the
         bounds are held in one place. currentMonth is the ceiling the server
         raises its 422 against — a local wrapper holding a second copy of it
         is how a forward arrow comes to step past the month that exists. */}
     <MonthPicker
      month={referenceMonth}
      currentMonth={currentMonth}
      surface='cream'
      withSteppers
      isLoading={isLoading}
      onSelect={selectMonth}
     />
    </div>
   </div>

   {isLoading && (
    <div
     className='loader__container'
     style={{ position: 'absolute', left: '50%', top: '20%', zIndex: '1' }}
    >
     <CoinSpinner />
    </div>
   )}

   {/* The failure takes the figures' own place, the way the pocket and debts
       boards already answer. It used to be a red line that erased itself after
       two seconds while the figures it contradicted stayed on screen, so the
       reader was left with three numbers and no way to know one request had
       failed. No figure survives a failed request, so no figure is drawn. */}
   {error ? (
    <div className='total__container flex-col-sb boardState' role='alert'>
     <p className='boardState__text'>The overview could not be loaded.</p>

     {/* The reason, in the words the failure arrived with. A month later than
         the current one answers 422 with a message naming the ceiling, and a
         single generic sentence here would throw that away. */}
     <p className='boardState__detail'>{error}</p>

     <button type='button' className='boardState__retry' onClick={retry}>
      Try again
     </button>
    </div>
   ) : (
    <>
     {/* The accounting currency the payload published, not a constant. Every
         figure in the rows comes from that same answer. */}
     <BigBoxResult
      bigScreenInfo={bigScreenInfo}
      currency={hero?.currency ?? null}
     />

     {/* Directly under the hero and inside the same branch: the four figures it
         carries come from the same payload, so a failed request must not leave
         a card offering to open onto four dashes. */}
     <HeroIndicators />
    </>
   )}

   <Outlet />

   {/* Outside the Outlet, so it serves every screen of the module and not only
       the board: the control is fixed to the viewport, and a copy per route
       would be several controls answering one question. Overview runs past a
       viewport on any real data - six domain cards, three snapshots, the
       goals, the charts and five movement lists - and it had no way back to
       the month picker but the wheel. */}
   <ScrollJump />
  </main>
 );
}

export default OverviewLayout;
