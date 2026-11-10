import { useEffect, useState } from 'react';
import { api } from './api.js';
import AuthForm from './components/AuthForm.jsx';
import ReadingsPage from './components/ReadingsPage.jsx';
import ReportsPage from './components/ReportsPage.jsx';

export default function App() {
  // undefined = still checking for a session, null = signed out, object = signed in
  const [user, setUser] = useState(undefined);
  const [mode, setMode] = useState('login');
  const [tab, setTab] = useState('readings');

  // On every page load, ask the server who we are (the cookie is the proof).
  useEffect(() => {
    api('/auth/me')
      .then((d) => setUser(d.user))
      .catch(() => setUser(null));
  }, []);

  async function logout() {
    await api('/auth/logout', { method: 'POST' });
    setUser(null);
    setMode('login');
    setTab('readings');
  }

  if (user === undefined) return <main><p>Loading...</p></main>;

  // Signed out: one shared, centered layout for both the Log in and Sign up screens.
  if (!user) {
    return (
      <main className="auth-page">
        <header className="brand">
          <div className="brand-row">
            <svg className="droplet" width="30" height="30" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 2.5c-3.6 4.5-6.5 7.7-6.5 11.2a6.5 6.5 0 0 0 13 0c0-3.5-2.9-6.7-6.5-11.2z" fill="currentColor" />
            </svg>
            <h1>Sweety</h1>
          </div>
          <p className="tagline">Blood glucose tracker</p>
        </header>
        <AuthForm
          key={mode}
          mode={mode}
          onAuthenticated={setUser}
          onSwitch={() => setMode(mode === 'login' ? 'signup' : 'login')}
        />
      </main>
    );
  }

  return (
    <main className="wide">
      <h1>Sweety</h1>
      <p className="tagline">Blood glucose tracker</p>
      {user && (
        <>
          <div className="topbar">
            <span>Signed in as <strong>{user.name}</strong></span>
            <button className="secondary" onClick={logout}>Log out</button>
          </div>
          <nav className="tabs" aria-label="Sections">
            {[['readings', 'Readings'], ['reports', 'Reports']].map(([key, label]) => (
              <button key={key} className={tab === key ? 'tab active' : 'tab'} aria-current={tab === key ? 'page' : undefined} onClick={() => setTab(key)}>
                {label}
              </button>
            ))}
          </nav>
          {/* Switching tabs remounts the page, so Reports always reloads fresh data */}
          {tab === 'readings' ? <ReadingsPage /> : <ReportsPage />}
        </>
      )}
    </main>
  );
}
