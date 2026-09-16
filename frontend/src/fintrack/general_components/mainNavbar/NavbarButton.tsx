// frontend/src/fintrack/general_components/mainNavbar/NavbarButton.tsx

import { NavLink, useMatch } from 'react-router-dom';
import Tooltip from '../tooltip/Tooltip';
import { capitalize } from '../../helpers/functions';

type NavbarButtonPropType = {
 // Section that owns the tab. Doubles as the label and the tooltip text.
 section: string;
 // Where the tab navigates, which may sit deeper than the section it watches.
 to: string;
 // Already rendered: *.svg resolves to string under the current declarations,
 // so it cannot travel as a component type.
 icon: React.ReactNode;
};

//-----NavbarButton---------------C
function NavbarButton({ section, to, icon }: NavbarButtonPropType) {
 // The tab lights up for the whole section, not only for the route it links to.
 const isBtnActive = Boolean(useMatch(`/fintrack/${section}/*`));

 return (
  <NavLink to={to} className={`mainNavbarButton ${isBtnActive ? 'active' : ''}`}>
   <Tooltip tipText={capitalize(section)} isActive={isBtnActive}>
    <div className='iconContainer flx-col-center'>{icon}</div>
   </Tooltip>

   <span className='button--label'>{section}</span>
  </NavLink>
 );
}

export default NavbarButton;
