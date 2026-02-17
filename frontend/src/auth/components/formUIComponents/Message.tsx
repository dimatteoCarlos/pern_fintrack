// 📁 frontend/src/components/common/Message/Message.tsx
/* 🌟 =======================
📦 IMPORT DEPENDENCIES
=============================== 🌟 */
import React from 'react';
import styles from './styles/message.module.css';

/* 🌟 =======================
🏷️ TYPE DEFINITIONS
========================= 🌟 */
/**
 * 📝 Message types for different visual styles and semantic meanings
 */
export type MessageType = 'error' | 'success' | 'warning' | 'info';

 // 📝 Props for the generic Message component
type MessagePropsType = {
  message: string;
  type?: MessageType;
// ❌ Optional dismiss handler - shows close button if provided 
  onDismiss?: () => void;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
// 👁️ Whether to show the type icon
  showIcon?: boolean;
// ⏱️ Auto-dismiss after milliseconds (requires onDismiss)
  autoDismiss?: number;

/** 🎯 Accessibility: ARIA live region politeness */
  ariaLive?: 'assertive' | 'polite' | 'off';
  
/** 🎯 Accessibility: ARIA role */
  role?: 'alert' | 'status' | 'log';
};

/* 🌟 ==========================
🎭 COMPONENT:  Message (Generic)
=========================== 🌟 */
const Message: React.FC<MessagePropsType> = ({
  message,
  type = 'info',
  onDismiss,
  showIcon = true,
  autoDismiss = 500,
  id,
  className = '',
  style,

}) => {
  
  /* 🌟 =======================
  ⏱️ AUTO-DISMISS EFFECT
  ======================== 🌟 */
  React.useEffect(() => {
    if (autoDismiss > 0 && onDismiss) {
      const timer = setTimeout(() => {
        onDismiss();
      }, autoDismiss);
      
      return () => clearTimeout(timer);
    }
  }, [autoDismiss, onDismiss]);
  
  /* 🌟 =======================
  🎨 COMPUTED VALUES
 ======================== 🌟 */
  const typeClass = {
    error: styles.messageError,
    success: styles.messageSuccess,
    warning: styles.messageWarning,
    info: styles.messageInfo
  }[type];
  
  const role = type === 'error' || type === 'warning' ? 'alert' : 'status';
  const ariaLive = type === 'error' || type === 'warning' ? 'assertive' : 'polite';

  // 👁️ Icons for each type
  const typeIcons = {
   error: '❌',
   success: '✅',
   warning: '⚠️',
   info: 'ℹ️'
  };
    
  /* 🌟 =======================
  🎨 RENDER - THE MESSAGE UI
 ======================== 🌟 */
  return (
    <div
      id={id}
      className={`${styles.messageContainer} ${typeClass} ${className}`}
      style={style}
      role={role}
      aria-live={ariaLive}
      aria-atomic="true"
       data-testid={`message-${type}`}

    >
      {/* 👁️ Type Icon */}
      {showIcon && (
        <span 
          className={styles.messageIcon}
          aria-hidden="true"
          data-testid="message-icon"
        >
         {typeIcons[type]}
        </span>
      )}
      {/* 📝 Message Text */}
      <p className={`${styles.messageText} ${showIcon ? styles.messageTextWithIcon : ''}`}
       data-testid="message-text"
      >
        {message}
      </p>

      {/* ❌ Dismiss Button */}
      {onDismiss && (
        <button
          type="button"
          className={styles.dismissButton}
          onClick={onDismiss}
          aria-label="Dismiss message"
          title="Dismiss"
          data-testid="message-dismiss-button"
        >
          ×
        </button>
      )}
    </div>
  );
};

export default Message;