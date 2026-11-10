import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import ReadingForm from './ReadingForm.jsx';
import ReadingList from './ReadingList.jsx';

export default function ReadingsPage() {
  const [data, setData] = useState(null); // { today, date, readings } for the day shown in the list
  const [loadError, setLoadError] = useState('');
  const [editing, setEditing] = useState(null);
  const [highlightId, setHighlightId] = useState(null); // the reading that was just saved
  const listRef = useRef(null);

  // Loads one day. With no date, the server answers with today (in the app time zone),
  // so the selector's default never depends on this browser's clock or time zone.
  const load = useCallback(async (date) => {
    try {
      setData(await api(date ? `/readings?date=${date}` : '/readings'));
      setLoadError('');
    } catch (err) {
      setLoadError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!data) return loadError ? <p className="form-error" role="alert">{loadError}</p> : <p>Loading readings...</p>;

  // After a save: show the day the reading was saved on and highlight it.
  async function handleSaved(reading) {
    setEditing(null);
    setHighlightId(reading.id);
    await load(reading.date);
    // On narrow screens the list sits below the form; scroll only if it is off-screen.
    requestAnimationFrame(() => listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
  }

  return (
    // Two columns on wide screens (form left, list right), stacked on mobile.
    <div className="readings-grid">
      {/* The form has its OWN date; the list below has its own "Show readings for" date. */}
      <ReadingForm
        key={editing ? `edit-${editing.id}` : 'new'}
        today={data.today}
        editing={editing}
        onCancel={() => setEditing(null)}
        onSaved={handleSaved}
      />

      <div className="card" ref={listRef}>
        <h2>Readings for a day</h2>
        <label>
          Show readings for
          <input
            type="date"
            value={data.date}
            max={data.today}
            onChange={(e) => {
              if (!e.target.value) return;
              setHighlightId(null);
              load(e.target.value);
            }}
          />
        </label>
        {loadError && <p className="form-error" role="alert">{loadError}</p>}
        <ReadingList
          key={data.date}
          date={data.date}
          readings={data.readings}
          highlightId={highlightId}
          onEdit={(r) => {
            setEditing(r);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onChanged={(deletedId) => {
            if (editing?.id === deletedId) setEditing(null);
            load(data.date);
          }}
        />
      </div>
    </div>
  );
}
