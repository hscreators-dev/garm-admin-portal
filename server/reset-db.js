// Run with: npm run seed:reset
// Wipes server/db.json back to the original seed data (server/seed.js).
// Orders/Quotes are NOT part of this — they live in MongoDB (the same
// database the Garm App's own backend uses) and are untouched by this script.
import { resetToSeed } from './store.js';

const fresh = resetToSeed();
console.log('Database reset to seed data (catalog/settings/employees only — orders/quotes live in MongoDB and are untouched):');
console.log(`  categories: ${fresh.categoriesB2C.length} (Individuals), ${fresh.categoriesB2B.length} (Organizations)`);
console.log(`  products:   ${fresh.productsB2C.length} (Individuals), ${fresh.productsB2B.length} (Organizations)`);
console.log(`  manufacturers: ${fresh.manufacturers.length}`);
