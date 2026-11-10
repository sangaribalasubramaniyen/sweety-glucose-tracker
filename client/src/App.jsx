import { useEffect, useState } from 'react';
import { api } from './api.js';
import AuthForm from './components/AuthForm.jsx';
import ReadingsPage from './components/ReadingsPage.jsx';

export default function App() {
  // undefined = still checking for a session, null = signed out, object = signed in
  const [user, setUser] = useState(undefined);
  const [mode, setMode] = useState('login');

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
  }

  if (user === undefined) return <main><p>Loading...</p></main>;

  return (
    <main>
      <h1>Sweety</h1>
      <p className="tagline">Blood glucose tracker</p>
      {user ? (
        <>
          <div className="topbar">
            <span>Signed in as <strong>{user.name}</strong></span>
            <button className="secondary" onClick={logout}>Log out</button>
          </div>
          <ReadingsPage />
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
