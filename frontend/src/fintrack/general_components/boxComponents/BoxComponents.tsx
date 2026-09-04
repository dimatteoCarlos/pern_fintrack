// frontend/src/general_components/boxComponents/BoxComponents.tsx
// ====================================
// 🎯 COMPONENTS: BoxContainer, BoxRow and StatusSquare 
// Reusable container components with className support
// ====================================
import './styles/boxComponents.css'

// PROPS TYPES
// =============
type ChildrenPropType = { children: React.ReactNode,
 className?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
  // A div takes no focus and announces nothing. A caller that turns a box into a
  // control passes these so the box is reachable with the keyboard as well.
  role?: string;
  tabIndex?: number;
  onKeyDown?: (event: React.KeyboardEvent<HTMLDivElement>) => void;
};

// ===============
// COMPONENTS
// ===============
//-----BoxContainer 
export function BoxContainer({ children, className, onClick, style, role, tabIndex, onKeyDown }: ChildrenPropType) {
  return (
    <div
      className={`box-container ${className}`.trim()}
      onClick={onClick}
      style={style}
      role={role}
      tabIndex={tabIndex}
      onKeyDown={onKeyDown}
    >
      {children}
    </div>
  );
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

//-----StatusTick
// The square's sibling for a reading that is FINISHED rather than pending, and
// the only mark on the pocket scale that is told apart by shape. It takes no
// props: a tick means one thing, so a colour argument would be a way to say
// something it cannot mean.
//
// aria-hidden, like the square: both stand beside a word that already names the
// state, and a mark announced on its own would read the level twice.
export function StatusTick() {
  return <span className='status__tick' aria-hidden='true'></span>;
}