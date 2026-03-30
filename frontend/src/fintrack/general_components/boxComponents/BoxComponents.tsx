// frontend/src/general_components/boxComponents/BoxComponents.tsx
// ====================================
// 🎯 COMPONENTS: BoxContainer, BoxRow and StatusSquare 
// Reusable container components with className support
// ====================================
import './styles/boxComponents.css'

// PROPS TYPES
// =============
type ChildrenPropType = { children: React.ReactNode, className?:string };

// COMPONENTS
// ============
//-----BoxContainer 
export function BoxContainer({ children, className }: ChildrenPropType) {
  return <div className={`box-container ${className}`.trim()}>{children}</div>;
}

//-----BoxRow 
export function BoxRow({ children , className}: ChildrenPropType) {
  return <div className={`box__row  box-row ${className}`.trim()}>{children}</div>;
}

//-----StatusSquare 
export function StatusSquare({
  alert,
}: {
  alert: string;
}) {
  return <span className={`status__square ${alert}`}>
  </span>;
}