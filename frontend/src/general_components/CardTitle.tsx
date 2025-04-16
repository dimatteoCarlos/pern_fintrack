type ChildrenPropType = { children: React.ReactNode };

//-----CardTitle---------------C
export function CardTitle({ children }: ChildrenPropType) {
  return <div className='presentation__card--title'>{children} </div>;
}