// frontend/src/fintrack/general_components/mainNavbar/MainNavbar.tsx

import AddSvg from '../../../assets/mainNavbarSvg/AddSvg.svg';
import WalletSvg from '../../../assets/mainNavbarSvg/WalletSvg.svg';
import PocketSvg from '../../../assets/mainNavbarSvg/PocketSvg.svg';
import DebtsSvg from '../../../assets/mainNavbarSvg/DebtsSvg.svg';
import OverviewSvg from '../../../assets/mainNavbarSvg/OverviewSvg.svg';
import NavbarButton from './NavbarButton';
import './styles/mainNavbar.css';

// Declaration order is render order. `to` may sit deeper than `section` when the
// tab opens on a specific child route.
const NAVBAR_TABS = [
 { section: 'tracker', to: '/fintrack/tracker/expense', icon: <AddSvg /> },
 { section: 'budget', to: '/fintrack/budget', icon: <WalletSvg /> },
 { section: 'pocket', to: '/fintrack/pocket', icon: <PocketSvg /> },
 { section: 'debts', to: '/fintrack/debts/debtors', icon: <DebtsSvg /> },
 { section: 'overview', to: '/fintrack/overview', icon: <OverviewSvg /> },
];

function MainNavbar() {
 return (
  <nav className='mainNavbar__container'>
   {NAVBAR_TABS.map((tab) => (
    <NavbarButton key={tab.section} {...tab} />
   ))}
  </nav>
 );
}

export default MainNavbar;
