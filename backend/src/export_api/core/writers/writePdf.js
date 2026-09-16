// backend/src/export_api/core/writers/writePdf.js
//
// Turns statementReportService.js's dataset into the 7-page PDF the approved
// mockup draws (plan-docs/design-refs/period-statement-mockup.html, "3. PDF
// preview"): sections 1-11 in that exact numbering, wording and table/chart
// layout. The "Highlights" block between sections 2 and 3 is Phase V2.1 (it
// needs a deterministic-sentences Analytics layer that does not exist yet)
// and is not drawn here.
//
// No financial logic of its own (architecture rule 1): every number drawn
// here already came out of statementReportService.js, and this file only
// formats, lays out and charts it. Charts are pdfkit vector primitives, no
// charting library, replaying the mockup's own SVG geometry in spirit rather
// than pixel-for-pixel.

import PDFDocument from 'pdfkit';
import { KNOWN_LIMITS } from '../knownLimits.js';

// ---- FinTrack wordmark ---------------------------------------------------
// The 8 <path d="..."> of frontend/src/assets/logo.svg, viewBox 0 0 104 24.
const LOGO_VIEWBOX_HEIGHT = 24;
const LOGO_VIEWBOX_WIDTH = 104;
const LOGO_PATHS = [
 'M31.113 7.67822C28.6478 7.67822 27.1771 8.85816 26.7007 11.2156V7.84916H22.7046V18.1053H26.7007V12.7897C26.7007 11.6169 27.5332 11.0281 29.1982 11.0281C30.8633 11.0281 31.6958 11.6145 31.6958 12.7897V18.1053H35.6919V12.7897C35.6919 11.1705 35.308 9.91701 34.5425 9.02909C33.754 8.1293 32.6116 7.67822 31.113 7.67822Z',
 'M44.3502 5.28516L40.3541 6.13984V7.84919H38.023V11.2679H40.3541V14.3448C40.3541 15.7692 40.8143 16.7901 41.737 17.405C42.6135 17.9866 44.0403 18.2763 46.0152 18.2763C46.8477 18.2763 47.6248 18.2027 48.3463 18.0531V14.6344C47.6918 14.7816 47.0813 14.8576 46.5147 14.8576C45.7701 14.8576 45.2382 14.7887 44.9168 14.6534C44.5398 14.5062 44.3502 14.2308 44.3502 13.8319V11.2679H48.3463V7.84919H44.3502V5.28516Z',
 'M55.0062 11.5741V7.84672H51.0101V18.1029H55.0062V14.3423C55.0062 13.4069 55.3276 12.7469 55.9728 12.3599C56.6157 11.9729 57.7373 11.7782 59.3353 11.7782V7.67578C58.1698 7.67578 57.2031 8.04614 56.4377 8.78686C55.7161 9.47061 55.2398 10.3989 55.0062 11.5741Z',
 'M70.6577 11.37C70.1697 8.90801 68.6434 7.67822 66.0788 7.67822C64.5248 7.67822 63.3431 8.14592 62.5314 9.07895C61.7312 9.99061 61.3335 11.2892 61.3335 12.9772C61.3335 14.6652 61.7335 15.9639 62.5314 16.8755C63.3407 17.8109 64.5248 18.2762 66.0788 18.2762C68.6434 18.2762 70.1697 17.0465 70.6577 14.5845V18.1053H74.6537V7.84916H70.6577V11.37ZM67.9936 14.8575C66.2176 14.8575 65.3295 14.2308 65.3295 12.9772C65.3295 11.7237 66.2176 11.0969 67.9936 11.0969C69.7696 11.0969 70.6577 11.7237 70.6577 12.9772C70.6577 14.2308 69.7696 14.8575 67.9936 14.8575Z',
 'M91.0129 4.43018V18.105H95.009V12.977V4.43018H91.0129Z',
 'M104 7.84912H99.3378L95.0087 12.9772L99.3378 18.1053H104L99.6708 12.9772L104 7.84912Z',
 'M86.2028 14.1121C85.7796 14.6059 85.0419 14.8575 83.9781 14.8575C82.2021 14.8575 81.314 14.2308 81.314 12.9772C81.314 11.7237 82.2021 11.0969 83.9781 11.0969C84.8129 11.0969 85.4489 11.2489 85.8906 11.5551L89.0241 9.1478C88.9431 9.07895 88.8599 9.0101 88.772 8.94362C87.6296 8.10081 86.0293 7.67822 83.9758 7.67822C81.7881 7.67822 80.1231 8.14592 78.9807 9.07895C77.8706 9.99061 77.3156 11.2892 77.3156 12.9772C77.3156 14.6652 77.8706 15.9639 78.9807 16.8755C80.1231 17.8109 81.7881 18.2762 83.9758 18.2762C86.0293 18.2762 87.6273 17.8537 88.772 17.0108C88.9755 16.8589 89.1582 16.6903 89.327 16.5123L86.2005 14.1097L86.2028 14.1121Z',
 'M11.9975 7.84894V5.39173C11.9975 5.28252 12.0021 5.17806 12.0068 5.0736V4.05511C12.0068 2.82532 12.985 1.81632 14.1875 1.81632C14.7865 1.81632 15.3322 2.06798 15.7277 2.47395C16.1231 2.87992 16.3682 3.44021 16.3682 4.05511V3.95777C16.3682 4.00288 16.3729 4.05511 16.3729 4.10497C16.3891 4.52043 16.3521 4.95964 16.5371 5.34425C17.099 6.51943 18.6114 6.31526 19.0786 5.27065C19.1364 5.14008 19.178 4.99763 19.2011 4.84094C19.3561 3.73698 18.8103 2.56179 18.0911 1.77359C16.8955 0.460707 15.6236 0.00725259 13.9123 0.000130267C13.2625 -0.00224384 12.948 0.0286196 12.941 0.0286196C11.5766 0.142577 10.2677 0.762219 9.29877 1.75697C8.24656 2.83719 7.59442 4.32338 7.59442 5.95915V7.84894H5.22406V11.2772H7.55511V16.2105C7.54586 16.5809 7.52967 16.9489 7.50655 17.3193C7.46261 17.9175 7.38861 18.4921 7.28223 19.0405C7.17585 19.5889 7.03247 20.1088 6.85441 20.586C6.67171 21.068 6.4474 21.4858 6.17683 21.8372C5.91088 22.1933 5.58944 22.4687 5.21943 22.6705C4.8448 22.8723 4.41698 22.972 3.92671 22.972C3.56364 22.972 3.25839 22.9174 3.00632 22.8082C2.75425 22.699 2.53687 22.5708 2.36574 22.4117C2.19461 22.2574 2.05123 22.0817 1.94254 21.8894C1.83617 21.7019 1.73904 21.5262 1.64885 21.3695C1.56329 21.2104 1.48235 21.0798 1.39909 20.973C1.31584 20.8662 1.22334 20.8092 1.11696 20.8092C0.936584 20.8092 0.77933 20.8543 0.640577 20.9469C0.501824 21.0442 0.383884 21.1606 0.286757 21.3101C0.191942 21.4573 0.120253 21.6188 0.0740017 21.7992C0.0254381 21.9844 0 22.1624 0 22.3381C0 22.5803 0.101752 22.8058 0.309882 23.0076C0.513387 23.2094 0.786268 23.3804 1.13315 23.5276C1.47541 23.6771 1.87085 23.7911 2.32412 23.8742C2.77275 23.9573 3.2422 24 3.72552 24C5.1038 24 6.30633 23.7697 7.33773 23.3091C8.36913 22.8486 9.2294 22.2075 9.91854 21.3885C10.6077 20.567 11.1211 19.596 11.4587 18.466C11.7963 17.3406 11.9675 16.1061 11.9675 14.7742V11.2772H15.545V16.0657C15.545 17.1911 16.4284 18.1027 17.5199 18.1146C17.5268 18.1146 17.5338 18.1146 17.5407 18.1146H17.5199H19.5411V18.1051V7.84894H11.9975Z',
];

const drawWordmark = (doc, x, y, heightPt, color) => {
 const scale = heightPt / LOGO_VIEWBOX_HEIGHT;
 doc.save();
 doc.translate(x, y).scale(scale);
 LOGO_PATHS.forEach((d) => doc.path(d));
 doc.fill(color);
 doc.restore();
 return (heightPt / LOGO_VIEWBOX_HEIGHT) * LOGO_VIEWBOX_WIDTH;
};

// ---- Palette --------------------------------------------------------------
// The mockup's own :root block (period-statement-mockup.html:15-73), copied
// from frontend/src/styles/tokens.css at the time the mockup was approved.
// pdfkit cannot read a CSS variable, so this is the literal hex it resolves
// to — the one place in the module a color is hardcoded rather than a token.
const PALETTE = {
 ink: '#141414',
 secondary: '#404040',
 onDark: '#ffffff',
 borderStrong: '#141414',
 hairline: '#e5e7eb',
 disabled: '#cccccc',
 info: '#226685',
 success: '#008000',
 error: '#cc0000',
 tilePrimary: '#e8e4da',
 pillPositiveBorder: '#66cc66',
 pillPositiveSurface: '#eeffee',
 categoryOne: '#e69f00',
 pocket1: '#3f6b93',
 pocket2: '#b8763a',
 pocket3: '#6f5aa3',
 pocket4: '#3f8a8c',
 executionOk: '#4a6b8a',
 executionNear: '#8a6220',
 executionOver: '#a33636',
 executionCritical: '#6b2222',
};

// mockup:2654-2655 — the budget donut's own documented threshold.
const BUDGET_NEAR_LIMIT_PERCENT = 0.75;

