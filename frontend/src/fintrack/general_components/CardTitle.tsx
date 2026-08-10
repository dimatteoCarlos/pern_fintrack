// frontend\src\fintrack\general_components\CardTitle.tsx

import './styles/cardTitle.css';

type ChildrenPropType = {
  children: React.ReactNode;
  // Optional legend pinned to the right of the title, over the column of values
  // it names. Absent by default, so every other CardTitle is unaffected.
  legend?: React.ReactNode;
};

//-----CardTitle---------------C
export function CardTitle({ children, legend }: ChildrenPropType) {
  return (
    <div
      className={`presentation__card--title${
        legend ? ' presentation__card--title--split' : ''
      }`}
    >
      {children}{' '}
      {legend && <span className='presentation__card--legend'>{legend}</span>}
    </div>
  );
}
