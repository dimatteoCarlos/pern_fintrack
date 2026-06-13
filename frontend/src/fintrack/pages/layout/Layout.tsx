//C:/AA1-WEB_DEVELOPER/REACT/apps/FINTRACK/pern_fintrack/frontend/src/pages/layout/Layout.tsx

import Header from '../../general_components/header/Header.tsx';
import { Outlet } from 'react-router-dom';
import MainNavbar from '../../general_components/mainNavbar/MainNavbar.tsx';

import '../styles/generalStyles.css';
import { CurrencyInitializer } from '../../general_components/currencyInitializer/CurrencyInitializer.tsx';

function Layout() {
  //-------------------------------

  return (
    <>
     <CurrencyInitializer />
      <section className='home__layout '>
        <Header />
        <Outlet />
        <MainNavbar />
      </section>
    </>
  );
}

export default Layout;
