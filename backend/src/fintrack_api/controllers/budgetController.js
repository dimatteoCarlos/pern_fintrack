// src/fintrack_api/controllers/budgetController.js

// Budget Controller – HTTP request handlers for the Budget module.
// Validates requests using Zod schemas from budgetValidators.js.
// Calls services and returns JSON or CSV responses.
// All dates are handled in UTC to avoid timezone drift.

import {
 summaryQuerySchema,
 multiSummaryBodySchema,
 updatePolicyParamsSchema,
 updatePolicyBodySchema,
 historyParamsSchema,
 exportQuerySchema,
} from '../../validation/zod/budgetValidators.js';

import { budgetCalculationService } from '../services/budget_services/services/budgetCalculationService.js';
import { budgetPolicyService } from '../services/budget_services/services/budgetPolicyService.js';
import { pool } from '../../db/config/configDB.js';
import { getAccountsByType } from '../services/fintrackUtils/accountUtils.js';
import { convertBudgetResultsToCSV } from '../services/fintrackUtils/exportUtils.js';
import XLSX from 'xlsx';

// ============================================================
// GET /budget/summary
// ============================================================
export async function getSummary(req, res, next) {
 try {
  const validated = summaryQuerySchema.parse(req.query);
  const { accountId, frequency, date, startDate, endDate } = validated;

  const result = await budgetCalculationService.getSummary(
   pool,
   accountId,
   frequency,
   date || new Date(),
   { startDate, endDate }
  );

  res.status(200).json(result);
 } catch (error) {
  if (error.name === 'ZodError') {
   return res.status(400).json({ errors: error.errors });
  }
  next(error);
 }
}

// ============================================================
// POST /budget/multi-summary
// ============================================================
export async function getMultiSummary(req, res, next) {
 try {
  const validated = multiSummaryBodySchema.parse(req.body);
  const { accountIds, frequency, date, startDate, endDate } = validated;

  const result = await budgetCalculationService.getMultiSummary(
   pool,
   accountIds,
   frequency,
   date || new Date(),
   { startDate, endDate }
  );

  res.status(200).json(result);
 } catch (error) {
  if (error.name === 'ZodError') {
   return res.status(400).json({ errors: error.errors });
  }
  next(error);
 }
}

// ============================================================
// PUT /budget/policy/:budgetPolicyId
// ============================================================
export async function updatePolicy(req, res, next) {
 try {
  const params = updatePolicyParamsSchema.parse(req.params);
  const body = updatePolicyBodySchema.parse(req.body);
  const { budgetPolicyId } = params;
  const { budgetAmount, budgetFrequencyTypeId } = body;

  const result = await budgetPolicyService.updateBudgetAllocation(
   pool,
   budgetPolicyId,
   budgetAmount,
   budgetFrequencyTypeId
  );

  res.status(200).json(result);
 } catch (error) {
  if (error.name === 'ZodError') {
   return res.status(400).json({ errors: error.errors });
  }
  next(error);
 }
}

// ============================================================
// GET /budget/history/:budgetPolicyId
// ============================================================
export async function getHistory(req, res, next) {
 try {
  const params = historyParamsSchema.parse(req.params);
  const { budgetPolicyId } = params;

  const history = await budgetPolicyService.getBudgetAllocationHistory(
   pool,
   budgetPolicyId
  );

  res.status(200).json(history);
 } catch (error) {
  if (error.name === 'ZodError') {
   return res.status(400).json({ errors: error.errors });
  }
  next(error);
 }
}

// ============================================================
// GET /budget/export
// ============================================================
export async function exportCSV(req, res, next) {
 try {
  const validated = exportQuerySchema.parse(req.query);
  const { accountId, frequency, date, startDate, endDate, format = 'csv' } = validated;

  let results;
  const accountNamesMap = new Map();

  if (accountId) {
   // Single account
   const { result } = await budgetCalculationService.getSummary(
    pool,
    accountId,
    frequency,
    date || new Date(),
    { startDate, endDate }
   );
   results = [result];
   const accounts = await getAccountsByType(req.user.userId, 'category_budget');
   const account = accounts.find(a => a.accountId === accountId);
   if (account) {
    accountNamesMap.set(accountId, account.accountName);
   }
  } else {
   // All user accounts
   const accounts = await getAccountsByType(req.user.userId, 'category_budget');
   if (accounts.length === 0) {
    return res.status(200).send('No budget accounts found');
   }
   const accountIds = accounts.map(a => a.accountId);
   accounts.forEach(a => {
    accountNamesMap.set(a.accountId, a.accountName);
   });

   const { results: multiResults } = await budgetCalculationService.getMultiSummary(
    pool,
    accountIds,
    frequency,
    date || new Date(),
    { startDate, endDate }
   );
   results = multiResults;
  }

  const dateStr = new Date().toISOString().split('T')[0];

  if (format === 'xlsx') {
   // Prepare data for Excel
   const excelData = results.map(r => ({
    'Account Name': accountNamesMap.get(r.budgetPolicy?.accountId) || '',
    'Subcategory': r.budgetPolicy?.subcategory || '',
    'Currency': r.currency || '',
    'Frequency': r.budgetAllocation?.frequency || '',
    'Period': r.period ? `${r.period.start.toISOString().split('T')[0]} to ${r.period.end.toISOString().split('T')[0]}` : '',
    'Budgeted': parseFloat(r.budgetAccumulatedAmount?.toFixed(2)) || 0,
    'Spent': parseFloat(r.actualSpent?.toFixed(2)) || 0,
    'Remaining': parseFloat(r.remainingBudget?.toFixed(2)) || 0,
    'Execution %': parseFloat(r.executionPercentage?.toFixed(2)) || 0,
   }));

   // Create workbook
   const workbook = XLSX.utils.book_new();
   const ws = XLSX.utils.json_to_sheet(excelData);

   // Auto-size columns (optional, improves readability)
   const colWidths = Object.keys(excelData[0] || {}).map(() => ({ wch: 18 }));
   ws['!cols'] = colWidths;

   XLSX.utils.book_append_sheet(workbook, ws, 'Budget');
   const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

   res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
   res.setHeader('Content-Disposition', `attachment; filename="budget_export_${dateStr}.xlsx"`);
   return res.status(200).send(buffer);
  }

  // CSV (default)
  const csv = convertBudgetResultsToCSV(results, accountNamesMap);
  const filename = `budget_export_${dateStr}.csv`;
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.status(200).send(csv);
 } catch (error) {
  if (error.name === 'ZodError') {
   return res.status(400).json({ errors: error.errors });
  }
  next(error);
 }
}