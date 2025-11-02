import logo from '../assets/Vacation_Manager_Logo.png'

export default function Brand() {
  return (
    <div className="brand">
      <img className="brand-logo" src={logo} alt="Vacation Portal logo" />
      <div className="brand-title">Vacation<br/>Portal</div>
    </div>
  )
}
