import { useEffect, useState } from 'react';

// Phase 1 placeholder: proves the React app can reach the API and database.
export default function App() {
  const [health, setHealth] = useState('checking...');

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((d) => setHealth(`API: ${d.status}, database: ${d.database}`))
      .catch(() => setHealth('API unreachable'));
  }, []);

  return (
    <main style={{ fontFamily: 'sans-serif', maxWidth: 480, margin: '4rem auto' }}>
      <h1>Sweety</h1>
      <p>Blood glucose tracker</p>
      <p>{health}</p>
    </main>
  );
}
