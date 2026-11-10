import { useState } from 'react';
import { api } from '../api.js';
import { SLOTS } from '../slots.js';

const labelFor = (key) => SLOTS.find((s) => s.key === key)?.label ?? key;

// "2026-01-10" -> "10 Jan 2026". Built from the parts, so no time zone can shift the day.
export function prettyDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

// Shows the readings for ONE day. The API returns them already in slot order
// (Morning, After breakfast, After lunch, After dinner).
export default function ReadingList({ date, readings, onEdit, onChanged }) {
  const [confirmingId, setConfirmingId] = useState(null);
  const [error, setError] = useState('');

  async function remove(id) {
    setError('');
    try {
      await api(`/readings/${id}`, { method: 'DELETE' });
      setConfirmingId(null);
      onChanged(id);
    } catch (err) {
      setError(err.message);
    }
  }

  if (readings.length === 0) {
    return (
      <div className="empty">
        <p>No readings for {prettyDate(date)}.</p>
      </div>
    );
  }

  return (
    <>
      {error && <p className="form-error" role="alert">{error}</p>}
      <ul className="readings">
        {readings.map((r) => (
          <li key={r.id}>
            <span className="slot">{labelFor(r.slot)}</span>
            <strong>{r.value} mg/dl</strong>
            {confirmingId === r.id ? (
              <span className="actions">
                Delete this reading?
                <button className="danger" onClick={() => remove(r.id)}>Yes, delete</button>
                <button className="secondary" onClick={() => setConfirmingId(null)}>Keep</button>
              </span>
            ) : (
              <span className="actions">
                <button className="secondary" onClick={() => onEdit(r)}>Edit</button>
                <button className="secondary" onClick={() => setConfirmingId(r.id)}>Delete</button>
              </span>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