const POCKET_COLORS = [PALETTE.pocket1, PALETTE.pocket2, PALETTE.pocket3, PALETTE.pocket4];

const POCKET_LEVEL_LABELS = {
 onTrack: 'On track',
 behind: 'Behind',
 atRisk: 'At risk',
 overdue: 'Overdue',
 ahead: 'Ahead',
 completed: 'Completed',
 aboveTarget: 'Above target',
};

const POCKET_LEVEL_COLORS = {
 onTrack: PALETTE.executionOk,
 behind: PALETTE.executionNear,
 atRisk: PALETTE.executionOver,
 overdue: PALETTE.executionCritical,
 ahead: PALETTE.executionOk,
 completed: PALETTE.executionOk,
 aboveTarget: PALETTE.executionOk,
};

const executionColorFor = (executionPercentage) => {
 if (executionPercentage === null || executionPercentage === undefined) return PALETTE.disabled;
 if (executionPercentage > 1) return PALETTE.executionOver;
 if (executionPercentage >= BUDGET_NEAR_LIMIT_PERCENT) return PALETTE.executionNear;
 return PALETTE.executionOk;
};

// ---- Formatting -------------------------------------------------------
// Every figure reserves the width of a closing parenthesis so decimals align
// (mockup CSS 1730-1735); pdfkit has no ::after, so the caller's column
// widths carry that instead.
const fmtNumber = (value, { signed = false } = {}) => {
 if (value === null || value === undefined) return null;
 const n = Number(value);
 const abs = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
 if (n < 0) return `(${abs})`;
 return signed ? `+${abs}` : abs;
};

const fmtRate = (value) => {
 if (value === null || value === undefined) return null;
 return `${(Number(value) * 100).toFixed(1)}%`;
};

const monthPartsOf = (yyyyMmDd) => {
 const [year, month] = yyyyMmDd.split('-').map(Number);
 return { year, month };
};

const fmtMonthShort = (yyyyMmDd) => {
 const { year, month } = monthPartsOf(yyyyMmDd);
 return new Date(Date.UTC(year, month - 1, 1)).toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
};

const fmtMonthYear = (yyyyMmDd) => {
 const { year, month } = monthPartsOf(yyyyMmDd);
 return new Date(Date.UTC(year, month - 1, 1)).toLocaleString('en-US', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
 });
};

const lastDayOfMonth = (yyyyMmDd) => {
 const { year, month } = monthPartsOf(yyyyMmDd);
 return new Date(Date.UTC(year, month, 0));
};

const fmtISODate = (date) => date.toISOString().slice(0, 10);

const fmtLongDate = (date) =>
 date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

