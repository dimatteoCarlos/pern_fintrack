import MainNavbarButton from './MainNavbarButton';
import AddSvg from '../../assets/mainNavbarSvg/AddSvg.svg';
import OverviewSvg from '../../assets/mainNavbarSvg/OverviewSvg.svg';
import DebtsSvg from '../../assets/mainNavbarSvg/DebtsSvg.svg';
import WalletSvg from '../../assets/mainNavbarSvg/WalletSvg.svg';

function MainNavbar() {
  return (
    <nav className='mainNavbar__container'>
      <MainNavbarButton
        btnName='tracker'
        path='/tracker/expense'
        Icon={AddSvg}
      />
      <MainNavbarButton
        btnName='overview'
        path='/overview'
        Icon={OverviewSvg}
      />
      <MainNavbarButton btnName='debts' path='/debts/debtors' Icon={DebtsSvg} />
      <MainNavbarButton btnName='budget' path='/budget' Icon={WalletSvg} />
    </nav>
  );
}

export default MainNavbar;
