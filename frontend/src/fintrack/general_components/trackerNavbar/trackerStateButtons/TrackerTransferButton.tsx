//frontend/src/fintrack/general_components/trackerNavbar/trackerStateButtons/TrackerTransferButton.tsx

import TransferSvg from '../../../../assets/trackerNavbarSvg/TransferSvg.svg';

import { NavLink } from 'react-router-dom';

function TrackerTransferButton() {
  const classNavLink = `trackerStateIconButton flx-col-center ${({
    isActive,
  }: {
    isActive: boolean;
  }) => (isActive ? 'active' : '')}`;

  return (
    <>
      <div className='trackerStateButton__container'>
        {/* The icon carries no title, so without this the link announces
            unnamed. Pointed at the caption below rather than repeating the word
            in an aria-label: the accessible name is then the visible text. */}
        <NavLink
          to='transfer'
          aria-labelledby='trackerTabLabel-transfer'
          className={classNavLink}
        >
          <TransferSvg />
        </NavLink>
        <div
          id='trackerTabLabel-transfer'
          className='trackerStateButton__state--title'
        >
          {'Transfer'}
        </div>
      </div>
    </>
  );
}

export default TrackerTransferButton;
