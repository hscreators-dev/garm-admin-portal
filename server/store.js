// Tiny file-based persistence layer.
// No native bindings (no better-sqlite3 / no Postgres required) so it runs anywhere Node runs.
// Swap this module out for a real Prisma/Postgres client later without touching routes —
// every function here just needs to keep returning/accepting the same plain objects.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildSeed } from './seed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_FILE = path.join(__dirname, 'db.json');

let data;

function load() {
  if (fs.existsSync(DB_FILE)) {
    try {
      data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      return;
    } catch {
      // fall through to reseed on corrupt file
    }
  }
  data = buildSeed();
  persist();
}

function persist() {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

load();

export const db = {
  // ---- categories ----
  listCategories() { return data.categories; },
  getCategory(id) { return data.categories.find((c) => c.id === id); },
  createCategory(input) {
    const id = data.meta.nextCategoryId++;
    const category = { id, name: input.name, appliesTo: input.appliesTo?.length ? input.appliesTo : ['B2C', 'B2B'], image: input.image || null };
    data.categories.push(category);
    persist();
    return category;
  },
  updateCategory(id, input) {
    const category = data.categories.find((c) => c.id === id);
    if (!category) return null;
    Object.assign(category, {
      name: input.name ?? category.name,
      appliesTo: input.appliesTo?.length ? input.appliesTo : category.appliesTo,
      image: input.image !== undefined ? input.image : category.image,
    });
    persist();
    return category;
  },
  deleteCategory(id) {
    const inUse = data.products.some((p) => p.categoryId === id);
    if (inUse) return { error: 'Category has products assigned to it' };
    data.categories = data.categories.filter((c) => c.id !== id);
    persist();
    return { ok: true };
  },

  // ---- products ----
  listProducts() { return data.products; },
  getProduct(id) { return data.products.find((p) => p.id === id); },
  createProduct(input) {
    const id = data.meta.nextProductId++;
    const product = {
      id,
      name: input.name,
      categoryId: Number(input.categoryId),
      appliesTo: input.appliesTo?.length ? input.appliesTo : ['B2C', 'B2B'],
      price: Number(input.price) || 0,
      sizes: input.sizes || [],
      colors: input.colors || [],
      moq: Number(input.moq) || 0,
      status: input.status || 'ACTIVE',
      image: input.image || null,
    };
    data.products.push(product);
    persist();
    return product;
  },
  updateProduct(id, input) {
    const product = data.products.find((p) => p.id === id);
    if (!product) return null;
    Object.assign(product, {
      name: input.name ?? product.name,
      categoryId: input.categoryId !== undefined ? Number(input.categoryId) : product.categoryId,
      appliesTo: input.appliesTo?.length ? input.appliesTo : product.appliesTo,
      price: input.price !== undefined ? Number(input.price) : product.price,
      sizes: input.sizes ?? product.sizes,
      colors: input.colors ?? product.colors,
      moq: input.moq !== undefined ? Number(input.moq) : product.moq,
      status: input.status ?? product.status,
      image: input.image !== undefined ? input.image : product.image,
    });
    persist();
    return product;
  },
  setProductStatus(id, status) {
    const product = data.products.find((p) => p.id === id);
    if (!product) return null;
    product.status = status;
    persist();
    return product;
  },

  // ---- manufacturers ----
  listManufacturers() { return data.manufacturers; },
  getManufacturer(id) { return data.manufacturers.find((m) => m.id === id); },
  updateManufacturer(id, input) {
    const m = data.manufacturers.find((x) => x.id === id);
    if (!m) return null;
    Object.assign(m, input);
    persist();
    return m;
  },

  // ---- orders ----
  listOrders() { return data.orders; },
  getOrder(id) { return data.orders.find((o) => o.id === id); },
  createOrder(input) {
    const seq = data.meta.nextOrderSeq++;
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const id = Math.max(0, ...data.orders.map((o) => o.id)) + 1;
    const order = {
      id,
      no: `ORD-${today}-${String(seq).padStart(3, '0')}`,
      cust: input.cust,
      type: input.type || 'B2C',
      email: input.email || '',
      address: input.address || '',
      qty: input.lines?.reduce((s, l) => s + Number(l.qty || 0), 0) || 0,
      total: input.lines?.reduce((s, l) => s + Number(l.qty || 0) * Number(l.unit || 0), 0) || 0,
      status: 'NEW',
      qc: 'PENDING',
      pay: 'PENDING',
      mfr: '—',
      date: new Date().toISOString().slice(0, 10),
      lines: input.lines || [],
    };
    data.orders.unshift(order);
    persist();
    return order;
  },
  updateOrderStatus(id, patch) {
    const order = data.orders.find((o) => o.id === id);
    if (!order) return null;
    Object.assign(order, patch);
    persist();
    return order;
  },
};

export function resetToSeed() {
  data = buildSeed();
  persist();
  return data;
}
