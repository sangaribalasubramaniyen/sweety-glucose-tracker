// Pure validation for a glucose reading (no database, easy to unit test).
const { SLOT_KEYS } = require('./slots');

const MIN_VALUE = 40;
const MAX_VALUE = 600;

// Returns an error message, or null if the date is valid.
function checkDate(date, today) {
  if (date === undefined || date === null || String(date).trim() === '') return 'Choose a date.';
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'Enter the date as YYYY-MM-DD.';
  const [y, m, d] = date.split('-').map(Number);
  const check = new Date(Date.UTC(y, m - 1, d));
  const realDate = check.getUTCFullYear() === y && check.getUTCMonth() === m - 1 && check.getUTCDate() === d;
  if (!realDate || y < 1900) return 'Enter a valid date.';
  if (date > today) return 'The date cannot be in the future.'; // ISO dates compare correctly as strings
  return null;
}

function checkSlot(slot) {
  if (slot === undefined || slot === null || slot === '') return 'Choose a time of day.';
  if (!SLOT_KEYS.includes(slot)) return 'Choose one of the four time slots.';
  return null;
}

// Returns { error } or { value } (an integer).
function parseValue(raw) {
  if (raw === undefined || raw === null || (typeof raw === 'string' && raw.trim() === '')) {
    return { error: 'Enter a glucose value.' };
  }
  let n;
  if (typeof raw === 'number') {
    n = raw;
    if (!Number.isFinite(n)) return { error: 'Glucose value must be a number.' };
    if (!Number.isInteger(n)) return { error: 'Use a whole number, without decimals.' };
  } else if (typeof raw === 'string') {
    const text = raw.trim();
    if (!/^-?\d+(\.\d*)?$/.test(text)) return { error: 'Glucose value must be a number.' };
    if (text.includes('.')) return { error: 'Use a whole number, without decimals.' }; // also rejects "100.0"
    n = Number(text);
  } else {
    return { error: 'Glucose value must be a number.' };
  }
  if (n < MIN_VALUE || n > MAX_VALUE) {
    return { error: `Glucose value must be between ${MIN_VALUE} and ${MAX_VALUE} mg/dl.` };
  }
  return { value: n };
}

// Validates { date, slot, value }. Returns { errors } (field -> message) or { data }.
function validateReading(input, today) {
  const errors = {};
  const dateError = checkDate(input.date, today);
  if (dateError) errors.date = dateError;
  const slotError = checkSlot(input.slot);
  if (slotError) errors.slot = slotError;
  const parsed = parseValue(input.value);
  if (parsed.error) errors.value = parsed.error;

  if (Object.keys(errors).length) return { errors };
  return { data: { date: input.date, slot: input.slot, value: parsed.value } };
}

module.exports = { MIN_VALUE, MAX_VALUE, validateReading, checkDate, parseValue };
