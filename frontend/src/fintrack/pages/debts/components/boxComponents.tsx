//--------------------------
type ChildrenPropType = { children: React.ReactNode };

//-----BoxContainer ---------------------C
// The second token used to be written '.flx-row-sb', with a leading dot, so it
// named a class no stylesheet declares and applied nothing. Dropped rather than
// corrected: this container stacks two BoxRow children, and .flx-row-sb is a
// row with space-between, which would lay them side by side.
export function BoxContainer({ children }: ChildrenPropType) {
  return <div className='box__container'>{children}</div>;
}

export function BoxRow({ children }: ChildrenPropType) {
  return <div className='box__row flx-row-sb'>{children}</div>;
}

export function StatusSquare({ children }: { children: React.ReactNode }) {
  return <span className='status__square'>{children}</span>;
}
