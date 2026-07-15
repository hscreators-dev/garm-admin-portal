import { API_BASE } from './config';
import type { Order } from '../data/mockData';

export type Audience = 'B2C' | 'B2B';

export interface Category {
  id: number;
  audience: Audience;
  name: string;
  image: string | null;
  description: string;
}

// GARMENT products carry the full garment spec (fabric/GSM/sizes/stitching);
// ACCESSORY covers promo items (mugs, pens, banners…); OTHER for anything else.
export type ProductType = 'GARMENT' | 'ACCESSORY' | 'OTHER';

// Colours are always swatches ({label, hex}) — never bare text — so both the
// admin portal and the Garm App can render the real colour.
export interface ProductColor { label: string; hex: string; }

// Admin-defined spec fields for accessory products ("Material", "Finish",
// "Print method"…) — the Garm App renders these instead of its built-in
// defaults when present.
export interface ProductSpecField { label: string; options: string[]; hint?: string; }

export interface TicketMessage { from: 'customer' | 'admin'; authorName: string; body: string; at: string; }
export interface SupportTicket {
  _id: string;
  ref: string;
  userId?: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  category: string;
  subject: string;
  orderRef?: string;
  type: 'general' | 'return';
  images?: string[];
  returnStatus: 'NONE' | 'REQUESTED' | 'APPROVED' | 'DECLINED';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  priority: 'LOW' | 'NORMAL' | 'HIGH';
  assignedTo: string;
  messages: TicketMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: number;
  audience: Audience;
  name: string;
  categoryId: number;
  productType: ProductType;
  inStock: boolean;
  price: number;
  sizes: string[];
  colors: ProductColor[];
  specFields?: ProductSpecField[];
  moq: number;
  status: 'ACTIVE' | 'INACTIVE';
  image: string | null;
  // Spec/config fields matching what the Garm App shows per catalog item.
  description: string;
  gallery: string[];
  fabricOptions: string[];
  gsmOptions: string[];
  // Garments: the Style list + Weave options shown by the Garm App's
  // configurator (pre-filled from the app's built-in lists at seed time).
  styles?: string[];
  weaveOptions?: string[];
  stitchingOptions: string[];
  packagingOptions: string[];
  allowsLogoUpload: boolean;
}

export interface TrackStage {
  key: string;
  label: string;
  sub: string;
  // Individuals (B2C) skip in-house QC entirely — orgOnly stages (Quality
  // check / Quality approved / Invoiced) only appear on Organization orders.
  orgOnly?: boolean;
  // b2cOnly stages (Order confirmed) only appear on Individual orders.
  b2cOnly?: boolean;
}

// "Your procurement manager" card in the Garm App — company-wide contact
// details; the displayed name is overridden per order by assignedEmployee.
export interface CoordinatorSettings {
  name: string;
  role: string;
  phone: string;
  whatsapp: string;
  email: string;
}

export interface FeatureToggle {
  key: string;
  name: string;
  desc: string;
  on: boolean;
}

export interface CompanySettings {
  gstNumber: string;
  placeOfSupply: string;
  bankAccountHolder: string;
  accountNumber: string;
  ifscCode: string;
  smtpEmail: string;
  paymentGatewayKey: string;
  paymentTerms: string;
}

// Which sections of the Garm App's custom order flow customers see —
// controlled here, read live by the app.
export interface OrderFormConfig {
  style: boolean;
  materials: boolean;
  sizes: boolean;
  referenceUpload: boolean;
  livePreview: boolean;
}

// Service fee applied to every order — % by customer type, bulk slab, ₹ floor.
export interface ServiceFeeConfig {
  b2cPercent: number;
  b2cPerPiece: number; // ₹ per piece, Individuals — handling cost per piece
  b2bPercent: number;
  bulkQtyThreshold: number;
  bulkPercent: number;
  minFee: number;
  surplusDiscountPercent: number; // % off garment rate for Surplus (mill leftover) fabric
  orgAdvancePercent: number; // % advance organisations pay before production (balance after QC)
}

export interface AppSettings {
  features: FeatureToggle[];
  company: CompanySettings;
  coordinator: CoordinatorSettings;
  orderForm: OrderFormConfig;
  serviceFee: ServiceFeeConfig;
}

