import { useEffect, useState } from 'react';
import { api } from './api.js';
import AuthForm from './components/AuthForm.jsx';

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
        <div className="card">
          <h2>Hello, {user.name}</h2>
          <p>You are signed in as {user.email}.</p>
          <p>Reading screens arrive in Phase 3.</p>
          <button onClick={logout}>Log out</button>
        </div>
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
