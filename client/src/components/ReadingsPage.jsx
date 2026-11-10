import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import ReadingForm from './ReadingForm.jsx';
import ReadingList from './ReadingList.jsx';

export default function ReadingsPage() {
  const [data, setData] = useState(null); // { today, date, readings } for the selected day
  const [loadError, setLoadError] = useState('');
  const [editing, setEditing] = useState(null);

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

  return (
    <>
      {/* "today" comes from the server so the date picker matches server-side validation */}
      <ReadingForm
        key={editing ? `edit-${editing.id}` : 'new'}
        today={data.today}
        editing={editing}
        onCancel={() => setEditing(null)}
        onSaved={(savedDate) => {
          setEditing(null);
          load(savedDate); // jump to the day that was just saved so the user sees it
        }}
      />

      <div className="card">
        <h2>Readings for a day</h2>
        <label>
          Show readings for
          <input
            type="date"
            value={data.date}
            max={data.today}
            onChange={(e) => e.target.value && load(e.target.value)}
          />
        </label>
        {loadError && <p className="form-error" role="alert">{loadError}</p>}
        <ReadingList
          key={data.date}
          date={data.date}
          readings={data.readings}
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
    </>
  );
}
