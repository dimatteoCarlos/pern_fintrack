import BudgetButton from './BudgetButton.tsx';
import TrackerButton from './TrackerButton.tsx';
import DebtsButton from './DebtsButton.tsx';
import OverviewButton from './OverviewButton.tsx';
import './styles/mainNavbar.css';

function MainNavbar() {
  return (
    <nav className='mainNavbar__container'>
      <TrackerButton />
      <BudgetButton />
      <DebtsButton />
      <OverviewButton />
    </nav>
  );
}

export default MainNavbar;
