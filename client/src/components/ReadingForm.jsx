import { useState } from 'react';
import { api } from '../api.js';
import { SLOTS } from '../slots.js';

// Add a reading, or edit one when `editing` is set. The parent gives this
// component a new `key` when switching between add and edit, so state resets.
export default function ReadingForm({ today, editing, onSaved, onCancel }) {
  const [values, setValues] = useState({
    date: editing?.date ?? today,
    slot: editing?.slot ?? '',
    value: editing ? String(editing.value) : '',
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  const change = (e) => setValues({ ...values, [e.target.name]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setFormError('');
    setFieldErrors({});
    try {
      const path = editing ? `/readings/${editing.id}` : '/readings';
      const { reading } = await api(path, { method: editing ? 'PUT' : 'POST', body: values });
      // After adding, keep the date (handy for entering several slots) but clear the rest.
      if (!editing) setValues({ ...values, slot: '', value: '' });
      onSaved(reading.date);
    } catch (err) {
      setFieldErrors(err.fields);
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card" onSubmit={submit} noValidate>
      <h2>{editing ? 'Edit reading' : 'Add a reading'}</h2>

      <label>
        Date
        <input type="date" name="date" value={values.date} max={today} onChange={change} aria-invalid={Boolean(fieldErrors.date)} />
        {fieldErrors.date && <span className="field-error">{fieldErrors.date}</span>}
      </label>

      <label>
        Time of day
        <select name="slot" value={values.slot} onChange={change} aria-invalid={Boolean(fieldErrors.slot)}>
          <option value="">Choose...</option>
          {SLOTS.map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
        {fieldErrors.slot && <span className="field-error">{fieldErrors.slot}</span>}
      </label>

      <label>
        Glucose (mg/dl)
        {/* type="text" so the server's messages for decimals / letters are what the user sees */}
        <input type="text" inputMode="numeric" name="value" value={values.value} onChange={change} placeholder="40 to 600" aria-invalid={Boolean(fieldErrors.value)} />
        {fieldErrors.value && <span className="field-error">{fieldErrors.value}</span>}
      </label>

      {formError && <p className="form-error" role="alert">{formError}</p>}

      <div className="row">
        <button type="submit" disabled={busy}>{busy ? 'Saving...' : editing ? 'Save changes' : 'Add reading'}</button>
        {editing && <button type="button" className="secondary" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}
