import { useLocation } from 'react-router-dom';
import LogoMenuIcon from '../../general_components/header/LogoMenuIcon';
import { SeeMore } from '../overview/components/SeeMore';

function Movements() {
  const { pathname } = useLocation();
  const routes = pathname.split('/');
  const movementsOf = routes[3].toUpperCase();
  const previousRoute = '/' + routes[2];
  // console.log('location:', pathname, useLocation(), routes, previousRoute);

  const Message = `You've navigated to a page that should render all the ${movementsOf} Movements.\n  "Endpoints" for data fetching of all the movements with its data structure, and the Rendering VIEWS design are PENDING`;
  console.log('Message:', Message);

  return (
    <>
      <SeeMore previousRoute={previousRoute}>
        <LogoMenuIcon />
        {Message}
      </SeeMore>
    </>
  );
}

export default Movements;