const fmtInstant = (date, timeZone) => {
 const parts = new Intl.DateTimeFormat('en-CA', {
  timeZone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
 }).formatToParts(date);
 const get = (type) => parts.find((p) => p.type === type)?.value ?? '';
 return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`;
};

// A figure that could not be computed prints an em dash with a footnote
// mark, never 0 and never a generic label — "9. Notes", mockup:2852.
class Footnotes {
 constructor() {
  this._text = [];
  this._index = new Map();
 }

 mark(text) {
  if (!text) return null;
  if (!this._index.has(text)) {
   this._index.set(text, this._text.length + 1);
   this._text.push(text);
  }
  return this._index.get(text);
 }

 all() {
  return this._text;
 }
}

const dashCell = (footnotes, text) => {
 const mark = footnotes.mark(text);
 return mark ? `— (${mark})` : '—';
};

const rowByMetric = (rows, metric) => rows.find((row) => row.metric === metric) ?? { month: null, yearToDate: null };

// ============================================================================
// Table primitive — every table in the document (page 1's two tables, the
// monthly breakdown, category detail, accounts & balances, budget, savings
// goals, debts and pockets tables) shares one header band, one hairline rule
// per row and one strong rule above a total row (mockup:1693-1820).
// ============================================================================
function drawTable(doc, { x, y, width, columns, rows, compact = false }) {
 const rowH = compact ? 11.5 : 13.5;
 const headerH = 14;
 const bodyFontSize = compact ? 6.5 : 7.5;
 const headerFontSize = compact ? 6.5 : 7;

 doc.rect(x, y, width, headerH).fill(PALETTE.info);
 let cx = x;
 doc.font('Helvetica-Bold').fontSize(headerFontSize).fillColor(PALETTE.onDark);
 columns.forEach((col) => {
  doc.text(col.label, cx + 4, y + 4, { width: col.width - 8, align: col.align ?? 'left' });
  cx += col.width;
 });

 let cy = y + headerH;
 rows.forEach((row) => {
  if (row.variant === 'group') cy += 3;

  if (row.variant === 'total') {
   doc.moveTo(x, cy).lineTo(x + width, cy).strokeColor(PALETTE.borderStrong).lineWidth(1).stroke();
  }

  const bold = row.variant === 'total' || row.variant === 'group' || row.variant === 'strong';
  doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bodyFontSize);

  let cx2 = x;
  columns.forEach((col, i) => {
   const cell = row.cells[i] ?? '';
   const muted = row.mutedCols?.includes(i) ?? false;
   doc.fillColor(muted ? PALETTE.secondary : PALETTE.ink);
   let padLeft = 4;
   if (i === 0 && row.variant === 'indent') padLeft = 14;
   if (i === 0 && row.variant === 'detail') padLeft = 24;
   doc.text(String(cell), cx2 + padLeft, cy + 2.5, { width: col.width - padLeft - 4, align: col.align ?? 'left' });
   cx2 += col.width;
  });

  cy += rowH;
  doc.moveTo(x, cy).lineTo(x + width, cy).strokeColor(PALETTE.hairline).lineWidth(0.5).stroke();
 });

 return cy;
}

function drawSectionHeading(doc, x, y, width, title, qualifier) {
 doc.rect(x, y + 1, 2, 9).fill(PALETTE.info);
 doc.font('Helvetica-Bold').fontSize(8).fillColor(PALETTE.ink).text(title.toUpperCase(), x + 7, y, { continued: !!qualifier });
 if (qualifier) {
  doc.font('Helvetica').fontSize(8).fillColor(PALETTE.secondary).text(`  ${qualifier}`);
 }
 return y + 15;
}

function drawNote(doc, x, y, width, text, { italic = false } = {}) {
 doc.font(italic ? 'Helvetica-Oblique' : 'Helvetica').fontSize(6.5).fillColor(PALETTE.secondary).text(text, x, y, { width });
 return doc.y + 4;
}

// ============================================================================
// Charts
// ============================================================================
function drawRingArc(doc, cx, cy, outerR, innerR, startFrac, endFrac, color) {
 if (endFrac <= startFrac) return;
 const steps = Math.max(2, Math.round(72 * (endFrac - startFrac)));
 const a0 = -Math.PI / 2 + startFrac * 2 * Math.PI;
 const a1 = -Math.PI / 2 + endFrac * 2 * Math.PI;
 doc.moveTo(cx + outerR * Math.cos(a0), cy + outerR * Math.sin(a0));
 for (let i = 1; i <= steps; i += 1) {
  const a = a0 + ((a1 - a0) * i) / steps;
  doc.lineTo(cx + outerR * Math.cos(a), cy + outerR * Math.sin(a));
 }
 for (let i = steps; i >= 0; i -= 1) {
  const a = a0 + ((a1 - a0) * i) / steps;
  doc.lineTo(cx + innerR * Math.cos(a), cy + innerR * Math.sin(a));
 }
 doc.closePath().fill(color);
}

// Section 7's execution ring: the executed arc in its status ink over a
// light track (mockup:2653-2678).
function drawExecutionDonut(doc, { x, y, width, categoryExecution }) {
 const cx = x + 60;
 const cy = y + 60;
 const outerR = 46;
 const innerR = 30;
 doc.circle(cx, cy, outerR).fill(PALETTE.disabled);
 doc.circle(cx, cy, innerR).fill('#ffffff');

 if (categoryExecution && categoryExecution.executionPercentage !== null) {
  const ratio = Math.min(1, Math.max(0, categoryExecution.executionPercentage));
  drawRingArc(doc, cx, cy, outerR, innerR, 0, ratio, executionColorFor(categoryExecution.executionPercentage));
  doc.font('Helvetica-Bold').fontSize(14).fillColor(PALETTE.ink)
   .text(fmtRate(categoryExecution.executionPercentage), cx - 40, cy - 8, { width: 80, align: 'center' });
  doc.font('Helvetica').fontSize(7).fillColor(PALETTE.secondary)
   .text('executed', cx - 40, cy + 8, { width: 80, align: 'center' });
 } else {
  doc.font('Helvetica').fontSize(7).fillColor(PALETTE.secondary).text('No budget in force', cx - 40, cy - 4, { width: 80, align: 'center' });
 }

 // Starts level with the ring rather than the card's top edge (mockup:2663-
 // 2670: labels at y 30/64/98 inside the same 164-tall block, centered
 // against the ring's own cy 59) — the previous y + 6 start left the panel
 // hugging the top, well above the donut it sits beside.
 const infoX = x + 124;
 let infoY = y + 30;
 const infoRow = (label, value) => {
  doc.font('Helvetica').fontSize(7).fillColor(PALETTE.secondary).text(label, infoX, infoY);
  doc.font('Helvetica').fontSize(8.5).fillColor(PALETTE.ink)
   .text(value, infoX, infoY + 14, { width: width - 124, align: 'right' });
  doc.moveTo(infoX, infoY + 21).lineTo(x + width, infoY + 21).strokeColor(PALETTE.hairline).lineWidth(0.5).stroke();
  infoY += 34;
 };
 if (categoryExecution) {
  infoRow('Budget', fmtNumber(categoryExecution.budgetAmount ?? 0));
  infoRow('Spent', fmtNumber(categoryExecution.spentAmount ?? 0));
  infoRow('Remaining', fmtNumber(categoryExecution.remainingBudget ?? 0));
 }

 // Below both the ring's own bottom edge (cy + outerR = y + 106) and the
 // panel's last hairline (now at y + 30 + 2*34 + 21 = y + 119), matching the
 // mockup's own legend start at y + 124 (mockup:2673).
 let legendY = y + 124;
 const legend = [
  [PALETTE.executionOk, 'under 75% on track'],
  [PALETTE.executionNear, '75% to 100% near the limit'],
  [PALETTE.executionOver, 'over 100% over budget'],
 ];
 legend.forEach(([color, label]) => {
  doc.rect(x, legendY, 6, 6).fill(color);
  doc.font('Helvetica').fontSize(6.5).fillColor(PALETTE.ink).text(label, x + 10, legendY - 1, { width: width - 10 });
  legendY += 11;
 });

 return y + 164;
}

// Sections 3 and 10: grouped bars (or none) plus a halo'd line, the shared
// geometry between "Income and expenses by month" and the debt trend chart.
// Both carry a swatch-plus-word legend above the plot, anchored at the
// y-axis (mockup:2427-2435 for flow, 2929-2936 for debt).
function drawSeriesChart(doc, { x, y, width, height, months, mode }) {
 const padding = { left: 46, right: 6, top: 20, bottom: 20 };
 const plotX = x + padding.left;
 const plotY = y + padding.top;
 const plotW = width - padding.left - padding.right;
 const plotH = height - padding.top - padding.bottom;

 // Legend anchored at plotX, level with the y-axis start, not the chart's
 // outer edge — the axis number gutter otherwise leaves it stranded to the
 // left of the grid it describes.
 const legendY = y + 2;
 if (mode === 'debt') {
  doc.moveTo(plotX, legendY + 3).lineTo(plotX + 14, legendY + 3).strokeColor(PALETTE.success).lineWidth(1.5).stroke();
  doc.circle(plotX + 7, legendY + 3, 1.8).fill(PALETTE.success);
  doc.font('Helvetica').fontSize(6.5).fillColor(PALETTE.ink).text('Receivable', plotX + 18, legendY - 1);
  doc.moveTo(plotX + 84, legendY + 3).lineTo(plotX + 98, legendY + 3).strokeColor(PALETTE.error).lineWidth(1.5).stroke();
  doc.circle(plotX + 91, legendY + 3, 1.8).fill(PALETTE.error);
  doc.font('Helvetica').fontSize(6.5).fillColor(PALETTE.ink).text('Payable', plotX + 102, legendY - 1);
 } else {
  doc.rect(plotX, legendY, 8, 8).fill(PALETTE.ink);
  doc.font('Helvetica').fontSize(6.5).fillColor(PALETTE.ink).text('Income', plotX + 12, legendY + 1);
  doc.rect(plotX + 62, legendY, 8, 8).fill(PALETTE.disabled);
  doc.font('Helvetica').fontSize(6.5).fillColor(PALETTE.ink).text('Expenses', plotX + 74, legendY + 1);
  doc.moveTo(plotX + 138, legendY + 4).lineTo(plotX + 152, legendY + 4).strokeColor(PALETTE.info).lineWidth(1.5).stroke();
  doc.circle(plotX + 145, legendY + 4, 1.8).fill(PALETTE.info);
  doc.font('Helvetica').fontSize(6.5).fillColor(PALETTE.info).text('Net flow', plotX + 156, legendY + 1);
 }

 const values =
  mode === 'flow'
   ? months.flatMap((m) => [m.income, m.expense, m.netFlow])
   : months.flatMap((m) => [m.receivable, m.payable]);
 const maxV = Math.max(0, ...values);
 const minV = Math.min(0, ...values);
 const range = maxV - minV || 1;
 const yAt = (v) => plotY + plotH - ((v - minV) / range) * plotH;
 const zeroY = yAt(0);

 for (let i = 0; i <= 4; i += 1) {
  const v = minV + (range * i) / 4;
  const gy = yAt(v);
  doc.moveTo(plotX, gy).lineTo(plotX + plotW, gy).strokeColor(PALETTE.hairline).lineWidth(0.5).stroke();
  doc.font('Helvetica').fontSize(6).fillColor(PALETTE.secondary).text(fmtNumber(v), x, gy - 3, { width: padding.left - 6, align: 'right' });
 }
 doc.moveTo(plotX, zeroY).lineTo(plotX + plotW, zeroY).strokeColor(PALETTE.borderStrong).lineWidth(1).stroke();

 const n = months.length;
 const slot = plotW / n;
 const xAt = (i) => plotX + slot * i + slot / 2;

 if (mode === 'flow') {
  const barW = slot * 0.24;
  months.forEach((m, i) => {
   const cx = xAt(i);
   doc.rect(cx - barW - 1, Math.min(zeroY, yAt(m.income)), barW, Math.abs(yAt(m.income) - zeroY)).fill(PALETTE.ink);
   doc.rect(cx + 1, Math.min(zeroY, yAt(m.expense)), barW, Math.abs(yAt(m.expense) - zeroY)).fill(PALETTE.disabled);
  });
  const points = months.map((m, i) => [xAt(i), yAt(m.netFlow)]);
  doc.moveTo(points[0][0], points[0][1]);
  points.slice(1).forEach(([px, py]) => doc.lineTo(px, py));
  doc.strokeColor('#ffffff').lineWidth(4).lineJoin('round').stroke();
  doc.moveTo(points[0][0], points[0][1]);
  points.slice(1).forEach(([px, py]) => doc.lineTo(px, py));
  doc.strokeColor(PALETTE.info).lineWidth(1.5).lineJoin('round').stroke();
  points.forEach(([px, py]) => doc.circle(px, py, 2).fill(PALETTE.info));
 } else {
  const drawLine = (key, color) => {
   const points = months.map((m, i) => [xAt(i), yAt(m[key])]);
   doc.moveTo(points[0][0], points[0][1]);
   points.slice(1).forEach(([px, py]) => doc.lineTo(px, py));
   doc.strokeColor(color).lineWidth(1.5).lineJoin('round').stroke();
   points.forEach(([px, py]) => doc.circle(px, py, 2).fill(color));
  };
  drawLine('payable', PALETTE.error);
  drawLine('receivable', PALETTE.success);
 }

 doc.font('Helvetica').fontSize(7).fillColor(PALETTE.secondary);
 months.forEach((m, i) => {
  doc.text(m.label, xAt(i) - slot / 2, plotY + plotH + 5, { width: slot, align: 'center' });
 });

 return y + height;
}

// Section 4's ranked "table drawn as a chart": blue header band, one bar per
// category, the row crossing 80% cumulative bold (mockup:2494-2560).
function drawRankedCategoryChart(doc, { x, y, width, rows, total }) {
 const headerH = 14;
 const labelW = 86;
 const amountW = 64;
 const shareW = 50;
 const cumulativeW = 56;
 const barLeft = x + labelW;
 const barMaxWidth = width - labelW - amountW - shareW - cumulativeW - 8;

 doc.rect(x, y, width, headerH).fill(PALETTE.info);
 doc.font('Helvetica-Bold').fontSize(7).fillColor(PALETTE.onDark);
 doc.text('Category', x + 4, y + 4, { width: labelW });
 doc.text('Amount', x + width - amountW - shareW - cumulativeW, y + 4, { width: amountW, align: 'right' });
 doc.text('Share', x + width - shareW - cumulativeW, y + 4, { width: shareW, align: 'right' });
 doc.text('Cumulative', x + width - cumulativeW - 4, y + 4, { width: cumulativeW, align: 'right' });

 let cy = y + headerH + 5;
 const maxSpend = Math.max(1, ...rows.map((r) => r.actualSpent ?? 0));
 const crossIndex = rows.findIndex((r) => (r.cumulativePercentage ?? 0) >= 0.8);

 rows.forEach((row, i) => {
  const bold = i === crossIndex;
  const font = bold ? 'Helvetica-Bold' : 'Helvetica';
  doc.font(font).fontSize(7.5).fillColor(PALETTE.ink).text(row.categoryName, x, cy, { width: labelW - 4 });
  const barW = ((row.actualSpent ?? 0) / maxSpend) * barMaxWidth;
  doc.rect(barLeft, cy + 2.5, Math.max(1, barW), 5).fill(PALETTE.ink);
  doc.font(font).fontSize(7.5).fillColor(PALETTE.ink)
   .text(fmtNumber(row.actualSpent ?? 0), x + width - amountW - shareW - cumulativeW, cy, { width: amountW, align: 'right' });
  doc.font(font).fontSize(7.5).fillColor(bold ? PALETTE.ink : PALETTE.secondary)
   .text(fmtRate(total ? (row.actualSpent ?? 0) / total : 0), x + width - shareW - cumulativeW, cy, { width: shareW, align: 'right' });
  doc.font(font).fontSize(7.5).fillColor(bold ? PALETTE.ink : PALETTE.secondary)
   .text(fmtRate(row.cumulativePercentage ?? 0), x + width - cumulativeW - 4, cy, { width: cumulativeW, align: 'right' });
  cy += 14;
 });

 doc.moveTo(x, cy).lineTo(x + width, cy).strokeColor(PALETTE.borderStrong).lineWidth(1).stroke();
 cy += 4;
 doc.font('Helvetica-Bold').fontSize(7.5).fillColor(PALETTE.ink);
 doc.text('Total', x, cy, { width: labelW });
 doc.text(fmtNumber(total), x + width - amountW - shareW - cumulativeW, cy, { width: amountW, align: 'right' });
 doc.text('100.0%', x + width - shareW - cumulativeW, cy, { width: shareW, align: 'right' });
 doc.text('100.0%', x + width - cumulativeW - 4, cy, { width: cumulativeW, align: 'right' });

 return cy + 14;
}

// Section 7's Pareto: spent bars (filled) beside budget bars (outline), two
// cumulative lines and the 80% mark (mockup:2687-2811). The legend sits above
// the plot, in one row exactly as the mockup's own SVG draws it
// (2690-2699) — split across two rows it read as broken. Every legend
// text() call resets fillColor first: the swatches drawn with .fill()/.stroke()
// leave that as pdfkit's current fill color, and a text() right after one
// without its own fillColor() call inherits the swatch's ink instead of
// PALETTE.ink.
function drawParetoChart(doc, { x, y, width, height, rows }) {
 const shown = rows.slice(0, 10);
 const padding = { left: 40, right: 4, top: 20, bottom: 42 };
 const plotX = x + padding.left;
 const plotY = y + padding.top;
 const plotW = width - padding.left - padding.right;
 const plotH = height - padding.top - padding.bottom;
 const n = Math.max(1, shown.length);
 const slot = plotW / n;
 const maxSpend = Math.max(1, ...shown.map((r) => Math.max(r.actualSpent ?? 0, r.budgetAmount ?? 0)));
 const pctY = (p) => plotY + plotH - Math.min(1, Math.max(0, p ?? 0)) * plotH;

 // legend, single row above the plot, anchored at plotX (the axis start)
 // rather than x (the y-axis number gutter) so it lines up with the grid it
 // describes instead of floating over the tick labels. Each item's x follows
 // the previous item's measured text width rather than a fixed offset, so
 // the row never overlaps itself regardless of paretoW.
 const legendY = y;
 const GAP = 6;
 let lx = plotX;
 doc.font('Helvetica').fontSize(6.5);
 doc.rect(lx, legendY, 6, 6).fill(PALETTE.categoryOne);
 doc.fillColor(PALETTE.ink).text('Spent', lx + 9, legendY - 1);
 lx += 9 + doc.widthOfString('Spent') + GAP;
 doc.rect(lx, legendY, 6, 6).lineWidth(0.75).strokeColor(PALETTE.secondary).stroke();
 doc.font('Helvetica').fontSize(6.5).fillColor(PALETTE.ink).text('Budget', lx + 9, legendY - 1);
 lx += 9 + doc.widthOfString('Budget') + GAP;
 doc.moveTo(lx, legendY + 3).lineTo(lx + 14, legendY + 3).strokeColor(PALETTE.executionOver).lineWidth(1.5).stroke();
 doc.circle(lx + 7, legendY + 3, 1.8).fill(PALETTE.executionOver);
 doc.font('Helvetica').fontSize(6.5).fillColor(PALETTE.ink).text('Cumulative % of spending', lx + 18, legendY - 1);
 lx += 18 + doc.widthOfString('Cumulative % of spending') + GAP;
 doc.save();
 doc.dash(3, { space: 2 }).moveTo(lx, legendY + 3).lineTo(lx + 14, legendY + 3).strokeColor(PALETTE.info).lineWidth(1.25).stroke();
 doc.undash();
 doc.restore();
 doc.circle(lx + 7, legendY + 3, 1.8).fill(PALETTE.info);
 doc.font('Helvetica').fontSize(6.5).fillColor(PALETTE.ink).text('Cumulative % of budget', lx + 18, legendY - 1);

 for (let i = 0; i <= 5; i += 1) {
  const gy = plotY + (plotH * i) / 5;
  doc.moveTo(plotX, gy).lineTo(plotX + plotW, gy).strokeColor(PALETTE.hairline).lineWidth(0.5).stroke();
  doc.font('Helvetica').fontSize(6).fillColor(PALETTE.secondary)
   .text(fmtNumber(maxSpend * (1 - i / 5)), x, gy - 3, { width: padding.left - 6, align: 'right' });
  doc.font('Helvetica').fontSize(6).fillColor(PALETTE.secondary)
   .text(`${100 - i * 20}%`, plotX + plotW + 2, gy - 3, { width: padding.right + 26 });
 }

 doc.save();
 doc.dash(1, { space: 2 }).moveTo(plotX, pctY(0.8)).lineTo(plotX + plotW, pctY(0.8)).strokeColor(PALETTE.secondary).lineWidth(0.75).stroke();
 doc.undash();
 doc.restore();

 if (shown.length === 0) {
  doc.font('Helvetica').fontSize(7).fillColor(PALETTE.secondary).text('No categorized expense this month.', x, plotY + plotH / 2);
  return y + height;
 }

 shown.forEach((row, i) => {
  const cx = plotX + slot * i;
  const barW = slot * 0.32;
  const hasBudget = row.budgetAmount !== null && row.budgetAmount !== undefined;
  const pairWidth = hasBudget ? barW * 2 + 3 : barW;
  const pairLeft = cx + (slot - pairWidth) / 2;
  const spentH = ((row.actualSpent ?? 0) / maxSpend) * plotH;
  doc.rect(pairLeft, plotY + plotH - spentH, barW, spentH).fill(PALETTE.categoryOne);
  if (hasBudget) {
   const budgetH = (row.budgetAmount / maxSpend) * plotH;
   doc.rect(pairLeft + barW + 3, plotY + plotH - budgetH, barW, budgetH)
    .lineWidth(0.75).strokeColor(PALETTE.secondary).stroke();
  }
 });

 const drawLine = (key, color, dashed) => {
  const points = shown.map((row, i) => [plotX + slot * i + slot / 2, pctY(row[key])]);
  doc.moveTo(points[0][0], points[0][1]);
  points.slice(1).forEach(([px, py]) => doc.lineTo(px, py));
  doc.strokeColor(color).lineWidth(1.25);
  if (dashed) doc.dash(3, { space: 2 });
  doc.stroke();
  if (dashed) doc.undash();
  points.forEach(([px, py]) => doc.circle(px, py, 1.8).fill(color));
 };
 drawLine('cumulativeBudgetPercentage', PALETTE.info, true);
 drawLine('cumulativePercentage', PALETTE.executionOver, false);

 // The spending line's own value at each point (mockup:2787-2794) — the
 // budget line does not carry one, matching the mockup.
 doc.font('Helvetica-Bold').fontSize(6).fillColor(PALETTE.executionOver);
 shown.forEach((row, i) => {
  const px = plotX + slot * i + slot / 2;
  const py = pctY(row.cumulativePercentage);
  doc.text(fmtRate(row.cumulativePercentage), px - 15, py - 9, { width: 30, align: 'center' });
 });

 doc.moveTo(plotX, plotY + plotH).lineTo(plotX + plotW, plotY + plotH).strokeColor(PALETTE.borderStrong).lineWidth(1).stroke();

 shown.forEach((row, i) => {
  const px = plotX + slot * i + slot / 2;
  const labelY = plotY + plotH + 6;
  doc.save();
  doc.rotate(-40, { origin: [px, labelY] });
  const label = row.isOverBudget ? `${row.categoryName} · over` : row.categoryName;
  doc.font(row.isOverBudget ? 'Helvetica-Bold' : 'Helvetica').fontSize(6).fillColor(PALETTE.ink)
   .text(label, px - 60, labelY, { width: 60, align: 'right' });
  doc.restore();
 });

 return y + height + 4;
}

// Section 11's per-pocket committed-of-target bars (mockup:3009-3030).
function drawPocketBars(doc, { x, y, width, pockets }) {
 const rowH = 18;
 const labelW = 96;
 const shareW = 44;
 const trackX = x + labelW;
 const trackW = width - labelW - shareW;

 pockets.forEach((pocket, i) => {
  const ry = y + i * rowH;
  doc.font('Helvetica').fontSize(8).fillColor(PALETTE.ink).text(pocket.name, x, ry + 4, { width: labelW - 4 });
  doc.rect(trackX, ry + 4, trackW, 8).fill(PALETTE.disabled);
  const ratio = pocket.target ? Math.min(1, pocket.allocated / pocket.target) : 0;
  doc.rect(trackX, ry + 4, trackW * ratio, 8).fill(POCKET_LEVEL_COLORS[pocket.level] ?? PALETTE.executionOk);
  doc.font('Helvetica').fontSize(7.5).fillColor(PALETTE.secondary)
   .text(pocket.target ? fmtRate(pocket.allocated / pocket.target) : '—', trackX + trackW + 4, ry + 4, { width: shareW - 4, align: 'right' });
 });

 return y + pockets.length * rowH;
}

// Section 11's target-share donut: four pocket identities, not status
// (mockup:3042-3065).
function drawPocketTargetDonut(doc, { x, y, width, pockets }) {
 const withTarget = pockets.filter((p) => p.target);
 const totalTarget = withTarget.reduce((sum, p) => sum + p.target, 0);
 const cx = x + 54;
 const cy = y + 58;
 const outerR = 44;
 const innerR = 30;

 doc.circle(cx, cy, outerR).fill(PALETTE.disabled);
 doc.circle(cx, cy, innerR).fill('#ffffff');
 let start = 0;
 withTarget.forEach((pocket, i) => {
  const frac = totalTarget ? pocket.target / totalTarget : 0;
  drawRingArc(doc, cx, cy, outerR, innerR, start, start + frac, POCKET_COLORS[i % POCKET_COLORS.length]);
  start += frac;
 });
 doc.font('Helvetica-Bold').fontSize(11).fillColor(PALETTE.ink).text(fmtNumber(totalTarget), cx - 40, cy - 8, { width: 80, align: 'center' });
 doc.font('Helvetica').fontSize(6.5).fillColor(PALETTE.secondary).text('total target', cx - 40, cy + 6, { width: 80, align: 'center' });

 let legendY = y + 10;
 withTarget.forEach((pocket, i) => {
  doc.rect(x + 118, legendY, 7, 7).fill(POCKET_COLORS[i % POCKET_COLORS.length]);
  doc.font('Helvetica').fontSize(7).fillColor(PALETTE.ink)
   .text(`${pocket.name} ${fmtRate(totalTarget ? pocket.target / totalTarget : 0)}`, x + 129, legendY, { width: width - 129 });
  legendY += 13;
 });

 return y + 118;
}

// ============================================================================
// Page geometry
// ============================================================================
const M = 42;

function pageHeader(doc, { periodLabel, section, isFirst, generatedLabel, timeZone, yearToDateRangeLabel }) {
 const CW = doc.page.width - 2 * M;

 if (isFirst) {
  let cy = M - 4;
  drawWordmark(doc, M, cy, 15, PALETTE.ink);
  doc.rect(doc.page.width - M - 100, cy, 100, 13).strokeColor(PALETTE.borderStrong).lineWidth(0.75).stroke();
  doc.font('Helvetica').fontSize(6.5).fillColor(PALETTE.ink)
   .text('PERIOD STATEMENT', doc.page.width - M - 100, cy + 3.5, { width: 100, align: 'center' });

  cy += 26;
  doc.font('Helvetica-Bold').fontSize(15).fillColor(PALETTE.ink).text(`Period Statement — ${periodLabel}`, M, cy, { width: CW });
  cy = doc.y + 3;
  doc.font('Helvetica').fontSize(7.5).fillColor(PALETTE.secondary)
   .text('Monthly summary of cash flow, balances and net worth, in the accounting currency (USD).', M, cy, { width: CW });
  cy = doc.y + 8;

  doc.rect(M, cy, CW, 16).strokeColor(PALETTE.hairline).lineWidth(0.5).stroke();
  doc.font('Helvetica').fontSize(6.5).fillColor(PALETTE.ink);
  const factsY = cy + 5;
  doc.text(`Generated: ${generatedLabel}`, M + 6, factsY, { width: 170 });
  doc.text(`Timezone: ${timeZone}`, M + 180, factsY, { width: 150 });
  doc.text(`Year to date: ${yearToDateRangeLabel}`, M + 335, factsY, { width: CW - 341 });
  return cy + 26;
 }

 doc.font('Helvetica-Bold').fontSize(6.5).fillColor(PALETTE.ink).text('FinTrack', M, M - 12, { continued: true });
 doc.font('Helvetica').fillColor(PALETTE.secondary).text(` · Period statement · ${periodLabel}`);
 doc.font('Helvetica-Bold').fontSize(6.5).fillColor(PALETTE.ink).text(section, M, M - 12, { width: CW, align: 'right' });
 doc.moveTo(M, M).lineTo(doc.page.width - M, M).strokeColor(PALETTE.hairline).lineWidth(0.5).stroke();
 return M + 12;
}

// Drawn below doc.page.margins.bottom on purpose (the footer sits inside the
// margin band, not the body). pdfkit's .text() auto-paginates any call whose
// position falls past that boundary regardless of explicit x/y, so the
// bottom margin is zeroed for the duration of this call and restored after —
// the standard pdfkit footer idiom.
function pageFooter(doc, { generatedLabel, timeZone, pageNumber, pageCount }) {
 const CW = doc.page.width - 2 * M;
 const fy = doc.page.height - M + 8;
 const originalBottom = doc.page.margins.bottom;
 doc.page.margins.bottom = 0;

 doc.moveTo(M, fy - 6).lineTo(doc.page.width - M, fy - 6).strokeColor(PALETTE.hairline).lineWidth(0.5).stroke();
 doc.font('Helvetica').fontSize(6).fillColor(PALETTE.secondary);
 doc.text('Figures in USD, the accounting currency; no conversion applied.', M, fy, { width: 260, lineBreak: false });
 doc.text(`Generated ${generatedLabel} ${timeZone}`, M + 260, fy, { width: CW - 320, align: 'center', lineBreak: false });
 doc.font('Helvetica-Bold').fillColor(PALETTE.ink)
  .text(`Page ${pageNumber} of ${pageCount}`, doc.page.width - M - 60, fy, { width: 60, align: 'right', lineBreak: false });

 doc.page.margins.bottom = originalBottom;
}

// Pages 5-7 are each one section's own data (debts by counterparty, pockets)
// and are skipped outright when that data is empty, so the page count is not
// fixed at 7 - it is only known once rendering finishes. bufferPages keeps
// every page addressable afterwards so the footer can be drawn once per page
// with the real total, instead of a number decided before the last page
// existed.
export async function writeStatementPdf(data, { generatedAt, timeZone }) {
 return new Promise((resolve, reject) => {
  const doc = new PDFDocument({ size: 'A4', margin: M, bufferPages: true });
  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));
  doc.on('end', () => resolve(Buffer.concat(chunks)));
  doc.on('error', reject);

  try {
   renderDocument(doc, data, { generatedAt, timeZone });
   doc.end();
  } catch (error) {
   reject(error);
  }
 });
}

function renderDocument(doc, data, { generatedAt, timeZone }) {
 const {
  referenceMonth,
  executiveSummaryRows,
  financialGoals,
  categories,
  categoryExecution,
  debtAnalysis,
  pocketBoard,
  priorAllocatedByPocketId,
  pocketSourcesByPocket,
  accountsAndBalances,
  priorBalanceByAccountId,
  monthlyBreakdown,
 } = data;

 const periodLabel = fmtMonthYear(referenceMonth);
 const closeDate = lastDayOfMonth(referenceMonth);
 const closeLabel = fmtLongDate(closeDate);
 const generatedLabel = fmtInstant(generatedAt, timeZone);
 const yearToDateRangeLabel = `${referenceMonth.slice(0, 4)}-01-01 to ${fmtISODate(closeDate)}`;
 const footnotes = new Footnotes();
 const CW = doc.page.width - 2 * M;
 const metric = (name) => rowByMetric(executiveSummaryRows, name);

 // Footers are drawn in a second pass, once bufferedPageRange() knows how
 // many pages actually got created (renderDocument below), so this only
 // draws the header and never touches pageNumber/pageCount.
 const startPage = (section, isFirst = false) => {
  if (!isFirst) doc.addPage();
  return pageHeader(doc, { periodLabel, section, isFirst, generatedLabel, timeZone, yearToDateRangeLabel });
 };

 // =====================================================================
 // Page 1 — summary
 // =====================================================================
 let y = startPage('Summary', true);

 const tiles = [
  { label: 'Net worth', metric: 'netWorth', arrow: true },
  { label: 'Net monthly flow', metric: 'netMonthlyFlow', arrow: false },
  { label: 'Free cash', metric: 'freeCash', arrow: true },
  { label: 'Savings rate', metric: 'savingsRate', rate: true },
 ];
 const tileW = CW / 4 - 6;
 tiles.forEach((tile, i) => {
  const tx = M + i * (CW / 4);
  const row = metric(tile.metric);
  doc.rect(tx, y, tileW, 48).strokeColor(PALETTE.hairline).lineWidth(0.5).stroke();
  if (i === 0) doc.rect(tx, y, tileW, 48).fill(PALETTE.tilePrimary);
  const ink = PALETTE.ink;
  const muted = PALETTE.secondary;
  doc.font('Helvetica').fontSize(6.5).fillColor(muted).text(tile.label.toUpperCase(), tx + 6, y + 6, { width: tileW - 12 });
  const value = tile.rate ? fmtRate(row.month) : fmtNumber(row.month);
  doc.font('Helvetica-Bold').fontSize(13).fillColor(ink).text(value ?? '—', tx + 6, y + 16, { width: tileW - 12 });
  const ytdText = tile.rate ? fmtRate(row.yearToDate) : fmtNumber(row.yearToDate, { signed: true });
  const pillText = `${ytdText} YTD`;
  const positive = tile.arrow && typeof row.yearToDate === 'number' && row.yearToDate > 0;
  if (positive) {
   const pillY = y + 34;
   const pillH = 12;
   const arrowW = 8;
   const textW = doc.font('Helvetica').fontSize(6.5).widthOfString(pillText);
   const pillW = arrowW + textW + 10;
   doc.roundedRect(tx + 6, pillY, pillW, pillH, pillH / 2)
    .fillAndStroke(PALETTE.pillPositiveSurface, PALETTE.pillPositiveBorder);
   doc.save();
   doc.translate(tx + 10, pillY + 3).scale(0.5);
   doc.path('M6 2.5L10 9H2Z').fill(PALETTE.success);
   doc.restore();
   doc.font('Helvetica').fontSize(6.5).fillColor(PALETTE.success).text(pillText, tx + 6 + arrowW + 4, pillY + 3, { width: pillW - arrowW - 4 });
  } else {
   doc.font('Helvetica').fontSize(6.5).fillColor(muted).text(pillText, tx + 6, y + 36, { width: tileW - 12 });
  }
 });
 y += 58;

 y = drawSectionHeading(doc, M, y, CW, '1. Cash flow summary');
 const incomeRow = metric('income');
 const expenseRow = metric('expenses');
 const netFlowRow = metric('netMonthlyFlow');
 const savingsRow = metric('savingsRate');
 y = drawTable(doc, {
  x: M,
  y,
  width: CW,
  columns: [
   { label: 'Metric', width: CW - 240 },
   { label: 'Month (USD)', width: 120, align: 'right' },
   { label: 'Year to date (USD)', width: 120, align: 'right' },
  ],
  rows: [
   { cells: ['Income', fmtNumber(incomeRow.month), fmtNumber(incomeRow.yearToDate)], mutedCols: [2] },
   { cells: ['Expenses', fmtNumber(expenseRow.month), fmtNumber(expenseRow.yearToDate)], mutedCols: [2] },
   {
    cells: ['Net monthly flow', fmtNumber(netFlowRow.month, { signed: true }), fmtNumber(netFlowRow.yearToDate, { signed: true })],
    mutedCols: [2],
    variant: 'total',
   },
   { cells: ['Savings rate', fmtRate(savingsRow.month), fmtRate(savingsRow.yearToDate)], mutedCols: [2] },
  ],
 });
 y = drawNote(doc, M, y + 3, CW, 'Year to date savings rate is net flow over income for the year so far, not an average of monthly rates.', { italic: true });

 y = drawSectionHeading(doc, M, y + 6, CW, '2. Financial position');
 const cashRow = metric('cashPosition');
 const pocketsRow = metric('pocketsCommitted');
 const freeCashRow = metric('freeCash');
 const investRow = metric('investments');
 const receivableRow = metric('receivable');
 const payableRow = metric('payable');
 const netDebtRow = metric('netDebtPosition');
 const netWorthRow = metric('netWorth');
 const liquidRow = metric('liquidNetWorth');
 const assetsMonth = (cashRow.month ?? 0) + (investRow.month ?? 0) + (receivableRow.month ?? 0);
 const assetsYtd = (cashRow.yearToDate ?? 0) + (investRow.yearToDate ?? 0) + (receivableRow.yearToDate ?? 0);
 const liabilitiesMonth = payableRow.month ?? 0;
 const liabilitiesYtd = payableRow.yearToDate ?? 0;

 y = drawTable(doc, {
  x: M,
  y,
  width: CW,
  columns: [
   { label: 'Metric', width: CW - 240 },
   { label: 'At month close (USD)', width: 120, align: 'right' },
   { label: 'Change since Jan 1 (USD)', width: 120, align: 'right' },
  ],
  rows: [
   { cells: ['Cash position', fmtNumber(cashRow.month), fmtNumber(cashRow.yearToDate, { signed: true })], mutedCols: [2], variant: 'strong' },
   { cells: ['Committed in pockets', fmtNumber(pocketsRow.month), fmtNumber(pocketsRow.yearToDate, { signed: true })], mutedCols: [1, 2], variant: 'detail' },
   { cells: ['Free cash', fmtNumber(freeCashRow.month), fmtNumber(freeCashRow.yearToDate, { signed: true })], mutedCols: [1, 2], variant: 'detail' },
   { cells: ['Investments (ledger balance)', fmtNumber(investRow.month), fmtNumber(investRow.yearToDate, { signed: true })], mutedCols: [2] },
   { cells: ['Owed to you', fmtNumber(receivableRow.month), fmtNumber(receivableRow.yearToDate, { signed: true })], mutedCols: [2] },
   { cells: ['You owe', fmtNumber(payableRow.month), fmtNumber(payableRow.yearToDate, { signed: true })], mutedCols: [2] },
   { cells: ['Net debt position', fmtNumber(netDebtRow.month), fmtNumber(netDebtRow.yearToDate, { signed: true })], mutedCols: [2] },
   { cells: ['Net worth', fmtNumber(netWorthRow.month), fmtNumber(netWorthRow.yearToDate, { signed: true })], mutedCols: [2], variant: 'total' },
   { cells: ['Liquid net worth', fmtNumber(liquidRow.month), fmtNumber(liquidRow.yearToDate, { signed: true })], mutedCols: [2] },
   { cells: ['Assets and liabilities', '', ''], variant: 'group' },
   { cells: ['Assets', fmtNumber(assetsMonth), fmtNumber(assetsYtd, { signed: true })], mutedCols: [2], variant: 'indent' },
   { cells: ['Liabilities', fmtNumber(liabilitiesMonth), fmtNumber(liabilitiesYtd, { signed: true })], mutedCols: [2], variant: 'indent' },
   { cells: ['Net worth', fmtNumber(netWorthRow.month), fmtNumber(netWorthRow.yearToDate, { signed: true })], mutedCols: [2], variant: 'total' },
  ],
 });
 drawNote(doc, M, y + 3, CW, 'Committed in pockets and free cash are details of the cash position; pockets are never added to assets.', { italic: true });

 // =====================================================================
 // Page 2 — cash flow
 // =====================================================================
 y = startPage('Cash flow');
 const individualMonths = monthlyBreakdown.individual;
 // Every section heading's qualifier carries its own currency, so the
 // figures below it read unambiguously even lifted out on their own.
 const chartRangeLabel =
  individualMonths.length > 1
   ? `${individualMonths[0].label} to ${individualMonths[individualMonths.length - 1].label} ${referenceMonth.slice(0, 4)}, net flow as a line, USD`
   : 'net flow as a line, USD';
 y = drawSectionHeading(doc, M, y, CW, '3. Income and expenses by month', chartRangeLabel);
 const chartHeight = (CW * 226) / 704;
 y = drawSeriesChart(doc, { x: M, y, width: CW, height: Math.min(chartHeight, 160), months: individualMonths, mode: 'flow' });
 y += 4;

 const monthSlots = individualMonths.length + 1 + (monthlyBreakdown.aggregate ? 1 : 0);
 const labelColW = 70;
 const monthColW = (CW - labelColW) / monthSlots;
 const breakdownColumns = [{ label: referenceMonth.slice(0, 4), width: labelColW, align: 'left' }];
 if (monthlyBreakdown.aggregate) breakdownColumns.push({ label: monthlyBreakdown.aggregate.label, width: monthColW, align: 'right' });
 individualMonths.forEach((m) => breakdownColumns.push({ label: m.label, width: monthColW, align: 'right' }));
 breakdownColumns.push({ label: 'Year to date', width: monthColW, align: 'right' });

 const breakdownRow = (label, key, signed) => {
  const cells = [label];
  const mutedCols = [];
  if (monthlyBreakdown.aggregate) {
   cells.push(fmtNumber(monthlyBreakdown.aggregate[key], { signed }));
   mutedCols.push(1);
  }
  individualMonths.forEach((m) => cells.push(fmtNumber(m[key], { signed })));
  const ytdMetric = key === 'income' ? incomeRow : key === 'expense' ? expenseRow : netFlowRow;
  cells.push(fmtNumber(ytdMetric.yearToDate, { signed }));
  mutedCols.push(cells.length - 1);
  return { cells, mutedCols };
 };
 y = drawTable(doc, {
  x: M,
  y,
  width: CW,
  compact: true,
  columns: breakdownColumns,
  rows: [
   breakdownRow('Income', 'income', false),
   breakdownRow('Expenses', 'expense', false),
   { ...breakdownRow('Net flow', 'netFlow', true), variant: 'total' },
  ],
 });

 y = drawSectionHeading(doc, M, y + 8, CW, '4. Expenses by category', `${periodLabel}, USD`);
 const expenseTotal = expenseRow.month ?? categories.reduce((sum, c) => sum + (c.actualSpent ?? 0), 0);
 const rankedCategories = categories.slice(0, 12);
 if (categories.length === 0) {
  y = drawNote(doc, M, y, CW, 'No categorized expense this month.');
 } else {
  y = drawRankedCategoryChart(doc, { x: M, y, width: CW, rows: rankedCategories, total: expenseTotal });
  if (categories.length > rankedCategories.length) {
   drawNote(doc, M, y + 2, CW, `${categories.length - rankedCategories.length} more categories not shown.`);
  }
 }

 // =====================================================================
 // Page 3 — categories and balances
 // =====================================================================
 y = startPage('Categories and balances');
 y = drawSectionHeading(doc, M, y, CW, '5. Category detail', 'The month against the year to date, USD');
 if (categories.length === 0) {
  y = drawNote(doc, M, y, CW, 'No categorized expense this month.');
 } else {
  const detailCategories = categories.slice(0, 14);
  const ytdUnavailable = footnotes.mark('Year to date is not reported per category in this release.');
  y = drawTable(doc, {
   x: M,
   y,
   width: CW,
   columns: [
    { label: 'Category', width: CW - 5 * 60 },
    { label: periodLabel.split(' ')[0], width: 60, align: 'right' },
    { label: 'Share', width: 60, align: 'right' },
    { label: 'Cumulative', width: 60, align: 'right' },
    { label: 'Year to date', width: 60, align: 'right' },
    { label: 'Share', width: 60, align: 'right' },
   ],
   rows: [
    ...detailCategories.map((c) => ({
     cells: [
      c.categoryName,
      fmtNumber(c.actualSpent ?? 0),
      fmtRate(expenseTotal ? (c.actualSpent ?? 0) / expenseTotal : 0),
      fmtRate(c.cumulativePercentage ?? 0),
      `— (${ytdUnavailable})`,
      `— (${ytdUnavailable})`,
     ],
     mutedCols: [4, 5],
    })),
    {
     cells: ['Total expenses', fmtNumber(expenseTotal), '100.0%', '100.0%', `— (${ytdUnavailable})`, `— (${ytdUnavailable})`],
     mutedCols: [4, 5],
     variant: 'total',
    },
   ],
  });
 }

 y = drawSectionHeading(doc, M, y + 8, CW, '6. Accounts and balances', 'Ledger balances, grouped by account type, USD');
 const GROUPS = [
  { key: 'bankCash', label: 'Bank and cash', types: ['bank', 'cash'], metric: cashRow },
  { key: 'investment', label: 'Investment', types: ['investment'], metric: investRow },
  { key: 'debtor', label: 'Debtors', types: ['debtor'], metric: netDebtRow },
 ];
 const accountRows6 = [];
 GROUPS.forEach((group) => {
  const rows = accountsAndBalances.filter((a) => group.types.includes(a.accountType));
  if (rows.length === 0) return;
  accountRows6.push({
   cells: [group.label, fmtNumber(group.metric.month ?? 0), fmtNumber(group.metric.yearToDate ?? 0, { signed: true })],
   mutedCols: [2],
   variant: 'group',
  });
  rows.forEach((account) => {
   const prior = priorBalanceByAccountId.get(account.accountId);
   const changeCell = prior === undefined ? 'opened this year' : fmtNumber(account.balance - prior, { signed: true });
   accountRows6.push({
    cells: [account.accountName, fmtNumber(account.balance), changeCell],
    mutedCols: [2],
    variant: 'indent',
   });
  });
 });
 accountRows6.push({ cells: ['Net worth', fmtNumber(netWorthRow.month), fmtNumber(netWorthRow.yearToDate, { signed: true })], mutedCols: [2], variant: 'total' });
 drawTable(doc, {
  x: M,
  y,
  width: CW,
  columns: [
   { label: 'Account', width: CW - 240 },
   { label: `${closeLabel} (USD)`, width: 120, align: 'right' },
   { label: 'Change since Jan 1 (USD)', width: 120, align: 'right' },
  ],
  rows: accountRows6,
 });

 // =====================================================================
 // Page 4 — budget and notes
 // =====================================================================
 y = startPage('Budget and notes');
 y = drawSectionHeading(doc, M, y, CW, '7. Budget execution', `${periodLabel}, USD; a remaining in parentheses is over budget`);
 const donutW = 195;
 const paretoW = CW - donutW - 16;
 const chartsTop = y;
 drawExecutionDonut(doc, { x: M, y: chartsTop, width: donutW, categoryExecution });
 y = drawParetoChart(doc, { x: M + donutW + 16, y: chartsTop, width: paretoW, height: 164, rows: categories });
 y = Math.max(y, chartsTop + 164) + 6;

 // The Pareto chart above already prints "No categorized expense this
 // month." when categories is empty; a second copy of the same line under
 // an empty table would say it twice on one page.
 if (categories.length > 0) {
  const noBudgetNote = footnotes.mark('Budget, remaining and used % are not reported because no budget is set for this category.');
  const budgetTotalSpent = categories.reduce((sum, c) => sum + (c.actualSpent ?? 0), 0);
  const budgetTotalBudget = categories.reduce((sum, c) => sum + (c.budgetAmount ?? 0), 0);
  const budgetTotalRemaining = categories.reduce((sum, c) => sum + (c.remainingBudget ?? 0), 0);
  y = drawTable(doc, {
   x: M,
   y,
   width: CW,
   columns: [
    { label: 'Category', width: CW - 3 * 70 - 60 },
    { label: 'Budget (USD)', width: 70, align: 'right' },
    { label: 'Spent (USD)', width: 70, align: 'right' },
    { label: 'Remaining (USD)', width: 70, align: 'right' },
    { label: 'Used %', width: 60, align: 'right' },
   ],
   rows: [
    ...categories.map((c) => ({
     cells: [
      c.categoryName,
      c.budgetAmount === null || c.budgetAmount === undefined ? dashCell(footnotes, 'Budget, remaining and used % are not reported because no budget is set for this category.') : fmtNumber(c.budgetAmount),
      fmtNumber(c.actualSpent ?? 0),
      c.remainingBudget === null || c.remainingBudget === undefined ? `— (${noBudgetNote})` : fmtNumber(c.remainingBudget),
      c.executionPercentage === null || c.executionPercentage === undefined ? `— (${noBudgetNote})` : fmtRate(c.executionPercentage),
     ],
     mutedCols: c.budgetAmount === null || c.budgetAmount === undefined ? [1, 3, 4] : [],
    })),
    {
     cells: ['Total', fmtNumber(budgetTotalBudget), fmtNumber(budgetTotalSpent), fmtNumber(budgetTotalRemaining), fmtRate(budgetTotalBudget ? budgetTotalSpent / budgetTotalBudget : 0)],
     variant: 'total',
    },
   ],
  });
 }

 const splitColW = (CW - 20) / 2;
 const splitTop = y + 8;
 let leftY = drawSectionHeading(doc, M, splitTop, splitColW, '8. Saving goals', 'All pockets, USD');
 leftY = drawTable(doc, {
  x: M,
  y: leftY,
  width: splitColW,
  columns: [
   { label: 'Figure', width: splitColW - 90 },
   { label: `${closeLabel} (USD)`, width: 90, align: 'right' },
  ],
  rows: [
   { cells: ['Saved', fmtNumber(financialGoals.goalsTotalBalance ?? 0)] },
   { cells: ['Target', fmtNumber(financialGoals.goalsTotalTarget ?? 0)] },
   { cells: ['Remaining', fmtNumber(financialGoals.goalsTotalRemaining ?? 0)] },
  ],
 });
 drawNote(doc, M, leftY + 3, splitColW, "Saved is the total across every pocket and equals committed in pockets.");

 const rightX = M + splitColW + 20;
 let rightY = drawSectionHeading(doc, rightX, splitTop, splitColW, '9. Notes', 'An em dash is unavailable, never zero');
 if (footnotes.all().length === 0) {
  doc.font('Helvetica').fontSize(7).fillColor(PALETTE.secondary).text('No unavailable figures this period.', rightX, rightY, { width: splitColW });
  rightY = doc.y + 6;
 } else {
  footnotes.all().forEach((text, i) => {
   doc.font('Helvetica').fontSize(6.5).fillColor(PALETTE.secondary).text(`${i + 1}. ${text}`, rightX, rightY, { width: splitColW });
   rightY = doc.y + 3;
  });
 }
 doc.font('Helvetica-Bold').fontSize(7.5).fillColor(PALETTE.ink).text('Known limits', rightX, rightY + 4);
 rightY = doc.y + 3;
 KNOWN_LIMITS.forEach((text, i) => {
  doc.font('Helvetica').fontSize(6.5).fillColor(PALETTE.secondary).text(`${i + 1}. ${text}`, rightX, rightY, { width: splitColW });
  rightY = doc.y + 3;
 });

 // =====================================================================
 // Page 5 — debts by counterparty
 // =====================================================================
 const byCounterparty = debtAnalysis?.byCounterparty ?? [];
 // No debtor or lender account exists this period - section 10 would be a
 // heading over an empty table, and its own summary below is the same zero
 // section 6 already reports for the Debtors group.
 if (byCounterparty.length > 0) {
  y = startPage('Debts by counterparty');
  y = drawSectionHeading(doc, M, y, CW, '10. Debts by counterparty', `${closeLabel}, USD; ranked by balance, receivable then payable`);
  const receivableTotal = byCounterparty.filter((r) => r.direction === 'receivable').reduce((s, r) => s + r.balance, 0);
  const payableTotal = byCounterparty.filter((r) => r.direction === 'payable').reduce((s, r) => s + Math.abs(r.balance), 0);
  // Same account-keyed prior balance section 6 already uses for its own
  // per-account change column: a closed account has no prior close and reads
  // "opened this year", the same convention, covered by known limit 1
  // (mockup:2854/2859) rather than a counterparty-only footnote.
  y = drawTable(doc, {
   x: M,
   y,
   width: CW,
   columns: [
    { label: 'Rank', width: 34, align: 'right' },
    { label: 'Counterparty', width: CW - 34 - 90 - 90 - 80 - 90 },
    { label: 'Balance (USD)', width: 90, align: 'right' },
    { label: 'Change since Jan 1', width: 90, align: 'right' },
    { label: 'Direction', width: 80 },
    { label: 'Share', width: 90, align: 'right' },
   ],
   rows: byCounterparty.map((row) => {
    const share =
     row.direction === 'receivable'
      ? `${fmtRate(receivableTotal ? row.balance / receivableTotal : 0)} of receivable`
      : row.direction === 'payable'
       ? `${fmtRate(payableTotal ? Math.abs(row.balance) / payableTotal : 0)} of payable`
       : '—';
    const prior = priorBalanceByAccountId.get(row.accountId);
    const changeCell = prior === undefined ? 'opened this year' : fmtNumber(row.balance - prior, { signed: true });
    return {
     cells: [
      String(row.rank),
      row.accountName,
      fmtNumber(row.balance),
      changeCell,
      row.direction === 'receivable' ? 'Receivable' : row.direction === 'payable' ? 'Payable' : 'Settled',
      share,
     ],
     mutedCols: [3],
    };
   }),
  });

  const owesYou = byCounterparty.filter((r) => r.direction === 'receivable');
  const youOwe = byCounterparty.filter((r) => r.direction === 'payable');
  const splitTop2 = y + 8;
  const half = (CW - 20) / 2;
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(PALETTE.ink).text('Who owes you', M, splitTop2);
  let leftY2 = doc.y + 3;
  owesYou.forEach((row) => {
   doc.font('Helvetica').fontSize(7).fillColor(PALETTE.success).text(`${row.accountName} · ${fmtNumber(row.balance)}`, M, leftY2, { width: half });
   leftY2 = doc.y + 2;
  });
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(PALETTE.ink).text('Who you owe', M + half + 20, splitTop2);
  let rightY2 = doc.y + 3;
  youOwe.forEach((row) => {
   doc.font('Helvetica').fontSize(7).fillColor(PALETTE.error).text(`${row.accountName} · ${fmtNumber(Math.abs(row.balance))}`, M + half + 20, rightY2, { width: half });
   rightY2 = doc.y + 2;
  });
  y = Math.max(leftY2, rightY2) + 8;

  y = drawTable(doc, {
   x: M,
   y,
   width: CW,
   columns: [
    { label: 'Figure', width: CW - 240 },
    { label: `${closeLabel} (USD)`, width: 120, align: 'right' },
    { label: 'Change since Jan 1 (USD)', width: 120, align: 'right' },
   ],
   rows: [
    { cells: ['Receivable', fmtNumber(receivableRow.month), fmtNumber(receivableRow.yearToDate, { signed: true })], mutedCols: [2] },
    { cells: ['Payable', fmtNumber(payableRow.month), fmtNumber(payableRow.yearToDate, { signed: true })], mutedCols: [2] },
    { cells: ['Net debt position', fmtNumber(netDebtRow.month, { signed: true }), fmtNumber(netDebtRow.yearToDate, { signed: true })], mutedCols: [2], variant: 'total' },
   ],
  });
  y = drawNote(doc, M, y + 3, CW, `Matches section 6's Debtors group: ${fmtNumber(receivableRow.month)} owed to you, ${fmtNumber(payableRow.month)} you owe, net ${fmtNumber(netDebtRow.month)}.`);

  const legs = debtAnalysis?.legsOverTime ?? [];
  if (legs.length) {
   const legMonths = legs.map((p) => ({ label: fmtMonthShort(`${p.month}-01`), receivable: p.receivable, payable: p.payable }));
   const debtChartHeight = Math.min((CW * 226) / 704, 130);
   doc.font('Helvetica-Bold').fontSize(7.5).fillColor(PALETTE.ink)
    .text('Receivable and payable balances by month, USD', M, y + 6);
   y = doc.y + 3;
   y = drawSeriesChart(doc, { x: M, y, width: CW, height: debtChartHeight, months: legMonths, mode: 'debt' });
   // A fixed label column plus an even split of what is left, the same shape
   // buildMonthlyBreakdown's own table uses — CW - legs.length * 60 went
   // negative once legsOverTime carried more than ~8 months, which pdfkit
   // rendered as every cell stacked at x, the year and "Jan" merging into
   // "2026Jan" and each value overlapping the row label after it.
   const legLabelColW = 70;
   const legColW = (CW - legLabelColW) / legs.length;
   y = drawTable(doc, {
    x: M,
    y: y + 4,
    width: CW,
    compact: true,
    columns: [
     { label: referenceMonth.slice(0, 4), width: legLabelColW },
     ...legs.map((p) => ({ label: fmtMonthShort(`${p.month}-01`), width: legColW, align: 'right' })),
    ],
    rows: [
     { cells: ['Receivable', ...legs.map((p) => fmtNumber(p.receivable))] },
     { cells: ['Payable', ...legs.map((p) => fmtNumber(p.payable))] },
    ],
   });
  }
 }

 // =====================================================================
 // Page 6 — pockets status
 // =====================================================================
 const pockets = pocketBoard?.pockets ?? [];
 // No pocket exists this period - pages 6 and 7 are section 11 end to end,
 // so with nothing to report there is nothing left on either page.
 if (pockets.length > 0) {
  y = startPage('Pockets status');
  y = drawSectionHeading(doc, M, y, CW, '11. Pockets status', `${closeLabel}, USD; a remaining in parentheses is an over-funded pocket`);
  y = drawPocketBars(doc, { x: M, y, width: CW, pockets });
  y = drawNote(doc, M, y + 4, CW, 'The filled portion is committed; the light track is the remainder of target. Colour repeats the Status column and is never the only cue.');

  y = drawPocketTargetDonut(doc, { x: M, y: y + 4, width: CW, pockets });
  y += 6;

  const totalTarget = pockets.reduce((s, p) => s + (p.target ?? 0), 0);
  const totalAllocated = pockets.reduce((s, p) => s + (p.allocated ?? 0), 0);
  const totalRemaining = pockets.reduce((s, p) => s + (p.remaining ?? 0), 0);
  y = drawTable(doc, {
   x: M,
   y,
   width: CW,
   columns: [
    { label: 'Pocket', width: CW - 4 * 70 - 60 },
    { label: 'Target (USD)', width: 70, align: 'right' },
    { label: 'Committed (USD)', width: 70, align: 'right' },
    { label: 'Committed YTD', width: 70, align: 'right' },
    { label: 'Remaining (USD)', width: 70, align: 'right' },
    { label: 'Status', width: 60 },
   ],
   rows: [
    ...pockets.map((pocket) => {
     const prior = priorAllocatedByPocketId.get(pocket.pocketId);
     const ytdCell = prior === undefined ? 'opened this year' : fmtNumber(pocket.allocated - prior, { signed: true });
     return {
      cells: [
       pocket.name,
       pocket.target === null || pocket.target === undefined ? '—' : fmtNumber(pocket.target),
       fmtNumber(pocket.allocated ?? 0),
       ytdCell,
       fmtNumber(pocket.remaining ?? 0),
       POCKET_LEVEL_LABELS[pocket.level] ?? pocket.level,
      ],
      mutedCols: [3],
     };
    }),
    {
     cells: ['Total', fmtNumber(totalTarget), fmtNumber(totalAllocated), '', fmtNumber(totalRemaining), ''],
     variant: 'total',
    },
   ],
  });
  y = drawNote(doc, M, y + 3, CW, `${pocketBoard?.summary?.fundedCount ?? 0} funded · ${pocketBoard?.summary?.overdueCount ?? 0} overdue`);
  drawNote(
   doc,
   M,
   y,
   CW,
   "Funded is committed at or above target; overdue is a passed date with the target unmet. The board's third count, pockets whose source account no longer covers what is committed to it, is not reported here.",
   { italic: true },
  );

  // =====================================================================
  // Page 7 — pockets status, continued
  // =====================================================================
  y = startPage('Pockets status');
  y = drawSectionHeading(doc, M, y, CW, '11. Pockets status', 'continued, USD');

  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(PALETTE.ink).text('Funding accounts', M, y);
  y = doc.y + 3;
  y = drawNote(doc, M, y, CW, "Committed is a point-in-time balance at month close, the same convention section 6 uses for account balances - not a monthly movement.");

  const fundingRows = [];
  let totalCommitted = 0;
  pockets.forEach((pocket) => {
   const sources = pocketSourcesByPocket.get(pocket.pocketId) ?? [];
   fundingRows.push({ cells: [pocket.name, fmtNumber(pocket.allocated ?? 0), ''], variant: 'group' });
   totalCommitted += pocket.allocated ?? 0;
   sources.forEach((source) => {
    fundingRows.push({
     cells: [
      source.accountName ?? 'Account no longer available',
      fmtNumber(source.heldByThisPocket),
      pocket.target ? fmtRate(source.heldByThisPocket / pocket.target) : '—',
     ],
     variant: 'indent',
    });
   });
  });
  fundingRows.push({ cells: ['Total committed', fmtNumber(totalCommitted), ''], variant: 'total' });
  y = drawTable(doc, {
   x: M,
   y,
   width: CW,
   columns: [
    { label: 'Pocket / account', width: CW - 200 },
    { label: 'Committed (USD)', width: 100, align: 'right' },
    { label: '% of target', width: 100, align: 'right' },
   ],
   rows: fundingRows,
  });
  y = drawNote(doc, M, y + 3, CW, "Each pocket's own committed figure is the sum of the accounts that fund it; the total matches section 6's committed-in-pockets line.");

  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(PALETTE.ink).text('Timing and required monthly', M, y + 4);
  y = doc.y + 3;
  y = drawTable(doc, {
   x: M,
   y,
   width: CW,
   compact: true,
   columns: [
    { label: 'Pocket', width: CW - 3 * 100 },
    { label: 'Desired date', width: 100, align: 'right' },
    { label: 'Days remaining', width: 100, align: 'right' },
    { label: 'Required monthly (USD)', width: 100, align: 'right' },
   ],
   rows: pockets.map((pocket) => {
    const passed = typeof pocket.daysRemaining === 'number' && pocket.daysRemaining < 0;
    return {
     cells: [
      pocket.name,
      pocket.desiredDate ?? '—',
      passed ? 'passed' : (pocket.daysRemaining ?? '—'),
      passed ? 'Date passed' : pocket.requiredMonthly === null || pocket.requiredMonthly === undefined ? '—' : fmtNumber(pocket.requiredMonthly),
     ],
    };
   }),
  });
  drawNote(doc, M, y + 3, CW, 'Required monthly is undefined once the desired date has passed with the target unmet; "Date passed" states that directly rather than showing 0.00 or an unexplained dash.', { italic: true });
 }

 // Second pass: every page now exists, so the total is known and each
 // footer can state it correctly, instead of the fixed 7 this document
 // used before pages 5-7 could be skipped.
 const pageRange = doc.bufferedPageRange();
 for (let i = 0; i < pageRange.count; i += 1) {
  doc.switchToPage(pageRange.start + i);
  pageFooter(doc, { generatedLabel, timeZone, pageNumber: i + 1, pageCount: pageRange.count });
 }
}
