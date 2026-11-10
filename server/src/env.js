// Loads the single .env file that lives in the repo root.
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env'), quiet: true });
