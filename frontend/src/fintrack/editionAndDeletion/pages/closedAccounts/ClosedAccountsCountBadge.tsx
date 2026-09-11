import type { FunctionComponent } from 'react';

import './closedAccountsCountBadge.css';

type ClosedAccountsCountBadgeProps = {
  total: number;
  label: string;
};

export const ClosedAccountsCountBadge: FunctionComponent<
  ClosedAccountsCountBadgeProps
> = ({ total, label }) => {
  const formattedText = label.replace('{total}', String(total));

  return (
    <div className="closed-accounts__list-header">
      <span className="closed-accounts__count-badge" role="status">
        {formattedText}
      </span>
    </div>
  );
};

export default ClosedAccountsCountBadge;