// Database slot keys -> labels shown to the user. Keys must match the CHECK
// constraint in server/db/schema.sql. Used from Phase 3 onwards.
export const SLOTS = [
  { key: 'fasting', label: 'Morning (fasting)' },
  { key: 'breakfast', label: 'After breakfast' },
  { key: 'lunch', label: 'After lunch' },
  { key: 'dinner', label: 'After dinner' },
];
