// frontend/src/fintrack/pages/overview/helpers/levelThreeLink.ts
//
// Where a level-2 row leads, built from the identity the row already carries
// (OVERVIEW_LEVEL3.md, section 3). No lookup and no conversion between the row
// and the URL. Every path is read from App.tsx.

export type LevelThreeLink = {
 to: string;
 // The destination's back arrow reads it, so the reader returns to level 2 on
 // the month they were studying.
 state?: { previousRoute: string };
};

// App.tsx:386, the reading variant: Overview is a reading surface.
// Null for the income row no account is attributed to; it renders unlinked.
export const accountLink = (
 accountId: number | null,
 origin: string,
): LevelThreeLink | null =>
 accountId === null
  ? null
  : {
     to: `/fintrack/overview/account/${accountId}`,
     state: { previousRoute: origin },
    };

// App.tsx:407. The route names it :debtorId and DebtorDetailReading.tsx:81 reads
// it back as the account id, so the row's accountId passes through unchanged.
export const debtorLink = (accountId: number, origin: string): LevelThreeLink => ({
 to: `/fintrack/debts/debtor/${accountId}`,
 state: { previousRoute: origin },
});

// App.tsx:415. A pocket id, never an account id.
export const pocketLink = (pocketId: number, origin: string): LevelThreeLink => ({
 to: `/fintrack/pocket/pockets/${pocketId}`,
 state: { previousRoute: origin },
});

// App.tsx:437. The name is the route segment, so it is encoded: 013 lowercases
// category names but restricts no character, and a '/' or '#' breaks the route.
//
// No previousRoute: CategoryAccountList.tsx:297 builds its own child links on
// that value, so an Overview path there would break them. The month travels
// instead, because that screen reads it from its own URL.
export const categoryLink = (
 categoryName: string,
 month: string | null,
): LevelThreeLink => {
 const path = `/fintrack/budget/category/${encodeURIComponent(categoryName)}`;

 return { to: month ? `${path}?month=${encodeURIComponent(month)}` : path };
};
