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
  // The heading level. h2 because every card sits under its page's own h1; a
  // caller nested deeper than that passes the level its own outline needs.
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
};

//-----CardTitle---------------C
// A heading element and not a div, which is what this rendered. Twelve screens
// title their cards through here, so Budget, Pocket, Debtors, Overview and the
// four detail pages carried no heading at all: nothing to navigate the page by
// and no structure conveyed. Every rule in cardTitle.css selects a class, so
// the tag changes and the appearance does not.
export function CardTitle({
  children,
  legend,
  subtitle,
  subLegend,
  as: Heading = 'h2',
}: ChildrenPropType) {
  const hasSub = Boolean(subtitle || subLegend);

  // Without a second row the markup is exactly what it has always been. Eleven
  // other screens render through here and none of them asked for a change.
  if (!hasSub) {
    return (
      <Heading
        className={`presentation__card--title${
          legend ? ' presentation__card--title--split' : ''
        }`}
      >
        {children}{' '}
        {legend && <span className='presentation__card--legend'>{legend}</span>}
      </Heading>
    );
  }

  return (
    <div className='presentation__card--title presentation__card--title--stacked'>
      <div className='presentation__card--row'>
        {/* The heading is the title alone. Wrapping the stack would put the
            second row inside the heading text. */}
        <Heading className='presentation__card--heading'>{children}</Heading>
        {legend && <span className='presentation__card--legend'>{legend}</span>}
      </div>

      <div className='presentation__card--row presentation__card--row--sub'>
        <span>{subtitle}</span>
        <span>{subLegend}</span>
      </div>
    </div>
  );
}
