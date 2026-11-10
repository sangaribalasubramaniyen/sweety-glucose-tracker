// Slot keys (stored in the database) and the labels used in messages.
// Keys must match the CHECK constraint in db/schema.sql.
const SLOTS = [
  { key: 'fasting', label: 'Morning (fasting)' },
  { key: 'breakfast', label: 'After breakfast' },
  { key: 'lunch', label: 'After lunch' },
  { key: 'dinner', label: 'After dinner' },
];
const SLOT_KEYS = SLOTS.map((s) => s.key);
const slotLabel = (key) => SLOTS.find((s) => s.key === key)?.label ?? key;

module.exports = { SLOTS, SLOT_KEYS, slotLabel };
