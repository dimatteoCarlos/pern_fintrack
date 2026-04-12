
import { Link } from 'react-router-dom'

function NotFoundPage() {
  return (
    <>
    <div className="message" style={{padding:'5rem 0 0', color:'white'}}>
    Hi! Page not found!
    </div>
  
    <Link to = '/'  >Click Here to go Home </Link>
    </>
  )
}

export default NotFoundPage
