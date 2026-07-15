// Tiny file-based persistence layer.
// No native bindings (no better-sqlite3 / no Postgres required) so it runs anywhere Node runs.
// Swap this module out for a real Prisma/Postgres client later without touching routes —
// every function here just needs to keep returning/accepting the same plain objects.

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { buildSeed } from './seed.js';
import { buildInvoicePdf } from './invoice.js';
import { encryptFields, decryptFields, hashSecret, timingSafeEqualStr } from './security.js';
import { MongoOrder, MongoQuote, MongoUser, getOrCreateWalkInUser, nextOrderSeq } from './mongo.js';

function randomToken() {
  return crypto.randomBytes(24).toString('hex');
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// DB_FILE lets deployments point the catalog/settings store at a mounted
// volume (e.g. Docker) so it survives container restarts. Defaults to the
// local file next to the server for dev.
const DB_FILE = process.env.DB_FILE || path.join(__dirname, 'db.json');

// Fields containing customer/employee PII or payment metadata, encrypted at
// rest (AES-256-GCM) on every write to db.json and decrypted back to
// plaintext the moment they're loaded into memory. Everything else in
// `data` (ids, statuses, timestamps, category/product records, order line
// items) stays plaintext on disk — encrypting those would only make the
// admin's own queries/filters harder without protecting anything sensitive.
// See server/security.js for what this does and doesn't guarantee.
const CUSTOMER_FIELDS = ['name', 'phone', 'email'];
const ADDRESS_FIELDS = ['line1', 'line2', 'city', 'pin'];
const PAYMENT_FIELDS = ['upiId', 'accountNumber', 'ifsc', 'accountHolder', 'cardHolderName', 'cardExpiry'];
// Orders no longer live in this file store (see below) — they're in MongoDB,
// unencrypted, matching how the Garm App's own backend already stores them.
const USER_FIELDS = ['name', 'email'];
const OTP_FIELDS = ['identity'];
// Company/billing settings — bank + payment-gateway details are exactly the
// kind of "customer/financial data" the security hardening pass is meant to
// protect, so they're encrypted at rest the same way payment methods are.
const COMPANY_FIELDS = ['accountNumber', 'ifscCode', 'paymentGatewayKey', 'bankAccountHolder'];

function toDiskFormat(d) {
  return {
    ...d,
    customers: (d.customers || []).map((c) => ({
      ...encryptFields(c, CUSTOMER_FIELDS),
      addresses: (c.addresses || []).map((a) => encryptFields(a, ADDRESS_FIELDS)),
      paymentMethods: (c.paymentMethods || []).map((pm) => encryptFields(pm, PAYMENT_FIELDS)),
    })),
    users: (d.users || []).map((u) => encryptFields(u, USER_FIELDS)),
    otps: (d.otps || []).map((o) => encryptFields(o, OTP_FIELDS)),
    settings: d.settings ? { ...d.settings, company: encryptFields(d.settings.company || {}, COMPANY_FIELDS) } : d.settings,
  };
}

function fromDiskFormat(d) {
  return {
    ...d,
    customers: (d.customers || []).map((c) => ({
      ...decryptFields(c, CUSTOMER_FIELDS),
      addresses: (c.addresses || []).map((a) => decryptFields(a, ADDRESS_FIELDS)),
      paymentMethods: (c.paymentMethods || []).map((pm) => decryptFields(pm, PAYMENT_FIELDS)),
    })),
    users: (d.users || []).map((u) => decryptFields(u, USER_FIELDS)),
    otps: (d.otps || []).map((o) => decryptFields(o, OTP_FIELDS)),
    settings: d.settings ? { ...d.settings, company: decryptFields(d.settings.company || {}, COMPANY_FIELDS) } : d.settings,
  };
}

// ─── Orders/Quotes — backed by the SAME MongoDB the Garm App's own backend
// (Latest version of FAB/backend) writes to, instead of this file store. See
// server/mongo.js for why and the schema this mirrors. `seq` is the plain
// numeric id the admin UI expects; Mongo's own _id is an ObjectId string.
//
// Two status vocabularies coexist on the same document: `status` (customer-
// facing — Draft/Quote pending/.../Delivered, drives the Garm App's own
// tracker) and `adminStatus` (operational — NEW/ASSIGNED/.../DELIVERED,
// drives this admin portal). deriveCustomerStatus() keeps the customer's
// tracker moving forward whenever the admin advances adminStatus.
function deriveCustomerStatus(adminStatus, persona) {
  const isB2C = persona === 'individual';
  switch (adminStatus) {
    case 'NEW':             return 'Order placed'; // B2C tracker renders this as "Order submitted"
    case 'CONFIRMED':       return 'Order confirmed';
    // B2C: payment happens right after confirmation, before production starts —
    // the customer stays on "Order confirmed" (their tracker's Payment step is
    // marked done by the pay endpoint) until the admin actually starts production.
    // Org: invoicing + balance payment happen AFTER QC — the customer's
    // tracker must stay at Quality check (never regress to In production).
    case 'PAID':            return isB2C ? 'Order confirmed' : 'Quality check';
    case 'ASSIGNED':        return isB2C ? 'In production' : 'Order placed';
    case 'IN_PROGRESS':     return 'In production';
    case 'QC_READY':
    case 'QC_APPROVED':     return 'Quality check';
    case 'INVOICED':        return 'Quality check'; // post-QC, pre-dispatch
    case 'SHIPPED':         return 'Shipped';
    case 'DELIVERED':       return 'Delivered';
    case 'CANCELLED':       return 'Cancelled';
    default:                return 'Order placed';
  }
}

function recomputeTrackSteps(doc) {
  if (!doc.trackSteps || doc.trackSteps.length === 0) return;
  // A confirmed-and-paid B2C order already had its tracker advanced by the
  // pay endpoint (Payment step done, "In production" queued) — recomputing
  // here would clobber the payment sub-label, so leave it alone.
  if (doc.status === 'Order confirmed' && doc.paymentStatus === 'paid') return;
  let idx = doc.trackSteps.findIndex((s) => stepMatchesStatus(s.label, doc.status));
  // Org order assigned to a manufacturer: "Sourcing material" is the current
  // stage (status label is still 'Order placed', which would match step 0).
  if (doc.status === 'Order placed' && doc.adminStatus === 'ASSIGNED') {
    const srcIdx = doc.trackSteps.findIndex((s) => s.label.toLowerCase().includes('sourcing'));
    if (srcIdx >= 0) idx = srcIdx;
  }
  // "Order confirmed" (unpaid): the confirm step is DONE and Payment is the
  // active step — the customer's next action.
  if (doc.status === 'Order confirmed') {
    const payIdx = doc.trackSteps.findIndex((s) => s.label.toLowerCase().includes('payment'));
    if (payIdx >= 0) idx = payIdx;
  }
  doc.trackSteps = doc.trackSteps.map((s, i) => ({
    ...s,
    status: idx < 0 ? s.status : i < idx ? 'done' : i === idx ? 'active' : 'pending',
  }));
}
function stepMatchesStatus(label, status) {
  const l = label.toLowerCase();
  if (status === 'Delivered') return l.includes('deliver');
  if (status === 'Shipped') return l.includes('ship');
  if (status === 'Quality check') return l.includes('quality');
  if (status === 'In production') return l.includes('production');
  if (status === 'Order confirmed') return l.includes('confirm');
  return l.includes('order placed') || l.includes('submitted') || l.includes('sourcing');
}

function synthesizeLines(o) {
  // Manual admin orders already have real `lines`. Garm App orders don't —
  // they describe a garment spec (garmentType/sizes/colors) instead — so
  // derive a display-friendly line-item breakdown for the admin's Order
  // Items table rather than showing it empty.
  if (o.lines?.length) return o.lines;
  if (o.isAccessoryOrder && o.accessoryItems?.length) {
    return o.accessoryItems.map((a) => ({ p: a.itemName, size: '—', color: '—', qty: a.qty, unit: 0 }));
  }
  if (o.sizes?.length) {
    const color = o.colors?.[0]?.label || '—';
    return o.sizes.map((s) => ({ p: o.garmentType || 'Garment', size: s.label, color, qty: s.qty, unit: 0 }));
  }
  return [];
}

function toAdminOrder(o) {
  const user = o.userId && typeof o.userId === 'object' ? o.userId : null;
  const cust = o.orgName || o.contactName || user?.name || (o.persona === 'organisation' ? 'Organisation' : 'Individual Customer');
  const email = o.contactEmail || user?.email || '';
  const address = [o.deliveryAddress, o.deliveryCity, o.deliveryPin].filter(Boolean).join(', ');
  const lines = synthesizeLines(o);
  const qty = o.qty || lines.reduce((s, l) => s + (l.qty || 0), 0);
  const total = o.total || lines.reduce((s, l) => s + (l.qty || 0) * (l.unit || 0), 0);
  return {
    id: o.seq,
    _mongoId: String(o._id),
    no: o.orderRef,
    orderRef: o.orderRef,
    cust,
    type: o.persona === 'organisation' ? 'B2B' : 'B2C',
    email,
    address,
    qty,
    total,
    status: o.adminStatus,
    qc: o.qcResult,
    pay: o.adminPayStatus,
    mfr: o.manufacturer || '—',
    date: (o.createdAt ? new Date(o.createdAt) : new Date()).toISOString().slice(0, 10),
    lines,
    customerId: user ? String(user._id) : (o.userId ? String(o.userId) : null),
    persona: o.persona,
    isAccessoryOrder: !!o.isAccessoryOrder,
    orgType: o.orgType ?? null,
    orgName: o.orgName ?? null,
    service: o.service ?? null,
    serviceLabel: o.serviceLabel ?? null,
    garmentType: o.garmentType ?? null,
    fabric: o.fabric ?? null,
    gsm: o.gsm ?? null,
    sizes: o.sizes ?? [],
    colors: o.colors ?? [],
    accessoryItems: o.accessoryItems ?? [],
    etaDate: o.etaDate ?? null,
    quoteAmount: o.quoteAmount ?? null,
    serviceFee: o.serviceFee ?? 0,
    paymentStatus: o.paymentStatus ?? 'PENDING',
    // Full order record — everything the customer configured plus payment &
    // contact, so the admin's Order view/print never has to guess.
    weave: o.weave ?? null,
    fabricSource: o.fabricSource ?? null,
    stitching: o.stitching ?? null,
    packaging: o.packaging ?? null,
    contactName: o.contactName ?? null,
    contactPhone: o.contactPhone ?? null,
    contactEmail: o.contactEmail ?? null,
    deliveryAddress: o.deliveryAddress ?? null,
    deliveryCity: o.deliveryCity ?? null,
    deliveryPin: o.deliveryPin ?? null,
    notes: o.notes ?? null,
    paymentMode: o.paymentMode ?? null,
    paymentDate: o.paymentDate ? new Date(o.paymentDate).toISOString().slice(0, 10) : null,
    paymentReference: o.paymentReference ?? null,
    confirmedAt: o.confirmedAt ? new Date(o.confirmedAt).toISOString().slice(0, 10) : null,
    assignedEmployee: o.assignedEmployee ?? null,
    trackingCourier: o.trackingCourier ?? null,
    trackingNumber: o.trackingNumber ?? null,
    documents: (o.documents || []).map((d) => ({
      id: String(d._id),
      name: d.name,
      kind: d.kind,
      uploadedBy: d.uploadedBy,
      dataUrl: d.dataUrl,
      generated: d.generated === true,
      visible: d.visible !== false,
      createdAt: d.createdAt ? new Date(d.createdAt).toISOString().slice(0, 10) : null,
    })),
  };
}

function toAdminQuote(q, orderSeq) {
  return {
    id: String(q._id),
    orderId: orderSeq ?? null,
    amount: q.amount,
    currency: q.currency || 'INR',
    breakdown: q.breakdown || [],
    validUntil: q.validUntil instanceof Date ? q.validUntil.toISOString() : q.validUntil,
    status: q.status,
    rejectionNote: q.rejectionNote ?? null,
    createdAt: q.createdAt instanceof Date ? q.createdAt.toISOString() : q.createdAt,
  };
}

let data;

function load() {
  if (fs.existsSync(DB_FILE)) {
    try {
      data = fromDiskFormat(JSON.parse(fs.readFileSync(DB_FILE, 'utf8')));
      // Self-heal: records encrypted with a DIFFERENT secret key (e.g. a
      // db.json copied between machines/deploys) can't be decrypted — they'd
      // show as "enc:v1:…" garbage in the UI and be uneditable. Replace the
      // employee/user list with a fresh seed in that case (SUPER_ADMIN_EMAIL
      // re-provisions the real admin on boot), and reset undecryptable
      // company settings. Catalog/settings that aren't encrypted are kept.
      const looksEncrypted = (v) => typeof v === 'string' && v.startsWith('enc:v1:');
      if ((data.users || []).some((u) => looksEncrypted(u.email) || looksEncrypted(u.name))) {
        console.warn('[security] users were encrypted with a different key — reseeding the employee list.');
        data.users = buildSeed().users;
      }
      if (data.customers) data.customers = data.customers.filter((c) => !looksEncrypted(c.email) && !looksEncrypted(c.name));
      if (data.otps) data.otps = data.otps.filter((o) => !looksEncrypted(o.identity));
      if (data.settings?.company && Object.values(data.settings.company).some(looksEncrypted)) {
        console.warn('[security] company settings were encrypted with a different key — resetting to defaults.');
        data.settings.company = buildSeed().settings.company;
      }
      migrate();
      return;
    } catch {
      // fall through to reseed on corrupt file
    }
  }
  data = buildSeed();
  persist();
}

// Forward-migrate an existing db.json to the current shape without wiping
// anything the admin already configured. Runs on every boot; only writes
// back if something was actually missing.
function migrate() {
  const seed = buildSeed();
  let changed = false;

  // Products: productType + inStock were added later. Heuristic for old
  // records: anything with sizes or fabric options is a garment.
  for (const key of ['productsB2C', 'productsB2B']) {
    for (const p of data[key] || []) {
      if (p.productType === undefined) {
        p.productType = (p.sizes?.length || p.fabricOptions?.length || p.gsmOptions?.length) ? 'GARMENT' : 'ACCESSORY';
        changed = true;
      }
      if (p.inStock === undefined) { p.inStock = true; changed = true; }
      // Garments: backfill styles / fabric / GSM / weave from the seed (the
      // app's exact built-in lists) so the portal is never missing them.
      {
        const seedProduct = (seed[key] || []).find((sp) => sp.name === p.name && sp.categoryId === p.categoryId);
        if (p.productType === 'GARMENT' && seedProduct) {
          if (!Array.isArray(p.styles) || p.styles.length === 0) { p.styles = [...(seedProduct.styles || [])]; changed = true; }
          if (!Array.isArray(p.weaveOptions) || p.weaveOptions.length === 0) { p.weaveOptions = [...(seedProduct.weaveOptions || [])]; changed = true; }
          if (!Array.isArray(p.fabricOptions) || p.fabricOptions.length === 0) { p.fabricOptions = [...(seedProduct.fabricOptions || [])]; changed = true; }
          if (!Array.isArray(p.gsmOptions) || p.gsmOptions.length === 0) { p.gsmOptions = [...(seedProduct.gsmOptions || [])]; changed = true; }
          // Old default 4-colour palette → the app's real 8-colour palette,
          // ONLY if untouched (exactly the old default set).
          const old4 = ['Black', 'White', 'Navy', 'Grey'];
          const labels = (p.colors || []).map((c) => c.label);
          if (labels.length === 4 && old4.every((l) => labels.includes(l))) {
            p.colors = JSON.parse(JSON.stringify(seedProduct.colors || []));
            changed = true;
          }
        }
        if (p.styles === undefined) { p.styles = []; changed = true; }
        if (p.weaveOptions === undefined) { p.weaveOptions = []; changed = true; }
      }
      // Accessories with no spec fields yet inherit the app's built-in lists
      // (Material / Finish / Print method…) from the seed, so the admin
      // Catalog always shows the same options customers see — editable.
      if (!Array.isArray(p.specFields) || p.specFields.length === 0) {
        const seedProduct = (seed[key] || []).find((sp) => sp.name === p.name && sp.categoryId === p.categoryId);
        if (p.productType === 'ACCESSORY' && seedProduct?.specFields?.length) {
          p.specFields = JSON.parse(JSON.stringify(seedProduct.specFields));
          changed = true;
        } else if (p.specFields === undefined) {
          p.specFields = [];
          changed = true;
        }
      }
      // Colours used to be bare text ("Black, White"); upgrade to {label, hex}
      // swatches, and give colour-less products the seed default palette so
      // every product carries real colour variants.
      if (!Array.isArray(p.colors) || p.colors.length === 0 || typeof p.colors[0] === 'string') {
        const seedProduct = (seed[key] || []).find((sp) => sp.name === p.name && sp.categoryId === p.categoryId);
        p.colors = (Array.isArray(p.colors) && p.colors.length)
          ? normalizeColors(p.colors)
          : (seedProduct?.colors || normalizeColors(['Black', 'White']));
        changed = true;
      }
    }
  }

  // Settings: coordinator (procurement manager shown in the Garm App) added later.
  if (data.settings && !data.settings.coordinator) {
    data.settings.coordinator = seed.settings.coordinator;
    changed = true;
  }
  // Settings: Garm App order-form section toggles added later.
  if (data.settings && !data.settings.orderForm) {
    data.settings.orderForm = seed.settings.orderForm;
    changed = true;
  }
  // Settings: service-fee schedule added later.
  if (data.settings && !data.settings.serviceFee) {
    data.settings.serviceFee = seed.settings.serviceFee;
    changed = true;
  }
  // Fee defaults were raised to profitable margins (5/3/2/25 → 15/8/5/99).
  // Upgrade automatically ONLY if the stored values are still the old
  // defaults untouched — anything the admin customised is left alone.
  if (data.settings?.serviceFee) {
    const f = data.settings.serviceFee;
    if (f.b2cPercent === 5 && f.b2bPercent === 3 && f.bulkPercent === 2 && f.minFee === 25) {
      data.settings.serviceFee = { ...f, ...seed.settings.serviceFee };
      changed = true;
    }
    // Per-piece component added later — default it in without touching the rest.
    if (data.settings.serviceFee.orgAdvancePercent === undefined) {
      data.settings.serviceFee.orgAdvancePercent = seed.settings.serviceFee.orgAdvancePercent;
      changed = true;
    }
    if (data.settings.serviceFee.surplusDiscountPercent === undefined) {
      data.settings.serviceFee.surplusDiscountPercent = seed.settings.serviceFee.surplusDiscountPercent;
      changed = true;
    }
    if (data.settings.serviceFee.b2cPerPiece === undefined) {
      data.settings.serviceFee.b2cPerPiece = seed.settings.serviceFee.b2cPerPiece;
      changed = true;
    }
  }

  // Track stages: merge in any stages added since this file was created
  // (e.g. CONFIRMED), preserving admin-edited labels on existing ones.
  if (Array.isArray(data.trackStages)) {
    const have = new Set(data.trackStages.map((s) => s.key));
    const merged = [];
    for (const stage of seed.trackStages) {
      const existing = data.trackStages.find((s) => s.key === stage.key);
      merged.push(existing ? { ...stage, label: existing.label, sub: existing.sub } : stage);
      if (!have.has(stage.key)) changed = true;
    }
    data.trackStages = merged;
  }

  if (changed) persist();
}

function persist() {
  fs.writeFileSync(DB_FILE, JSON.stringify(toDiskFormat(data), null, 2));
}

load();

// ─── Product colours — always {label, hex} objects, never bare text. ─────────
// Older records (and lazy API callers) may still send plain strings like
// "Black"; normalizeColors upgrades them using this name→hex map so the Garm
// App can render real swatches everywhere.
const COLOR_HEX = {
  black: '#0D0D0D', white: '#FFFFFF', navy: '#1F2A44', 'navy blue': '#1F2A44',
  grey: '#9CA3AF', gray: '#9CA3AF', charcoal: '#374151', red: '#DC2626',
  maroon: '#7F1D1D', blue: '#2563EB', 'sky blue': '#60A5FA', green: '#16A34A',
  olive: '#65803D', yellow: '#EAB308', orange: '#EA580C', pink: '#EC4899',
  purple: '#7C3AED', brown: '#8B5E3C', beige: '#D9C7A7', cream: '#F5EFE0',
  ivory: '#FFFFF0', khaki: '#B8A26B', gold: '#C8A97E', silver: '#C0C0C0',
};
// Admin-defined spec fields for accessory products ("Material", "Finish",
// "Print method"…) — label + options, rendered by the Garm App instead of its
// built-in per-category defaults when present.
function normalizeSpecFields(fields) {
  if (!Array.isArray(fields)) return [];
  return fields.map((f) => ({
    label: String(f?.label ?? '').trim(),
    options: Array.isArray(f?.options) ? f.options.map((o) => String(o).trim()).filter(Boolean) : [],
    hint: f?.hint ? String(f.hint) : undefined,
  })).filter((f) => f.label && f.options.length > 0).slice(0, 12);
}

function normalizeColors(colors) {
  if (!Array.isArray(colors)) return [];
  return colors.map((c) => {
    if (c && typeof c === 'object' && c.hex) return { label: String(c.label || c.hex), hex: String(c.hex) };
    const label = String(typeof c === 'object' ? (c?.label ?? '') : c).trim();
    if (!label) return null;
    return { label, hex: COLOR_HEX[label.toLowerCase()] || '#CCCCCC' };
  }).filter(Boolean);
}

// Individuals (B2C) and Organizations (B2B) catalogs are fully separate
// tables — separate arrays, separate id sequences — never one shared array
// with a "visible to both" flag. `audience` picks which pair to operate on;
// every category/product function below requires it.
function catKey(audience) { return audience === 'B2B' ? 'categoriesB2B' : 'categoriesB2C'; }
function prodKey(audience) { return audience === 'B2B' ? 'productsB2B' : 'productsB2C'; }
function catIdKey(audience) { return audience === 'B2B' ? 'nextCategoryIdB2B' : 'nextCategoryIdB2C'; }
function prodIdKey(audience) { return audience === 'B2B' ? 'nextProductIdB2B' : 'nextProductIdB2C'; }

export const db = {
  // ---- categories ----
  listCategories(audience) { return data[catKey(audience)]; },
  getCategory(audience, id) { return data[catKey(audience)].find((c) => c.id === id); },
  createCategory(audience, input) {
    const id = data.meta[catIdKey(audience)]++;
    const category = {
      id,
      audience,
      name: input.name,
      image: input.image || null,
      description: input.description || '',
    };
    data[catKey(audience)].push(category);
    persist();
    return category;
  },
  updateCategory(audience, id, input) {
    const category = data[catKey(audience)].find((c) => c.id === id);
    if (!category) return null;
    Object.assign(category, {
      name: input.name ?? category.name,
      image: input.image !== undefined ? input.image : category.image,
      description: input.description !== undefined ? input.description : (category.description ?? ''),
    });
    persist();
    return category;
  },
  deleteCategory(audience, id) {
    const inUse = data[prodKey(audience)].some((p) => p.categoryId === id);
    if (inUse) return { error: 'Category has products assigned to it' };
    data[catKey(audience)] = data[catKey(audience)].filter((c) => c.id !== id);
    persist();
    return { ok: true };
  },

  // ---- products ----
  listProducts(audience) { return data[prodKey(audience)]; },
  getProduct(audience, id) { return data[prodKey(audience)].find((p) => p.id === id); },
  createProduct(audience, input) {
    const id = data.meta[prodIdKey(audience)]++;
    const product = {
      id,
      audience,
      name: input.name,
      categoryId: Number(input.categoryId),
      // What KIND of product this is drives which config fields matter —
      // garments carry fabric/GSM/sizes/stitching, accessories don't.
      productType: input.productType || 'GARMENT',
      // Stock availability (mainly for Individuals ordering 1–2 pcs): an
      // out-of-stock product stays visible in the Garm App but can't be ordered.
      inStock: input.inStock !== undefined ? !!input.inStock : true,
      price: Number(input.price) || 0,
      sizes: input.sizes || [],
      colors: normalizeColors(input.colors),
      specFields: normalizeSpecFields(input.specFields),
      styles: Array.isArray(input.styles) ? input.styles.map(String).filter(Boolean) : [],
      weaveOptions: Array.isArray(input.weaveOptions) ? input.weaveOptions.map(String).filter(Boolean) : [],
      moq: Number(input.moq) || 0,
      status: input.status || 'ACTIVE',
      image: input.image || null,
      // Spec/config fields matching what the Garm App actually shows per
      // catalog item (material, GSM, stitching & packaging, photo gallery,
      // logo/branding upload) — captured here so the admin record fully
      // represents the product, not just name+price+image.
      description: input.description || '',
      gallery: input.gallery || [],
      fabricOptions: input.fabricOptions || [],
      gsmOptions: input.gsmOptions || [],
      stitchingOptions: input.stitchingOptions || [],
      packagingOptions: input.packagingOptions || [],
      allowsLogoUpload: !!input.allowsLogoUpload,
    };
    data[prodKey(audience)].push(product);
    persist();
    return product;
  },
  updateProduct(audience, id, input) {
    const product = data[prodKey(audience)].find((p) => p.id === id);
    if (!product) return null;
    Object.assign(product, {
      name: input.name ?? product.name,
      categoryId: input.categoryId !== undefined ? Number(input.categoryId) : product.categoryId,
      productType: input.productType ?? product.productType ?? 'GARMENT',
      inStock: input.inStock !== undefined ? !!input.inStock : (product.inStock ?? true),
      price: input.price !== undefined ? Number(input.price) : product.price,
      sizes: input.sizes ?? product.sizes,
      colors: input.colors !== undefined ? normalizeColors(input.colors) : product.colors,
      specFields: input.specFields !== undefined ? normalizeSpecFields(input.specFields) : (product.specFields ?? []),
      styles: input.styles !== undefined ? input.styles.map(String).filter(Boolean) : (product.styles ?? []),
      weaveOptions: input.weaveOptions !== undefined ? input.weaveOptions.map(String).filter(Boolean) : (product.weaveOptions ?? []),
      moq: input.moq !== undefined ? Number(input.moq) : product.moq,
      status: input.status ?? product.status,
      image: input.image !== undefined ? input.image : product.image,
      description: input.description !== undefined ? input.description : (product.description ?? ''),
      gallery: input.gallery ?? product.gallery ?? [],
      fabricOptions: input.fabricOptions ?? product.fabricOptions ?? [],
      gsmOptions: input.gsmOptions ?? product.gsmOptions ?? [],
      stitchingOptions: input.stitchingOptions ?? product.stitchingOptions ?? [],
      packagingOptions: input.packagingOptions ?? product.packagingOptions ?? [],
      allowsLogoUpload: input.allowsLogoUpload !== undefined ? !!input.allowsLogoUpload : !!product.allowsLogoUpload,
    });
    persist();
    return product;
  },
  setProductStatus(audience, id, status) {
    const product = data[prodKey(audience)].find((p) => p.id === id);
    if (!product) return null;
    product.status = status;
    persist();
    return product;
  },
  deleteProduct(audience, id) {
    const key = prodKey(audience);
    const exists = data[key].some((p) => p.id === id);
    if (!exists) return null;
    data[key] = data[key].filter((p) => p.id !== id);
    persist();
    return { ok: true };
  },
  setProductStock(audience, id, inStock) {
    const product = data[prodKey(audience)].find((p) => p.id === id);
    if (!product) return null;
    product.inStock = !!inStock;
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

  // ---- orders (MongoDB — shared with the Garm App's real backend; see
  // server/mongo.js. No longer part of the file store.) ----
  async listOrders() {
    const docs = await MongoOrder.find().sort({ createdAt: -1 }).populate('userId', 'name email phone orgName').lean();
    return docs.map(toAdminOrder);
  },
  async getOrder(id) {
    const doc = await MongoOrder.findOne({ seq: id }).populate('userId', 'name email phone orgName').lean();
    return doc ? toAdminOrder(doc) : null;
  },
  async createOrder(input) {
    // Manual "Log Manual Order" entries from the admin — real Garm App
    // orders come in through the app's own backend (Latest version of FAB/backend),
    // not through this function.
    const walkIn = await getOrCreateWalkInUser();
    // Every admin operation addresses orders by `seq` (getOrder/updateOrderStatus/
    // addOrderDocument/generateInvoice all query { seq }), so a manual order MUST
    // get one — otherwise it lists but 404s the moment it's opened/edited/invoiced.
    // Derived from the SAME atomic counter the app backend uses, so the two never
    // collide; orderRef follows the identical FL-<2046+seq> scheme.
    const seq = await nextOrderSeq();
    const doc = await MongoOrder.create({
      userId: walkIn._id,
      seq,
      orderRef: `FL-${2046 + seq}`,
      persona: input.persona ?? (input.type === 'B2B' ? 'organisation' : 'individual'),
      isAccessoryOrder: input.isAccessoryOrder ?? false,
      orgType: input.orgType ?? undefined,
      orgName: input.orgName ?? (input.type === 'B2B' ? input.cust : undefined),
      service: input.service ?? undefined,
      serviceLabel: input.serviceLabel ?? undefined,
      garmentType: input.garmentType ?? undefined,
      fabric: input.fabric ?? undefined,
      gsm: input.gsm ?? undefined,
      qty: Number(input.qty) || input.lines?.reduce((s, l) => s + Number(l.qty || 0), 0) || 0,
      sizes: input.sizes ?? [],
      colors: input.colors ?? [],
      accessoryItems: input.accessoryItems ?? [],
      deliveryAddress: input.address ?? undefined,
      contactName: input.type !== 'B2B' ? input.cust : undefined,
      contactEmail: input.email ?? undefined,
      etaDate: input.etaDate ?? undefined,
      quoteAmount: input.quoteAmount ?? undefined,
      notes: input.notes ?? undefined,
      lines: input.lines || [],
      total: input.lines?.reduce((s, l) => s + Number(l.qty || 0) * Number(l.unit || 0), 0) || 0,
    });
    const populated = await doc.populate('userId', 'name email phone orgName');
    return toAdminOrder(populated.toObject());
  },
  // Customer-safe order edit — delivery + contact + notes ONLY. Never touches
  // status/adminStatus/payment/amounts (that's admin-only via updateOrderStatus).
  // Editing is blocked once the order has entered production or later.
  async updateOrderDetails(id, patch) {
    const order = await MongoOrder.findOne({ seq: id });
    if (!order) return null;
    const LOCKED = ['In production', 'Quality check', 'Shipped', 'Delivered', 'Completed'];
    if (LOCKED.includes(order.status)) {
      const e = new Error('This order can no longer be edited — contact your coordinator');
      e.statusCode = 409;
      throw e;
    }
    for (const k of ['notes', 'deliveryAddress', 'deliveryCity', 'deliveryPin', 'contactName', 'contactPhone', 'contactEmail']) {
      if (patch[k] !== undefined) order[k] = patch[k];
    }
    await order.save();
    const populated = await order.populate('userId', 'name email phone orgName');
    return toAdminOrder(populated.toObject());
  },
  async updateOrderStatus(id, patch) {
    const order = await MongoOrder.findOne({ seq: id });
    if (!order) return null;
    // Translate the admin-facing patch shape ({status, mfr, qc, pay, total,
    // quoteAmount, assignedEmployee, etaDate}) onto the Mongo document's field
    // names, and keep the customer's own tracker (status/trackSteps) in step.
    if (patch.status !== undefined) {
      order.adminStatus = patch.status;
      order.status = deriveCustomerStatus(patch.status, order.persona);
      if (patch.status === 'CONFIRMED' && !order.confirmedAt) {
        order.confirmedAt = new Date();
        // Stamp the confirm step with the date; Payment becomes the active step.
        const dateLabel = order.confirmedAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        const confirmStep = (order.trackSteps || []).find((s) => s.label.toLowerCase().includes('confirm'));
        if (confirmStep) confirmStep.sub = `Confirmed by Garm · ${dateLabel}`;
        const payStep = (order.trackSteps || []).find((s) => s.label.toLowerCase().includes('payment'));
        if (payStep && order.paymentStatus !== 'paid') payStep.sub = 'Pay now to start production';
      }
      recomputeTrackSteps(order);
    }
    if (patch.trackingCourier !== undefined) order.trackingCourier = patch.trackingCourier || undefined;
    if (patch.trackingNumber !== undefined) order.trackingNumber = patch.trackingNumber || undefined;
    // On dispatch, stamp the customer's Shipped step with the courier + tracking
    // number so they can follow the parcel from their own Track screen.
    if (patch.status === 'SHIPPED' && (order.trackingCourier || order.trackingNumber) && Array.isArray(order.trackSteps)) {
      const shipStep = order.trackSteps.find((s2) => s2.label.toLowerCase().includes('ship'));
      if (shipStep) {
        const bits = [order.trackingCourier, order.trackingNumber].filter(Boolean).join(' · ');
        shipStep.sub = bits ? `Dispatched · ${bits}` : shipStep.sub;
        order.markModified('trackSteps');
      }
    }
    if (patch.assignedEmployee !== undefined) order.assignedEmployee = patch.assignedEmployee || undefined;
    if (patch.etaDate !== undefined) order.etaDate = patch.etaDate || undefined;
    if (patch.mfr !== undefined) order.manufacturer = patch.mfr;
    if (patch.qc !== undefined) order.qcResult = patch.qc;
    if (patch.pay !== undefined) {
      order.adminPayStatus = patch.pay;
      // Keep the CUSTOMER-facing payment fields in step so the admin's "Record
      // payment" actually reflects everywhere (customer tracker, payment gate,
      // the paid flag). Previously only adminPayStatus changed, so recording a
      // payment looked like it did nothing.
      if (patch.pay === 'COMPLETED') { order.paymentStatus = 'paid'; order.paymentDate = order.paymentDate || new Date().toISOString(); }
      else if (patch.pay === 'PARTIAL') { order.paymentStatus = 'partial'; order.paymentDate = order.paymentDate || new Date().toISOString(); }
      // Mark the tracker's Payment step done + advance the customer status.
      order.status = deriveCustomerStatus(order.adminStatus, order.persona);
      recomputeTrackSteps(order);
      // Offline recordings never hit the app's own pay endpoint, so tick the
      // customer's Payment step here too — otherwise the customer keeps seeing
      // "payment pending" after the admin recorded their bank/cash payment.
      if (patch.pay === 'COMPLETED' && Array.isArray(order.trackSteps)) {
        const payIdx = order.trackSteps.findIndex((s2) => s2.label.toLowerCase().includes('payment'));
        if (payIdx >= 0) {
          const when = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
          order.trackSteps = order.trackSteps.map((s2, i) => {
            if (i < payIdx) return { ...s2, status: 'done' };
            if (i === payIdx) return { ...s2, sub: `Payment received · ${when}`, status: 'done' };
            if (i === payIdx + 1 && s2.status === 'pending') return { ...s2, status: 'active' };
            return s2;
          });
          order.markModified('trackSteps');
        }
      }
    }
    if (patch.notes !== undefined) order.notes = patch.notes;
    if (patch.total !== undefined) order.total = patch.total;
    if (patch.quoteAmount !== undefined) order.quoteAmount = patch.quoteAmount;
    await order.save();
    const populated = await order.populate('userId', 'name email phone orgName');
    return toAdminOrder(populated.toObject());
  },
  async listOrdersByCustomer(customerId) {
    const docs = await MongoOrder.find({ userId: customerId }).sort({ createdAt: -1 }).lean();
    return docs.map(toAdminOrder);
  },

  // ---- order documents (invoice / quotation / billing / design refs) ----
  async addOrderDocument(id, { name, kind, dataUrl }) {
    const order = await MongoOrder.findOne({ seq: id });
    if (!order) return null;
    order.documents.push({ name, kind: kind || 'OTHER', dataUrl, uploadedBy: 'admin' });
    await order.save();
    const populated = await order.populate('userId', 'name email phone orgName');
    return toAdminOrder(populated.toObject());
  },
  async deleteOrderDocument(id, docId) {
    const order = await MongoOrder.findOne({ seq: id });
    if (!order) return null;
    order.documents = order.documents.filter((d) => String(d._id) !== String(docId));
    await order.save();
    const populated = await order.populate('userId', 'name email phone orgName');
    return toAdminOrder(populated.toObject());
  },
  // One-click: build an invoice PDF from the order's own data and attach it as a
  // GENERATED, hidden-from-customer draft. The admin reviews it, then "sends".
  async generateInvoice(id) {
    const order = await MongoOrder.findOne({ seq: id });
    if (!order) return null;
    const populated = await order.populate('userId', 'name email phone orgName');
    const admin = toAdminOrder(populated.toObject());
    // Derive subtotal/tax the same way the admin Order view shows them (tax is
    // 18% inclusive of the line subtotal; service fee is added on top).
    const lineSubtotal = (admin.lines || []).reduce((sum, l) => sum + (l.qty || 0) * (l.unit || 0), 0);
    const grand = admin.total || admin.quoteAmount || lineSubtotal + (admin.serviceFee || 0);
    const taxable = Math.max(0, grand - (admin.serviceFee || 0));
    const tax = Math.round(taxable - taxable / 1.18);
    const subtotal = taxable - tax;
    const c = (data.settings && data.settings.company) || {};
    const company = {
      name: c.name || c.legalName || 'Garm',
      addressLines: [c.addressLine1, c.addressLine2, [c.city, c.state, c.pincode].filter(Boolean).join(' ')].filter(Boolean),
      gstin: c.gstin || c.gstNumber || '',
      email: c.email || '',
      phone: c.phone || '',
      bankLine: c.bankAccountHolder ? `Bank: ${c.bankAccountHolder} • A/C ${c.accountNumber || ''} • IFSC ${c.ifscCode || ''}` : '',
    };
    const inv = buildInvoicePdf({ ...admin, subtotal, tax, deliveryDate: admin.etaDate,
      customer: { name: admin.cust, phone: admin.contactPhone, email: admin.email },
      delivery: { address: admin.deliveryAddress, city: admin.deliveryCity, pin: admin.deliveryPin } }, company);
    // Replace any earlier generated-but-unsent invoice so we don't pile up drafts.
    order.documents = order.documents.filter((d) => !(d.generated === true && d.visible === false));
    order.documents.push({ name: inv.name, kind: 'INVOICE', dataUrl: inv.dataUrl, uploadedBy: 'admin', generated: true, visible: false });
    await order.save();
    const pop2 = await order.populate('userId', 'name email phone orgName');
    return toAdminOrder(pop2.toObject());
  },
  async setDocumentVisibility(id, docId, visible) {
    const order = await MongoOrder.findOne({ seq: id });
    if (!order) return null;
    const doc = order.documents.find((d) => String(d._id) === String(docId));
    if (!doc) return null;
    doc.visible = !!visible;
    order.markModified('documents');
    await order.save();
    const populated = await order.populate('userId', 'name email phone orgName');
    return toAdminOrder(populated.toObject());
  },

  // ---- Garm App customers (every account that signed in / registered) ----
  async listAppCustomers() {
    const users = await MongoUser.find({}).sort({ createdAt: -1 }).lean();
    const counts = await MongoOrder.aggregate([
      { $group: { _id: '$userId', orders: { $sum: 1 }, spend: { $sum: { $ifNull: ['$total', 0] } }, lastOrderAt: { $max: '$createdAt' } } },
    ]);
    const byUser = new Map(counts.map((c) => [String(c._id), c]));
    return users
      .filter((u) => u.email !== 'walkin@garm.local')
      .map((u) => {
        const c = byUser.get(String(u._id));
        return {
          id: String(u._id),
          name: u.name || '(not onboarded yet)',
          phone: u.phone || '',
          email: u.email || '',
          accountType: u.accountType === 'organisation' ? 'B2B' : 'B2C',
          orgName: u.orgName || null,
          orgType: u.orgType || null,
          onboarded: !!u.onboardingComplete,
          registeredAt: u.createdAt ? new Date(u.createdAt).toISOString().slice(0, 10) : null,
          orders: c ? c.orders : 0,
          spend: c ? c.spend : 0,
          lastOrderAt: c && c.lastOrderAt ? new Date(c.lastOrderAt).toISOString().slice(0, 10) : null,
        };
      });
  },

  // ---- users (identity + role-based access control) ----
  listUsers() { return data.users; },
  getUser(id) { return data.users.find((u) => u.id === id); },
  getUserByEmail(email) {
    const clean = String(email || '').trim().toLowerCase();
    if (!clean) return undefined;
    // Null-safe: a user record with a missing email must never crash lookup
    // (previously `u.email.toLowerCase()` threw on a null email, breaking login
    // for EVERYONE, not just that record).
    return data.users.find((u) => String(u.email || '').trim().toLowerCase() === clean);
  },
  // Ensure a Super Admin exists for the given email (set via SUPER_ADMIN_EMAIL).
  // Lets you sign into the deployed admin portal with YOUR OWN email instead of
  // the built-in demo address (haneef@garm.com), whose inbox you don't control.
  // Idempotent: promotes an existing user or creates one; runs on every boot.
  ensureSuperAdmin(email) {
    const clean = String(email || '').trim().toLowerCase();
    if (!clean || !clean.includes('@')) return null;
    let user = this.getUserByEmail(clean);
    if (user) {
      if (user.role !== 'Super Admin' || user.status !== 'Active') {
        user.role = 'Super Admin'; user.status = 'Active'; persist();
      }
      return user;
    }
    const id = data.meta.nextUserId++;
    user = { id, name: 'Owner', email: clean, role: 'Super Admin', status: 'Active', lastLogin: null };
    data.users.push(user);
    persist();
    return user;
  },
  createUser(input) {
    if (this.getUserByEmail(input.email)) return { error: 'A user with this email already exists' };
    const id = data.meta.nextUserId++;
    const user = {
      id,
      name: input.name || input.email,
      email: String(input.email || '').trim().toLowerCase(),
      role: input.role || 'View-Only',
      status: input.status || 'Invited',
      lastLogin: null,
    };
    data.users.push(user);
    persist();
    return user;
  },
  updateUser(id, input) {
    const user = data.users.find((u) => u.id === id);
    if (!user) return null;
    Object.assign(user, {
      name: input.name ?? user.name,
      role: input.role ?? user.role,
      status: input.status ?? user.status,
    });
    persist();
    return user;
  },
  touchUserLogin(id) {
    const user = data.users.find((u) => u.id === id);
    if (!user) return null;
    user.lastLogin = new Date().toISOString();
    persist();
    return user;
  },
  deleteUser(id) {
    data.users = data.users.filter((u) => u.id !== id);
    persist();
    return { ok: true };
  },

  // ---- customers (Garm App: individuals + organisations) ----
  // Separate from `users` above — these are the people placing orders in the
  // Garm App, not admin employees. Identity-locked: accountType can only be
  // set once per customer, enforced in updateCustomerProfile below.
  listCustomers() { return data.customers; },
  getCustomer(id) { return data.customers.find((c) => c.id === id); },
  getCustomerByIdentity(identity) {
    const clean = String(identity || '').trim().toLowerCase();
    return data.customers.find((c) => (c.phone && c.phone === clean) || (c.email && c.email.toLowerCase() === clean));
  },
  createCustomer({ phone, email }) {
    const id = data.meta.nextCustomerId++;
    const customer = {
      id,
      name: phone || email || 'Garm Customer',
      phone: phone || null,
      email: email || null,
      accountType: null,
      orgName: null, orgType: null, orgBoard: null, designation: null,
      twoFAEnabled: false, onboardingComplete: false,
      addresses: [], paymentMethods: [],
      createdAt: new Date().toISOString(),
    };
    data.customers.push(customer);
    persist();
    return customer;
  },
  updateCustomerProfile(id, patch) {
    const c = data.customers.find((x) => x.id === id);
    if (!c) return null;
    if (patch.accountType !== undefined && c.accountType && patch.accountType !== c.accountType) {
      return { error: 'Account type is locked to ' + c.accountType + ' and cannot be changed' };
    }
    Object.assign(c, {
      name: patch.name ?? c.name,
      accountType: c.accountType ?? patch.accountType ?? c.accountType,
      orgName: patch.orgName ?? c.orgName,
      orgType: patch.orgType ?? c.orgType,
      orgBoard: patch.orgBoard ?? c.orgBoard,
      designation: patch.designation ?? c.designation,
      twoFAEnabled: patch.twoFAEnabled ?? c.twoFAEnabled,
      onboardingComplete: patch.onboardingComplete ?? c.onboardingComplete,
    });
    persist();
    return c;
  },
  addCustomerAddress(id, addr) {
    const c = data.customers.find((x) => x.id === id);
    if (!c) return null;
    const address = { _id: 'addr_' + (data.meta.nextAddrSeq++), ...addr };
    if (address.isDefault) c.addresses.forEach((a) => { a.isDefault = false; });
    c.addresses.push(address);
    persist();
    return c.addresses;
  },
  updateCustomerAddress(id, addrId, patch) {
    const c = data.customers.find((x) => x.id === id);
    if (!c) return null;
    const addr = c.addresses.find((a) => a._id === addrId);
    if (!addr) return null;
    if (patch.isDefault) c.addresses.forEach((a) => { a.isDefault = false; });
    Object.assign(addr, patch);
    persist();
    return c.addresses;
  },
  deleteCustomerAddress(id, addrId) {
    const c = data.customers.find((x) => x.id === id);
    if (!c) return null;
    c.addresses = c.addresses.filter((a) => a._id !== addrId);
    persist();
    return c.addresses;
  },
  addCustomerPayment(id, pm) {
    const c = data.customers.find((x) => x.id === id);
    if (!c) return null;
    const method = { _id: 'pm_' + (data.meta.nextPayMethodSeq++), ...pm };
    if (method.isDefault) c.paymentMethods.forEach((m) => { m.isDefault = false; });
    c.paymentMethods.push(method);
    persist();
    return c.paymentMethods;
  },
  deleteCustomerPayment(id, pmId) {
    const c = data.customers.find((x) => x.id === id);
    if (!c) return null;
    c.paymentMethods = c.paymentMethods.filter((m) => m._id !== pmId);
    persist();
    return c.paymentMethods;
  },
  setDefaultPayment(id, pmId) {
    const c = data.customers.find((x) => x.id === id);
    if (!c) return null;
    if (!c.paymentMethods.some((m) => m._id === pmId)) return null;
    c.paymentMethods.forEach((m) => { m.isDefault = m._id === pmId; });
    persist();
    return c.paymentMethods;
  },

  // ---- OTP + sessions (Garm App customer auth AND admin employee auth share
  // this same mechanism, distinguished by `purpose` so a person who happens
  // to be both a customer and an employee never gets codes/sessions crossed.
  // Dev-mode: OTP is logged + returned by the route layer as `devCode` since
  // no Twilio/Gmail credentials exist in this environment — see server/README.md.
  // Codes and session tokens are stored as one-way hashes, never in plaintext,
  // so a stolen db.json can't be replayed as a valid login. ----
  createOtp(identity, mode, purpose = 'customer') {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const clean = String(identity || '').trim().toLowerCase();
    data.otps = data.otps.filter((o) => !(o.identity === clean && o.purpose === purpose));
    const rec = { identity: clean, mode, purpose, codeHash: hashSecret(code), attempts: 0, expiresAt: Date.now() + 5 * 60 * 1000 };
    data.otps.push(rec);
    persist();
    // `code` is returned here (never persisted) purely so the route layer can
    // decide whether to echo it back as `devCode` — gated by OTP_DEV_MODE.
    return { identity: clean, mode, purpose, code, expiresAt: rec.expiresAt };
  },
  verifyOtp(identity, code, purpose = 'customer') {
    const clean = String(identity || '').trim().toLowerCase();
    const rec = data.otps.find((o) => o.identity === clean && o.purpose === purpose);
    if (!rec) return { error: 'No OTP requested for this identity — request a new one' };
    if (Date.now() > rec.expiresAt) {
      data.otps = data.otps.filter((o) => o !== rec);
      persist();
      return { error: 'OTP expired — request a new one' };
    }
    if (rec.attempts >= 5) {
      data.otps = data.otps.filter((o) => o !== rec);
      persist();
      return { error: 'Too many incorrect attempts — request a new code' };
    }
    if (!timingSafeEqualStr(hashSecret(String(code || '').trim()), rec.codeHash)) {
      rec.attempts += 1;
      persist();
      return { error: 'Incorrect code' };
    }
    data.otps = data.otps.filter((o) => o !== rec);
    persist();
    return { ok: true, mode: rec.mode };
  },
  createSession(customerId) {
    const token = randomToken();
    data.sessions.push({ tokenHash: hashSecret(token), customerId, createdAt: Date.now(), expiresAt: Date.now() + 30 * 24 * 3600 * 1000 });
    persist();
    return token; // raw token returned to the caller once — never stored raw
  },
  getSessionCustomer(token) {
    if (!token) return null;
    const hash = hashSecret(token);
    const sess = data.sessions.find((s) => s.tokenHash === hash);
    if (!sess) return null;
    if (Date.now() > sess.expiresAt) return null;
    return data.customers.find((c) => c.id === sess.customerId) || null;
  },
  destroySession(token) {
    if (!token) return;
    const hash = hashSecret(token);
    data.sessions = data.sessions.filter((s) => s.tokenHash !== hash);
    persist();
  },

  // ---- Admin session tokens (issued after a real OTP verification against
  // the `users` collection — see the /api/auth/admin/* routes) ----
  createAdminSession(userId) {
    const token = randomToken();
    data.adminSessions.push({ tokenHash: hashSecret(token), userId, createdAt: Date.now(), expiresAt: Date.now() + 12 * 3600 * 1000 });
    persist();
    return token;
  },
  getSessionUser(token) {
    if (!token) return null;
    const hash = hashSecret(token);
    const sess = data.adminSessions.find((s) => s.tokenHash === hash);
    if (!sess) return null;
    if (Date.now() > sess.expiresAt) return null;
    return data.users.find((u) => u.id === sess.userId) || null;
  },
  destroyAdminSession(token) {
    if (!token) return;
    const hash = hashSecret(token);
    data.adminSessions = data.adminSessions.filter((s) => s.tokenHash !== hash);
    persist();
  },

  // ---- quotes (MongoDB — same collection FAB/backend's Order-detail "quote"
  // endpoint reads; see server/mongo.js. `orderId` here is always the admin's
  // numeric order `seq`, resolved to the real Mongo _id internally, so index.js
  // callers don't need to change. getQuote/setQuoteStatus are only reachable
  // today from the legacy /api/garm/quotes/* routes, which the real Garm App
  // no longer calls (it talks to its own backend on port 4000) — kept working
  // on a best-effort basis rather than fully reworked. ----
  async listQuotes() {
    const docs = await MongoQuote.find().lean();
    const orders = await MongoOrder.find({ _id: { $in: docs.map((q) => q.orderId) } }, '_id seq').lean();
    const seqByMongoId = new Map(orders.map((o) => [String(o._id), o.seq]));
    return docs.map((q) => toAdminQuote(q, seqByMongoId.get(String(q.orderId))));
  },
  async listQuotesByOrderIds(orderIds) {
    const orders = await MongoOrder.find({ seq: { $in: orderIds } }, '_id seq').lean();
    const seqByMongoId = new Map(orders.map((o) => [String(o._id), o.seq]));
    const docs = await MongoQuote.find({ orderId: { $in: orders.map((o) => o._id) } }).lean();
    return docs.map((q) => toAdminQuote(q, seqByMongoId.get(String(q.orderId))));
  },
  async getQuote(id) {
    const doc = await MongoQuote.findById(id).lean().catch(() => null);
    if (!doc) return null;
    const order = await MongoOrder.findById(doc.orderId, 'seq').lean();
    return toAdminQuote(doc, order?.seq);
  },
  async upsertQuoteForOrder(orderId, { amount, breakdown, validDays = 7 }) {
    const order = await MongoOrder.findOne({ seq: orderId });
    if (!order) return null;
    const validUntil = new Date(Date.now() + validDays * 86400000);
    let quote = await MongoQuote.findOne({ orderId: order._id, status: 'pending' });
    if (quote) {
      quote.amount = amount;
      quote.breakdown = breakdown || quote.breakdown;
      quote.validUntil = validUntil;
      await quote.save();
    } else {
      quote = await MongoQuote.create({
        orderId: order._id,
        userId: order.userId,
        amount,
        breakdown: breakdown || [{ label: 'Order total', amount }],
        validUntil,
      });
    }
    return toAdminQuote(quote.toObject(), order.seq);
  },
  async setQuoteStatus(id, status, rejectionNote) {
    const quote = await MongoQuote.findById(id).catch(() => null);
    if (!quote) return null;
    quote.status = status;
    if (rejectionNote !== undefined) quote.rejectionNote = rejectionNote;
    await quote.save();
    const order = await MongoOrder.findById(quote.orderId, 'seq').lean();
    return toAdminQuote(quote.toObject(), order?.seq);
  },

  // ---- Track order stages — the customer-facing label/sub-text shown per
  // order status in the Garm App's tracking screen. Used to be hardcoded
  // server-side with no admin visibility at all; now editable (label/sub
  // only — `key` stays fixed since it's the order.status value each stage
  // maps to, and reordering/removing a stage would break the progress bar). ----
  listTrackStages() { return data.trackStages; },
  updateTrackStages(patchList) {
    if (!Array.isArray(patchList)) return { error: 'Expected an array of stages' };
    for (const patch of patchList) {
      const stage = data.trackStages.find((s) => s.key === patch.key);
      if (!stage) continue;
      if (patch.label !== undefined) stage.label = String(patch.label);
      if (patch.sub !== undefined) stage.sub = String(patch.sub);
    }
    persist();
    return data.trackStages;
  },

  // ---- App settings — Feature Toggles + Company/billing details. Both used
  // to be local-only mock state in the admin UI with zero persistence; now a
  // real settings collection, with sensitive company/banking fields
  // encrypted at rest (see COMPANY_FIELDS above). ----
  getSettings() { return data.settings; },
  updateFeatureToggle(key, on) {
    const f = data.settings.features.find((x) => x.key === key);
    if (!f) return { error: 'Unknown feature: ' + key };
    f.on = !!on;
    persist();
    return data.settings.features;
  },
  updateCompanyDetails(patch) {
    Object.assign(data.settings.company, patch);
    persist();
    return data.settings.company;
  },

  // ---- Procurement coordinator — the "Your procurement manager" card shown
  // in the Garm App. Contact details (phone/WhatsApp/email) are company-wide
  // and NEVER change per order; only the displayed name changes when an order
  // is assigned to a specific employee (order.assignedEmployee). ----
  getCoordinator() { return data.settings.coordinator; },
  updateCoordinator(patch) {
    data.settings.coordinator = { ...data.settings.coordinator, ...patch };
    persist();
    return data.settings.coordinator;
  },

  // ---- Garm App order-form configuration (which sections customers see in
  // the custom order flow — style, materials, sizes, references, preview) ----
  getOrderForm() { return data.settings.orderForm; },
  updateOrderForm(patch) {
    data.settings.orderForm = { ...data.settings.orderForm, ...patch };
    persist();
    return data.settings.orderForm;
  },

  // ---- service-fee schedule (applied in the app + shown in all pay details) ----
  getServiceFee() { return data.settings.serviceFee; },
  updateServiceFee(patch) {
    const clean = {};
    for (const k of ['b2cPercent', 'b2cPerPiece', 'b2bPercent', 'bulkQtyThreshold', 'bulkPercent', 'minFee', 'surplusDiscountPercent']) {
      if (patch[k] !== undefined) clean[k] = Math.max(0, Number(patch[k]) || 0);
    }
    // Surplus discount is a percentage — clamp to a sane 0–90.
    if (clean.surplusDiscountPercent !== undefined) clean.surplusDiscountPercent = Math.min(90, clean.surplusDiscountPercent);
    // Advance % must leave a real balance — clamp to 1–99.
    if (patch.orgAdvancePercent !== undefined) {
      clean.orgAdvancePercent = Math.min(99, Math.max(1, Number(patch.orgAdvancePercent) || 30));
    }
    data.settings.serviceFee = { ...data.settings.serviceFee, ...clean };
    persist();
    return data.settings.serviceFee;
  },
};

export function resetToSeed() {
  data = buildSeed();
  persist();
  return data;
}
