// 📁 frontend/src/auth/formUIComponents/ResetButton.tsx
import React from "react";
import styles from "./styles/ResetButton.module.css"; 

type ResetButtonProps = {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
};

const ResetButton: React.FC<ResetButtonProps> = ({
  children,
  onClick,
  disabled = false,
  className = "",
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${styles.resetButton} ${className}`}
    >
      {children}
    </button>
  );
};

export default ResetButton;
