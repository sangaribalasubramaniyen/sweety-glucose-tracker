import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReadingForm from './ReadingForm.jsx';

// The form talks to the API through fetch, so these tests replace fetch with a stub
// and feed the form the same JSON the real server sends (see server/src/routes/readings.js).
const respond = (status, body) => ({ ok: status < 400, status, json: async () => body });

const TODAY = '2026-11-10';

function setup() {
  const onSaved = vi.fn();
  render(<ReadingForm today={TODAY} editing={null} onSaved={onSaved} onCancel={() => {}} />);
  const user = userEvent.setup();
  // Grab the controls once: after an error, the label text also contains the error message.
  const controls = {
    date: screen.getByLabelText('Date'),
    slot: screen.getByLabelText('Time of day'),
    value: screen.getByLabelText('Glucose (mg/dl)'),
    submit: screen.getByRole('button', { name: 'Add reading' }),
  };
  return { user, onSaved, ...controls };
}

describe('ReadingForm', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('starts on today with the four slot labels to choose from', () => {
    const { date, slot } = setup();
    expect(date).toHaveValue(TODAY);
    expect(date).toHaveAttribute('max', TODAY); // the picker blocks future dates
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Choose...', 'Morning (fasting)', 'After breakfast', 'After lunch', 'After dinner',
    ]);
    expect(slot).toHaveValue('');
  });

  it('shows the API message for an invalid value and does not report success', async () => {
    fetch.mockResolvedValue(respond(400, { error: 'Please fill in the highlighted fields.', fields: { value: 'Use a whole number, without decimals.' } }));
    const { user, onSaved, slot, value, submit } = setup();

    await user.selectOptions(slot, 'lunch');
    await user.type(value, '100.5');
    await user.click(submit);

    // What the form sent
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe('/api/readings');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({ date: TODAY, slot: 'lunch', value: '100.5' });

    // What the user sees
    expect(await screen.findByText('Use a whole number, without decimals.')).toBeInTheDocument();
    expect(screen.getByText('Please fill in the highlighted fields.')).toBeInTheDocument();
    expect(value).toHaveAttribute('aria-invalid', 'true');
    expect(value).toHaveValue('100.5'); // the user's input is kept so they can fix it
    expect(onSaved).not.toHaveBeenCalled();
    expect(screen.queryByText('Reading added')).not.toBeInTheDocument();
  });

  it('shows an error under each missing field when submitted empty', async () => {
    fetch.mockResolvedValue(
      respond(400, {
        error: 'Please fill in the highlighted fields.',
        fields: { slot: 'Choose a time of day.', value: 'Enter a glucose value.' },
      })
    );
    const { user, slot, value, submit } = setup();

    await user.click(submit);

    expect(await screen.findByText('Choose a time of day.')).toBeInTheDocument();
    expect(screen.getByText('Enter a glucose value.')).toBeInTheDocument();
    expect(slot).toHaveAttribute('aria-invalid', 'true');
    expect(value).toHaveAttribute('aria-invalid', 'true');
  });

  it('on success shows "Reading added", reports the saved reading, and clears slot and value but keeps the date', async () => {
    const saved = { id: 7, date: TODAY, slot: 'lunch', value: 123 };
    fetch.mockResolvedValue(respond(201, { reading: saved }));
    const { user, onSaved, date, slot, value, submit } = setup();

    await user.selectOptions(slot, 'lunch');
    await user.type(value, '123');
    await user.click(submit);

    expect(await screen.findByText('Reading added')).toBeInTheDocument();
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onSaved).toHaveBeenCalledWith(saved); // the page uses this to jump to the saved date
    expect(slot).toHaveValue('');
    expect(value).toHaveValue('');
    expect(date).toHaveValue(TODAY);

    // Starting another entry removes the confirmation.
    await user.type(value, '1');
    expect(screen.queryByText('Reading added')).not.toBeInTheDocument();
  });

  it('shows the duplicate-slot error from the API and keeps what the user typed', async () => {
    fetch.mockResolvedValue(
      respond(409, {
        error: 'You already have a reading for After lunch on that date. Edit that one instead.',
        fields: { slot: 'This time slot already has a reading for that date.' },
      })
    );
    const { user, onSaved, slot, value, submit } = setup();

    await user.selectOptions(slot, 'lunch');
    await user.type(value, '130');
    await user.click(submit);

    expect(await screen.findByText('You already have a reading for After lunch on that date. Edit that one instead.')).toBeInTheDocument();
    expect(screen.getByText('This time slot already has a reading for that date.')).toBeInTheDocument();
    expect(slot).toHaveAttribute('aria-invalid', 'true');
    expect(slot).toHaveValue('lunch');
    expect(value).toHaveValue('130');
    expect(onSaved).not.toHaveBeenCalled();
    expect(screen.queryByText('Reading added')).not.toBeInTheDocument();
  });

  it('disables the button while saving', async () => {
    let finish;
    fetch.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const { user, slot, value, submit } = setup();

    await user.selectOptions(slot, 'dinner');
    await user.type(value, '150');
    await user.click(submit);

    expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled();
    finish(respond(201, { reading: { id: 1, date: TODAY, slot: 'dinner', value: 150 } }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Add reading' })).toBeEnabled());
  });
});
