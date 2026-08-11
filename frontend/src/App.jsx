import LoginPage from './pages/LoginPage'

function App() {
  function handleLoginSuccess(token) {
    console.log('Logged in, token:', token)
  }

  return <LoginPage onLoginSuccess={handleLoginSuccess} />
}

export default App