//--------------------------C
//styles: generalStyles.css
type ChildrenPropType = { children: React.ReactNode };

//-----BoxContainer ---------------------C
export function BoxContainer({ children }: ChildrenPropType) {
  return <div className='box__container .flx-row-sb'>{children}</div>;
}

export function BoxRow({ children }: ChildrenPropType) {
  return <div className='box__row flx-row-sb'>{children}</div>;
}

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
