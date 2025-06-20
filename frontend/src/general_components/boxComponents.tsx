//boxComponents.tsx
//--------------------------------------
type ChildrenPropType = { children: React.ReactNode, className?:string };
//styles: generalStyles.css
//-----BoxContainer ---------------------
export function BoxContainer({ children, className }: ChildrenPropType) {
  return <div className={`${className} box__container .flx-row-sb`}>{children}</div>;
}
//-----BoxRow ---------------------------
export function BoxRow({ children }: ChildrenPropType) {
  return <div className='box__row flx-row-sb'>{children}</div>;
}
//-----StatusSquare ---------------------
export function StatusSquare({
  // children,
  alert,
}: {
  // children?: ChildrenPropType
  alert: string;
}) {
  return <span className={`status__square ${alert}`}>
    {/* {children} */}
  </span>;
}