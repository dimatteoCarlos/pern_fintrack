import './coin_loader.css'

// The coin is decorative, and for the length of a fetch it is the only thing on
// screen: nothing announced it, so a screen reader was handed a page with no
// content and no explanation. role='status' makes the region live and the word
// gives it something to read; aria-busy states that the wait is still on.
//
// Thirteen call sites and not one of them passes a prop, so the announcement
// belongs here rather than at any of them.
const CoinSpinner = () => {
  return (
    <div role='status' aria-busy='true'>
      <span className='loader' aria-hidden='true'></span>
      <span className='loader__label'>Loading</span>
    </div>
  )
}

export default CoinSpinner
