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

  return (
    <main className={user ? 'wide' : undefined}>
      <h1>Sweety</h1>
      <p className="tagline">Blood glucose tracker</p>
      {user ? (
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
      ) : (
        <AuthForm
          key={mode}
          mode={mode}
          onAuthenticated={setUser}
          onSwitch={() => setMode(mode === 'login' ? 'signup' : 'login')}
        />
      )}
    </main>
  );
}
