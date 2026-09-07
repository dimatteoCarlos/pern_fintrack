# Browser verification: the tracker's server-side rate preview

You are verifying work that has been type-checked and exercised against the
database, but **never seen on screen**. Nothing below asks for your opinion on
the design. Every check asks you to read a value off the screen and write it
down. Where a check has an expected value, say whether it matched; where it does
not, just report what you saw.

Report back as a numbered list matching the check numbers. For anything that
differs from the expectation, include a screenshot.

---

## 0. Setup, and the one thing you must not do

**Do not stop or restart anything on port 5000.** The developer runs the backend
there and other sessions depend on it. If it is not running, ask the developer to
start it rather than starting it yourself.

The frontend dev server is what you launch:

- Run the dev server from the `frontend/` directory. It reads
  `VITE_API_BASE_URL=http://localhost:5000/api/` from `.env.local`, so it talks
  to the backend already running.
- The application requires a login. Ask the developer to log in for you, or to
  give you a browser profile that already has a session. **Never ask for, type,
  or store credentials.**

Facts you will need to read the results:

- The accounting currency of this installation is **usd**. Every amount is stored
  in it, and every rate is published as *one accounting unit equals X of the
  other currency*.
- The account owner's time zone is **America/Bogota**.
- Four currencies are convertible: **cop, eur, ves, mxn**.
- **The Colombian peso resolves reliably. The euro, the bolivar and the Mexican
  peso will FAIL for most past days**, because the provider that serves them
  cannot be reached from this machine at the network level. That failure is
  expected and is itself one of the things to verify — see check 5.

---

## 1. The date window the form offers

Open the expense tracker. Find the small calendar glyph beside the account label
and open it.

Report:

1. The earliest day the calendar lets you select.
2. The latest day it lets you select.
3. Whether today is selectable.

Expected: the window is the first of the current month through today, on the
device's calendar. **If the earliest and latest day are the same**, the device
clock has rolled into a new month and most of the checks below cannot be
performed — stop here and report that, because the whole point of the feature is
choosing a day other than today.

---

## 2. The converted figure appears, and it is not zero

Still in the expense tracker, leave the date at today.

- Set the currency selector to **cop**.
- Type **20000** as the amount.

Report:

1. The text that appears beside the amount label, **verbatim**, including the
   currency it names.
2. How long it took to appear after you stopped typing, roughly — under a second,
   a second or two, longer.

Expected: something of the form `≈ 6,22 usd`. **A figure of `0,00` is a failure**
— that was the defect being fixed and it must not come back.

---

## 3. The tooltip's three lines

Hover the converted figure from check 2 (or focus it with the keyboard).

Report **all three lines verbatim**, in order.

Expected shape:

```
usd→cop
rate: 3.213,97
```

Report specifically:

1. Does the first line read `usd→cop`, in that order? (`cop→usd` is wrong.)
2. Is the rate in the thousands, or is it a fraction like `0,0003`? A fraction is
   a failure.
3. **Is there a third line beginning `for `?** With the date left at today there
   should be **no** third line. If one appears, write down the date it names.

---

## 4. Changing the date changes the figure

Open the calendar and pick **the 20th of the current month** (or, if the 20th is
in the future, any weekday at least three days before today).

Report:

1. Does the glyph now show the day you picked beside it, e.g. `20 Aug`?
2. The converted figure, verbatim — did it change from check 2?
3. All lines of the tooltip, verbatim.

Expected: the figure changes, the tooltip's rate changes, and a **third line now
appears** naming an effective day.

4. **Does the third line's date equal the day you picked?** It may legitimately
   be an earlier day — a market closed on the chosen date is valued by the last
   day that quoted. Either way, write down both dates: the day you picked and the
   day the tooltip names.

---

## 5. The three states of the preview, including failure

The preview has three distinct states and they must not look alike.

**Loading.** Type a new amount and watch the moment before the figure lands.

1. Does a grey placeholder bar appear where the figure will be?
2. Does the row jump or shift when the real figure replaces it?

**Failure.** Set the currency to **eur** and keep the back-dated date from check
4. This is expected to fail.

3. What appears in place of the figure? Report it verbatim.
4. Is there a **Retry** button beside it?
5. Press Retry. What happens — does the placeholder reappear, and does it end in
   the same message?
6. Reach the Retry button **with the keyboard alone** (Tab). Report whether you
   can reach it, and whether a visible focus ring is drawn around it when you do.

**Empty.** Clear the amount field.

7. Does the preview disappear entirely, leaving no leftover text or empty box?

---

## 6. The same behaviour on the other four screens

Repeat checks 2, 3 and 4 briefly on each of: **income, transfer, debts**, and
**profit & loss**.

Profit & loss matters most: it owns its own labelled calendar in the lower part
of the card rather than the glyph, and it was wired separately.

Report, per screen: does the figure appear, does the tooltip carry the same three
lines, and does changing the date change both.

For profit & loss specifically: **change the date using its own Date field** and
confirm the preview above reacts.

---

## 7. The currency selector on the cream modal

This is a separate, already-diagnosed defect. Confirm it on screen.

Open a pocket, then the modal that takes a cash amount.

1. Beside the amount field there should be a control showing the currency code
   in capitals. **Can you see it at all?**
2. Select the text in that area with the mouse, or use the browser inspector.
   Report the computed `color` of that element and the `background-color` of the
   panel behind it.

Expected: both are `#e8e4da` — the same cream, so the control is invisible while
still occupying its space.

3. Press Tab repeatedly from the amount field. **Can you reach that currency
   control with the keyboard at all?** Expected: no. Report what the focus goes
   to instead.

---

## 8. Anything the console says

Keep the browser console open throughout.

Report every error or warning that mentions a rate, a currency, a conversion or a
date. Ignore warnings about chunk sizes and about React dev-mode notices.

---

## What to send back

A numbered list, one entry per check, with the verbatim values. Do not summarise
into "works" or "looks fine" — the values are the result. If a check could not be
performed, say which and why.
