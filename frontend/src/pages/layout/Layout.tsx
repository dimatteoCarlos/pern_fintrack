import Header from '../../general_components/header/Header.tsx';
import { Outlet } from 'react-router-dom';
import MainNavbar from '../../general_components/mainNavbar/MainNavbar.tsx';

import '../styles/generalStyles.css';

function Layout() {
  //-------------------------------

  return (
    <>
      <section className='home__layout '>
        <Header />
        <Outlet />
        <MainNavbar />
      </section>
    </>
  );
}

export default Layout;
