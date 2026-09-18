// src/fintrack_api/services/overview_services/core/makeCategoryBreakdown.js

// D19 — the expense breakdown, one array serving both the donut and the Pareto.
//
// One array and not two (distribution / pareto) so the two charts read literally
// the same rows. Two arrays could be built from two orderings of two queries and
// show different figures for the same category on the same screen, which is the
// class of defect §4.2 exists to prevent.
//
// The eight base fields are NOT recomputed here. They arrive already built by
// makeBudgetCategoryStatus, through budgetCalculationService.getBudgetAccountsStatus,
// and this module only decorates them. makeCategoryGroups — the fold that
// produces them — is private to budgetCalculationService.js:260, and exporting it
// would open the contract D6 freezes; calling the public method whole reuses the
// same arithmetic without touching that module at all.
//
// Three fields are added because they do not exist anywhere today: makeCategoryGroups
// sorts alphabetically, which is the right order for a list of categories and the
// wrong one for a Pareto. Ordering by spend and carrying the running total is the
// new work, and by §4.1 it happens here rather than in a React component.
//
// THE FOLD ITSELF MOVED TO rankBySpend.js when the screen gained a second level.
// The subcategory ranking is the same arithmetic over the accounts of one
// category, and this file stays as the category's entry to it: what a level owns
// is which rows it ranks and what a row is called, which is exactly what is
// passed below.

import { rankBySpend } from './rankBySpend.js';

/**
 * Rank the categories by spend and carry the Pareto's running total.
 *
 * @param {object[]} categories - ExpenseCategoryStatus base fields, frozen objects
 * @returns {object[]} the same rows with rank and the two curves
 */
export const makeCategoryBreakdown = (categories) =>
 rankBySpend(categories, (category) => category.categoryName);