export interface ApiUser {
  id: number;
  name: string;
  email: string;
  role: 'Super Admin' | 'Operations Manager' | 'QC Supervisor' | 'Finance Manager' | 'Warehouse Manager' | 'View-Only';
  status: 'Active' | 'Invited' | 'Disabled';
  lastLogin: string | null;
}

// ─── Session token (OTP-verified admin login) ─────────────────────────────────
const TOKEN_KEY = 'garm_admin_token';
export const adminToken = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const token = adminToken.get();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, {
    headers,
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    if (res.status === 401) adminToken.clear();
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

// Individuals (B2C) and Organizations (B2B) are separate catalogs end to
// end — separate backend tables (server/store.js), separate routes here.
// Every catalog call is scoped to one audience; there is no call that reads
// or writes across both at once.
const audiencePath = (a: Audience) => (a === 'B2B' ? 'b2b' : 'b2c');

export const api = {
  // Categories
  getCategories: (audience: Audience) => http<Category[]>(`/api/catalog/${audiencePath(audience)}/categories`),
  createCategory: (audience: Audience, input: Partial<Category>) =>
    http<Category>(`/api/catalog/${audiencePath(audience)}/categories`, { method: 'POST', body: JSON.stringify(input) }),
  updateCategory: (audience: Audience, id: number, input: Partial<Category>) =>
    http<Category>(`/api/catalog/${audiencePath(audience)}/categories/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  deleteCategory: (audience: Audience, id: number) =>
    http<{ ok: true }>(`/api/catalog/${audiencePath(audience)}/categories/${id}`, { method: 'DELETE' }),

  // Products
  getProducts: (audience: Audience) => http<Product[]>(`/api/catalog/${audiencePath(audience)}/products`),
  createProduct: (audience: Audience, input: Partial<Product>) =>
    http<Product>(`/api/catalog/${audiencePath(audience)}/products`, { method: 'POST', body: JSON.stringify(input) }),
  updateProduct: (audience: Audience, id: number, input: Partial<Product>) =>
    http<Product>(`/api/catalog/${audiencePath(audience)}/products/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  setProductStatus: (audience: Audience, id: number, status: 'ACTIVE' | 'INACTIVE') =>
    http<Product>(`/api/catalog/${audiencePath(audience)}/products/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  deleteProduct: (audience: Audience, id: number) =>
    http<{ ok: true }>(`/api/catalog/${audiencePath(audience)}/products/${id}`, { method: 'DELETE' }),
  setProductStock: (audience: Audience, id: number, inStock: boolean) =>
    http<Product>(`/api/catalog/${audiencePath(audience)}/products/${id}/stock`, { method: 'PATCH', body: JSON.stringify({ inStock }) }),

  // Spec-field starter templates (Material / Finish / Print method / Device
  // spec…) keyed by category name — used to pre-fill new accessory products.
  getSpecTemplates: () => http<{ templates: Record<string, ProductSpecField[]> }>('/api/spec-templates'),

  // Track order stages — customer-facing label/sub-text per order status.
  getTrackStages: () => http<TrackStage[]>('/api/track-stages'),
  updateTrackStages: (stages: Pick<TrackStage, 'key' | 'label' | 'sub'>[]) =>
    http<TrackStage[]>('/api/track-stages', { method: 'PUT', body: JSON.stringify({ stages }) }),

  // App settings — Feature Toggles + Company/billing details.
  getSettings: () => http<AppSettings>('/api/settings'),
  toggleFeature: (key: string, on: boolean) =>
    http<FeatureToggle[]>(`/api/settings/features/${encodeURIComponent(key)}`, { method: 'PUT', body: JSON.stringify({ on }) }),
  updateCompanySettings: (patch: Partial<CompanySettings>) =>
    http<CompanySettings>('/api/settings/company', { method: 'PUT', body: JSON.stringify(patch) }),
  updateCoordinator: (patch: Partial<CoordinatorSettings>) =>
    http<CoordinatorSettings>('/api/settings/coordinator', { method: 'PUT', body: JSON.stringify(patch) }),
  updateOrderForm: (patch: Partial<OrderFormConfig>) =>
    http<OrderFormConfig>('/api/settings/order-form', { method: 'PUT', body: JSON.stringify(patch) }),
  updateServiceFee: (patch: Partial<ServiceFeeConfig>) =>
    http<ServiceFeeConfig>('/api/settings/service-fee', { method: 'PUT', body: JSON.stringify(patch) }),

  // Manufacturers
  getManufacturers: () => http<unknown[]>('/api/manufacturers'),
  updateManufacturer: (id: number, input: Record<string, unknown>) => http<unknown>(`/api/manufacturers/${id}`, { method: 'PUT', body: JSON.stringify(input) }),

  // Orders
  getOrders: () => http<Order[]>('/api/orders'),
  getOrder: (id: number) => http<Order>(`/api/orders/${id}`),
  createOrder: (input: Record<string, unknown>) => http<Order>('/api/orders', { method: 'POST', body: JSON.stringify(input) }),
  updateOrderStatus: (id: number, patch: Record<string, unknown>) => http<Order>(`/api/orders/${id}/status`, { method: 'PUT', body: JSON.stringify(patch) }),
  uploadOrderDocument: (id: number, doc: { name: string; kind: string; dataUrl: string }) =>
    http<Order>(`/api/orders/${id}/documents`, { method: 'POST', body: JSON.stringify(doc) }),
  deleteOrderDocument: (id: number, docId: string) =>
    http<Order>(`/api/orders/${id}/documents/${docId}`, { method: 'DELETE' }),
  generateInvoice: (id: number) => http<Order>(`/api/orders/${id}/invoice`, { method: 'POST' }),
  setDocumentVisibility: (id: number, docId: string, visible: boolean) =>
    http<Order>(`/api/orders/${id}/documents/${docId}/visibility`, { method: 'PATCH', body: JSON.stringify({ visible }) }),

  // Support tickets (raised in the Garm App; worked here)
  getTickets: () => http<{ tickets: SupportTicket[] }>('/api/support/tickets'),
  replyTicket: (id: string, body: string) => http<{ ticket: SupportTicket }>(`/api/support/tickets/${id}/messages`, { method: 'POST', body: JSON.stringify({ body }) }),
  updateTicket: (id: string, patch: Partial<Pick<SupportTicket, 'status' | 'priority' | 'assignedTo'>>) =>
    http<{ ticket: SupportTicket }>(`/api/support/tickets/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  returnDecision: (id: string, decision: 'APPROVED' | 'DECLINED', note?: string) =>
    http<{ ticket: SupportTicket }>(`/api/support/tickets/${id}/return-decision`, { method: 'POST', body: JSON.stringify({ decision, note }) }),

  devReset: () => http<{ ok: true }>('/api/dev/reset', { method: 'POST' }),

  // Users (role-based access control, provisioned by the Super Admin)
  getUsers: () => http<ApiUser[]>('/api/users'),
  getUserByEmail: (email: string) => http<ApiUser>(`/api/users/by-email/${encodeURIComponent(email)}`),
  createUser: (input: { name: string; email: string; role: string; status?: string }) =>
    http<ApiUser>('/api/users', { method: 'POST', body: JSON.stringify(input) }),
  updateUser: (id: number, input: Partial<Pick<ApiUser, 'name' | 'role' | 'status'>>) =>
    http<ApiUser>(`/api/users/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  deleteUser: (id: number) => http<{ ok: true }>(`/api/users/${id}`, { method: 'DELETE' }),

  // Auth — OTP-verified sign-in. Sends a code to a provisioned employee's
  // email, then exchanges the code for a session token.
  sendAdminOtp: (email: string) =>
    http<{ success: boolean; message: string; devCode?: string }>('/api/auth/admin/send-otp', { method: 'POST', body: JSON.stringify({ email }) }),
  verifyAdminOtp: async (email: string, otp: string) => {
    const data = await http<{ token: string; user: ApiUser }>('/api/auth/admin/verify-otp', { method: 'POST', body: JSON.stringify({ email, otp }) });
    adminToken.set(data.token);
    return data.user;
  },
  getMe: () => http<{ user: ApiUser }>('/api/auth/admin/me'),
  adminLogout: async () => {
    await http('/api/auth/admin/logout', { method: 'POST' }).catch(() => {});
    adminToken.clear();
  },
};
