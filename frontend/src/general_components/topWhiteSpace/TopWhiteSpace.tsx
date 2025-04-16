import { VariantType } from '../../types/types';
import './topWhiteSpace.css';

type TopWhiteSpacePropType = {
  variant: VariantType;
};

function TopWhiteSpace({ variant }: TopWhiteSpacePropType) {
  return (
    <>
      <div className='top--whiteSpace' style={{ backgroundColor: variant }}></div>
    </>
  );
}

export default TopWhiteSpace;
