import { useState } from 'react'
import './App.css'

function App() {
  const [session, setSession] = useState<any>(null);

  return (
    <div className="popup-container">
      <header>
        <h1>ReadWell</h1>
        <p>AI Reading Companion</p>
      </header>
      
      <main>
        {!session ? (
          <div className="auth-section">
            <p>Please log in to sync your progress.</p>
            <button className="primary-btn" onClick={() => setSession({ user: 'Learner' })}>
              Connect to ReadWell
            </button>
          </div>
        ) : (
          <div className="dashboard-section">
            <p>Connected as <strong>{session.user}</strong></p>
            <button className="secondary-btn" onClick={() => setSession(null)}>
              Disconnect
            </button>
          </div>
        )}
      </main>

      <footer>
        <p>Highlight text on any page to generate a quiz!</p>
      </footer>
    </div>
  )
}

export default App
