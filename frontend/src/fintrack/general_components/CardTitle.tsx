// frontend\src\fintrack\general_components\CardTitle.tsx

import './styles/cardTitle.css';

type ChildrenPropType = {
  children: React.ReactNode;
  // Optional legend pinned to the right of the title, over the column of values
  // it names. Absent by default, so every other CardTitle is unaffected.
  legend?: React.ReactNode;
  // A quieter second row, naming what the second line of each list row shows
  // the way title and legend name the first. Both halves are optional.
  subtitle?: React.ReactNode;
  subLegend?: React.ReactNode;
};

//-----CardTitle---------------C
export function CardTitle({
  children,
  legend,
  subtitle,
  subLegend,
}: ChildrenPropType) {
  const hasSub = Boolean(subtitle || subLegend);

  // Without a second row the markup is exactly what it has always been. Eleven
  // other screens render through here and none of them asked for a change.
  if (!hasSub) {
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

  return (
    <div className='presentation__card--title presentation__card--title--stacked'>
      <div className='presentation__card--row'>
        <span>{children}</span>
        {legend && <span className='presentation__card--legend'>{legend}</span>}
      </div>

      <div className='presentation__card--row presentation__card--row--sub'>
        <span>{subtitle}</span>
        <span>{subLegend}</span>
      </div>
    </div>
  );
}
