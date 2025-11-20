// frontend/src/components/skeleton/AccountingSkeleton.tsx
import './skeleton-styles.css';

// 🏦 SKELETON FOR ACCOUNTING DASHBOARD
export function AccountingSkeleton() {
  return (
    <div className="skeleton-container">
      {/* HEADER SKELETON */}
      <div className="skeleton-header">
        <div className="skeleton-icon skeleton-pulse"></div>
        <div className="skeleton-title skeleton-pulse"></div>
      </div>

      {/* ACCOUNT GROUPS SKELETON */}
      {[1, 2, 3].map((groupIndex) => (
        <div key={groupIndex} className="skeleton-group skeleton-pulse">
          {/* GROUP HEADER SKELETON */}
          <div className="skeleton-group-header">
            <div className="skeleton-group-emoji skeleton-pulse"></div>
            <div className="skeleton-group-title skeleton-pulse"></div>
            <div className="skeleton-group-count skeleton-pulse"></div>
          </div>
          
          {/* ACCOUNT CARDS SKELETON */}
          <div className="skeleton-grid">
            {[1, 2, 3, 4].map((cardIndex) => (
              <div key={cardIndex} className="skeleton-card skeleton-pulse">
                {/* 🎯 3-DOTS MENU SKELETON */}
                <div className="skeleton-menu-btn skeleton-pulse"></div>
                
                <div className="skeleton-card-content">
                  <div className="skeleton-line skeleton-line--title skeleton-pulse"></div>
                  <div className="skeleton-bubble skeleton-pulse">
                    <div className="skeleton-line skeleton-line--type skeleton-pulse"></div>
                    <div className="skeleton-line skeleton-line--amount skeleton-pulse"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// 📋 SKELETON FOR ACCOUNT DETAIL PAGE
export function AccountDetailSkeleton() {
  return (
    <div className="skeleton-container">
      {/* HEADER SKELETON */}
      <div className="skeleton-header">
        <div className="skeleton-icon skeleton-pulse"></div>
        <div className="skeleton-title skeleton-title--large skeleton-pulse"></div>
        <div className="skeleton-icon skeleton-pulse"></div>
      </div>

      {/* ACCOUNT INFO SKELETON */}
      <div className="skeleton-form">
        {[1, 2, 3, 4].map((fieldIndex) => (
          <div key={fieldIndex} className="skeleton-field">
            <div className="skeleton-line skeleton-line--label skeleton-pulse"></div>
            <div className="skeleton-line skeleton-line--input skeleton-pulse"></div>
          </div>
        ))}
      </div>

      {/* TRANSACTIONS SKELETON */}
      <div className="skeleton-section">
        <div className="skeleton-line skeleton-line--section-title skeleton-pulse"></div>
        {[1, 2, 3, 4, 5].map((transactionIndex) => (
          <div key={transactionIndex} className="skeleton-transaction skeleton-pulse">
            <div className="skeleton-line skeleton-line--transaction-header skeleton-pulse"></div>
            <div className="skeleton-line skeleton-line--transaction-desc skeleton-pulse"></div>
            <div className="skeleton-line skeleton-line--transaction-balance skeleton-pulse"></div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ✏️ SKELETON FOR EDIT FORM
export function EditFormSkeleton() {
  return (
    <div className="skeleton-container">
      {/* HEADER SKELETON */}
      <div className="skeleton-header">
        <div className="skeleton-icon skeleton-pulse"></div>
        <div className="skeleton-title skeleton-pulse"></div>
      </div>

      {/* EDIT FORM FIELDS SKELETON */}
      <div className="skeleton-form">
        {[1, 2, 3, 4, 5].map((fieldIndex) => (
          <div key={fieldIndex} className="skeleton-field">
            <div className="skeleton-line skeleton-line--label skeleton-pulse"></div>
            <div className="skeleton-line skeleton-line--input skeleton-pulse"></div>
          </div>
        ))}
      </div>

      {/* ACTION BUTTONS SKELETON */}
      <div className="skeleton-actions">
        <div className="skeleton-button skeleton-pulse"></div>
        <div className="skeleton-button skeleton-button--secondary skeleton-pulse"></div>
      </div>
    </div>
  );
}

export default AccountingSkeleton;