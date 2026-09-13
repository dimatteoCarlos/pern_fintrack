// frontend/src/fintrack/editionAndDeletion/utils/accountTypeIcons.ts

import type { FunctionComponent, SVGProps } from 'react';

// The accounting dashboard's own icon set, reused rather than redrawn. Every
// one is viewBox 0 0 32 32 with stroke="currentColor" at 1.5, so they take the
// colour of the line they sit in.
import BankSvg from '../../../assets/accountingDashboardSvg/bankAccountSvg.svg?react';
import CashSvg from '../../../assets/accountingDashboardSvg/cashAccountsSvg.svg?react';
import InvestmentSvg from '../../../assets/accountingDashboardSvg/investmentAccountsSvg.svg?react';
import DebtorSvg from '../../../assets/accountingDashboardSvg/debtsAccountsSvg.svg?react';
import CategorySvg from '../../../assets/accountingDashboardSvg/expenseAccountsSvg.svg?react';
import IncomeSvg from '../../../assets/accountingDashboardSvg/incomeAccountsSvg.svg?react';
import PocketSvg from '../../../assets/accountingDashboardSvg/pocketsAccountsSvg.svg?react';
// The fallback mark, the same one the profile menu uses for closed accounts.
import ArchiveSvg from '../../../assets/userProfileMenuSvg/archiveSvg.svg?react';

type SvgComponentType = FunctionComponent<SVGProps<SVGSVGElement>>;

// One icon per account type, keyed by the value account_types.account_type_name
// holds. Shared by the closed-account list and the deletion screen, so a type
// reads with the same mark on both.
export const ACCOUNT_TYPE_ICONS: Record<string, SvgComponentType> = {
 bank: BankSvg,
 cash: CashSvg,
 investment: InvestmentSvg,
 debtor: DebtorSvg,
 category_budget: CategorySvg,
 income_source: IncomeSvg,
 pocket_saving: PocketSvg,
};

// A type with no entry, or no type at all, gets the archive mark rather than an
// empty box that would misalign the line.
export const getAccountTypeIcon = (
 accountTypeName: string | null | undefined,
): SvgComponentType =>
 (accountTypeName && ACCOUNT_TYPE_ICONS[accountTypeName]) || ArchiveSvg;
