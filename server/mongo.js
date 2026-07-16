// Connects the admin portal directly to the SAME MongoDB database used by
// the Garm App's real backend (../../Latest version of FAB/backend). Until
// this existed, the two systems had zero visibility into each other: orders
// placed in the Garm App went into MongoDB, while this admin portal only
// ever read its own local server/db.json — so new orders never appeared here.
//
// Schemas below mirror Latest version of FAB/backend/src/models/{Order,Quote,User}.ts
// field-for-field, plus the admin-only operational fields (adminStatus,
// manufacturer, qcResult, adminPayStatus, total, lines, seq) that were added
// additively to that same Order model. If either side's schema changes,
// update both files — they must describe the same collections.
//
// Categories/products/employees/manufacturers/settings/track-stages/customer-
// OTP-sessions stay on the local file store (server/db.json) for now — this
// pass only moves Orders + Quotes, since that's the data the two apps both
// need to agree on. See server/README.md for the fuller picture.

import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/garm';

// Atomic order sequence — MUST use the exact same 'counters' collection + key
// ('orderSeq') the Garm App backend uses (Latest version of FAB/backend/src/
// models/Order.ts), so an order logged manually here and an order placed in
// the app never collide on `seq` or the derived `FL-<n>` orderRef.
const CounterSchema = new mongoose.Schema({ _id: String, value: { type: Number, default: 0 } });
const Counter = mongoose.models.Counter || mongoose.model('Counter', CounterSchema, 'counters');
export async function nextOrderSeq() {
  const doc = await Counter.findByIdAndUpdate(
    'orderSeq',
    { $inc: { value: 1 } },
    { upsert: true, new: true }
  );
  return doc.value;
}

const SizeEntrySchema = new mongoose.Schema({ label: String, qty: Number }, { _id: false });
const ColorEntrySchema = new mongoose.Schema({ hex: String, pantone: String, label: String, position: String }, { _id: false });
const AccessoryItemSchema = new mongoose.Schema({ categoryId: String, categoryLabel: String, itemName: String, qty: Number }, { _id: false });
const TrackStepSchema = new mongoose.Schema({ label: String, sub: String, status: String, completedAt: Date }, { _id: false });
const OrderLineSchema = new mongoose.Schema({ p: String, size: String, color: String, qty: Number, unit: Number }, { _id: false });
const OrderDocumentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  kind: { type: String, enum: ['INVOICE', 'QUOTATION', 'BILLING', 'DESIGN', 'OTHER'], default: 'OTHER' },
  dataUrl: { type: String, required: true },
  uploadedBy: { type: String, enum: ['admin', 'customer'], required: true },
  // Generated (vs uploaded) invoices; and whether the customer can see it yet.
  // visible defaults true so every existing/uploaded doc stays visible; a
  // GENERATED invoice starts hidden (draft) until the admin clicks "Send".
  generated: { type: Boolean, default: false },
  visible: { type: Boolean, default: true },
}, { timestamps: { createdAt: true, updatedAt: false } });

const OrderSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // sparse so manual/legacy orders without an orderRef don't collide on a
    // null value — MUST match the Garm App backend's Order schema (unique + sparse).
    orderRef: { type: String, unique: true, sparse: true },
    persona: { type: String, enum: ['organisation', 'individual'], required: true },
    isAccessoryOrder: { type: Boolean, default: false },

    orgType: String, orgName: String, service: String, serviceLabel: String,
    garmentType: String, fabric: String, gsm: String, weave: String,
    fabricSource: { type: String, enum: ['fresh', 'surplus'] },

    qty: { type: Number, default: 0 },
    sizes: { type: [SizeEntrySchema], default: [] },
    colors: { type: [ColorEntrySchema], default: [] },
    accessoryItems: { type: [AccessoryItemSchema], default: [] },

    stitching: String,
    packaging: String,

    deliveryAddress: String,
    deliveryCity: String,
    deliveryPin: String,

    contactName: String,
    contactPhone: String,
    contactEmail: String,

    status: {
      type: String,
      enum: ['Draft', 'Quote pending', 'Order placed', 'Order confirmed', 'In production', 'Quality check', 'Shipped', 'Delivered', 'Completed', 'Cancelled'],
      default: 'Quote pending',
    },
    trackSteps: { type: [TrackStepSchema], default: [] },
    etaDate: String,

    quoteAmount: Number,
    serviceFee: { type: Number, default: 0 },
    quoteApprovedAt: Date,
    confirmedAt: Date,
    paymentStatus: { type: String, enum: ['unpaid', 'partial', 'paid'], default: 'unpaid' },
    paymentMode: String,
    paymentDate: Date,
    paymentReference: String,

    coordinatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    notes: String,

    // ── Admin-portal operational fields (see Order.ts on the Garm App backend) ──
    seq: { type: Number, unique: true, sparse: true },
    adminStatus: {
      type: String,
      enum: ['NEW', 'CONFIRMED', 'ASSIGNED', 'IN_PROGRESS', 'QC_READY', 'QC_APPROVED', 'INVOICED', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED'],
      default: 'NEW',
    },
    assignedEmployee: String,
    manufacturer: { type: String, default: '—' },
    qcResult: { type: String, enum: ['PENDING', 'PASSED', 'FAILED', 'REWORK', 'N/A'], default: 'PENDING' },
    adminPayStatus: { type: String, enum: ['PENDING', 'PARTIAL', 'COMPLETED'], default: 'PENDING' },
    total: { type: Number, default: 0 },
    lines: { type: [OrderLineSchema], default: [] },
    documents: { type: [OrderDocumentSchema], default: [] },
    trackingCourier: { type: String },
    trackingNumber: { type: String },
    // Customer rating (1–5) + feedback, submitted from the Garm App once delivered.
    rating: { type: Number, min: 1, max: 5 },
    ratingFeedback: { type: String },
    ratedAt: { type: Date },
  },
  { timestamps: true, collection: 'orders' }
);

const QuoteSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    breakdown: [{ label: String, amount: Number }],
    validUntil: { type: Date, required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'expired'], default: 'pending' },
    rejectionNote: String,
    approvedAt: Date,
    rejectedAt: Date,
  },
  { timestamps: true, collection: 'quotes' }
);

const AddressSchema = new mongoose.Schema({ label: String, line1: String, line2: String, city: String, state: String, pin: String, isDefault: Boolean });
const PaymentMethodSchema = new mongoose.Schema({ type: String, bankName: String, accountNumber: String, ifsc: String, accountHolder: String, upiId: String, upiProvider: String, isDefault: Boolean });
const UserSchema = new mongoose.Schema(
  {
    phone: String,
    email: String,
    name: String,
    accountType: { type: String, enum: ['organisation', 'personal'], default: 'personal' },
    orgName: String,
    orgType: String,
    orgBoard: String,
    designation: String,
    avatarUrl: String,
    twoFAEnabled: Boolean,
    addresses: { type: [AddressSchema], default: [] },
    paymentMethods: { type: [PaymentMethodSchema], default: [] },
    onboardingComplete: Boolean,
  },
  { timestamps: true, collection: 'users' }
);

// Support tickets — raised from the Garm App (customer routes on the FAB
// backend), worked here in the admin Support page. Same MongoDB the orders use.
const TicketMessageSchema = new mongoose.Schema({
  from: { type: String, enum: ['customer', 'admin'], required: true },
  authorName: String,
  body: String,
  at: { type: Date, default: Date.now },
}, { _id: false });
const SupportTicketSchema = new mongoose.Schema(
  {
    ref: { type: String, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    customerName: String,
    customerEmail: String,
    customerPhone: String,
    category: String,
    subject: String,
    orderRef: String,
    type: { type: String, enum: ['general', 'return'], default: 'general' },
    images: { type: [String], default: [] },
    returnStatus: { type: String, enum: ['NONE', 'REQUESTED', 'APPROVED', 'DECLINED'], default: 'NONE' },
    status: { type: String, enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'], default: 'OPEN' },
    priority: { type: String, enum: ['LOW', 'NORMAL', 'HIGH'], default: 'NORMAL' },
    assignedTo: { type: String, default: '' },
    messages: { type: [TicketMessageSchema], default: [] },
  },
  { timestamps: true, collection: 'supporttickets' }
);

// Customer sign-in log — one row per OTP verification, written by the Garm App
// backend (Latest version of FAB/backend). Powers the admin "Customer Log".
const LoginEventSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: String, phone: String, email: String,
    mode: { type: String, enum: ['phone', 'email'] },
    isNewUser: { type: Boolean, default: false },
    at: { type: Date, default: Date.now },
  },
  { collection: 'loginevents' }
);

export const MongoOrder = mongoose.models.Order || mongoose.model('Order', OrderSchema);
export const MongoQuote = mongoose.models.Quote || mongoose.model('Quote', QuoteSchema);
export const MongoUser = mongoose.models.User || mongoose.model('User', UserSchema);
export const MongoTicket = mongoose.models.SupportTicket || mongoose.model('SupportTicket', SupportTicketSchema);
export const MongoLoginEvent = mongoose.models.LoginEvent || mongoose.model('LoginEvent', LoginEventSchema);

let connectPromise = null;
let connected = false;
export function isMongoConnected() { return connected; }

export function connectMongo() {
  if (!connectPromise) {
    connectPromise = mongoose.connect(MONGODB_URI)
      .then(async () => {
        connected = true;
        console.log(`[mongo] connected to ${MONGODB_URI} — orders now shared with the Garm App backend`);
        // One-time index reconciliation: an earlier build shipped `orderRef`
        // as a NON-sparse unique index, which conflicts with the Garm App
        // backend's sparse one and rejects a second null-orderRef order with
        // E11000. If the stale non-sparse index is present, drop it and
        // recreate it sparse. Idempotent + targeted (only touches orderRef_1).
        try {
          const existing = await MongoOrder.collection.indexes();
          const ref = existing.find((i) => i.name === 'orderRef_1');
          if (ref && !ref.sparse) {
            await MongoOrder.collection.dropIndex('orderRef_1').catch(() => {});
            await MongoOrder.collection.createIndex({ orderRef: 1 }, { unique: true, sparse: true }).catch(() => {});
            console.log('[mongo] migrated orderRef index → unique + sparse');
          }
        } catch { /* non-fatal — index may not exist yet on a fresh DB */ }
      })
      .catch((err) => {
        connected = false;
        connectPromise = null; // allow a retry on the next call
        console.error(`[mongo] connection failed (${MONGODB_URI}): ${err.message}`);
        console.error('[mongo] Orders/Quotes routes will fail until MongoDB is reachable. Make sure the Garm App backend\'s MongoDB is running (see Latest version of FAB/backend/README.md) and that MONGODB_URI matches its .env.');
        throw err;
      });
  }
  return connectPromise;
}

// A stable placeholder customer for orders logged manually by the admin team
// (phone/walk-in orders with no Garm App account) — Order.userId is a
// required foreign key on the shared schema, so manual orders need *some*
// User document to point at rather than loosening that constraint.
const WALKIN_EMAIL = 'walkin@garm-admin.local';
export async function getOrCreateWalkInUser() {
  let user = await MongoUser.findOne({ email: WALKIN_EMAIL });
  if (!user) {
    user = await MongoUser.create({ email: WALKIN_EMAIL, name: 'Walk-in Customer', accountType: 'personal', onboardingComplete: true });
  }
  return user;
}
