// Run with: npm run seed:reset
// Wipes server/db.json back to the original seed data (server/seed.js).
import { resetToSeed } from './store.js';

const fresh = resetToSeed();
console.log('Database reset to seed data:');
console.log(`  categories: ${fresh.categories.length}`);
console.log(`  products:   ${fresh.products.length}`);
console.log(`  orders:     ${fresh.orders.length}`);
console.log(`  manufacturers: ${fresh.manufacturers.length}`);
