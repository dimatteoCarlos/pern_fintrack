# Mockups

Every mockup in the project lives here, in a folder named for the module that
owns it. One central folder, one subfolder per module.

```
plan-docs/mockups/
  account-deletion/    the close and delete screens
  overview/            the overview levels and its proposals
  <module>/            one folder per module, named for the module
```

## Why a central folder and not one beside each plan

A mockup is opened in a browser, not read as part of a plan. Scattered through
the plan folders they are found only by whoever already knows the path, and a
session looking for "what has been drawn so far" has to walk every plan.

## Why a subfolder per module and not one flat folder

Three sessions write into this repository at the same time. A flat folder means
two of them adding a file touch the same directory listing on the same day, and
it means a filename has to carry the module name to stay unambiguous. A folder
per module gives each session a place to write that no other session writes to,
and lets the filename describe the screen rather than the owner.

## Conventions

- **The folder is named for the module, in lowercase and hyphenated**:
  `account-deletion`, `overview`. Not for the plan file, and not for the
  session that happens to be holding it.
- **The filename describes the screen**, not the module - the folder already
  says that. `close-account.html`, not `mockup-close-account.html`.
- **A mockup is standalone HTML.** It opens with a double click, carries its own
  styles, and fetches nothing. That is what makes it reviewable by opening it.
- **A superseded mockup stays and says so.** A banner at the top of the frame it
  affects, naming what replaced it, rather than a deleted file - the decisions
  taken against a frame are read back later, and a missing file cannot be read.
