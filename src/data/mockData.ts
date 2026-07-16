export type OrderStatus =
  | 'NEW' | 'CONFIRMED' | 'ASSIGNED' | 'IN_PROGRESS' | 'QC_READY' | 'QC_APPROVED'
  | 'INVOICED' | 'PAID' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
// 'N/A' = Individual (B2C) orders — they skip in-house QC entirely, only
// Organisation (B2B) manufacturing runs go through inspection.
export type QcStatus = 'PENDING' | 'PASSED' | 'FAILED' | 'REWORK' | 'N/A';
export type PayStatus = 'PENDING' | 'PARTIAL' | 'COMPLETED';

export interface OrderLine { p: string; size: string; color: string; qty: number; unit: number; }
export interface OrderSizeEntry { label: string; qty: number; }
export interface OrderColorEntry { hex: string; pantone?: string; label: string; position?: string; }
export interface OrderAccessoryItem { categoryId: string; categoryLabel: string; itemName: string; qty: number; }
export interface OrderDocument {
  id: string;
  name: string;
  kind: 'INVOICE' | 'QUOTATION' | 'BILLING' | 'DESIGN' | 'OTHER';
  uploadedBy: 'admin' | 'customer';
  dataUrl: string;
  generated?: boolean;
  visible?: boolean; // false = generated draft not yet sent to the customer
  createdAt: string | null;
}
export interface Order {
  id: number; no: string; cust: string; type: 'B2B' | 'B2C'; email: string; address: string;
  qty: number; total: number; status: OrderStatus; qc: QcStatus; pay: PayStatus; mfr: string; date: string;
  lines: OrderLine[];
  // Full order record from the shared MongoDB — everything the customer
  // configured in the Garm App, plus payment/contact/assignment details.
  orderRef?: string;
  persona?: 'organisation' | 'individual';
  isAccessoryOrder?: boolean;
  orgType?: string | null;
  orgName?: string | null;
  service?: string | null;
  serviceLabel?: string | null;
  garmentType?: string | null;
  fabric?: string | null;
  gsm?: string | null;
  weave?: string | null;
  fabricSource?: string | null;
  sizes?: OrderSizeEntry[];
  colors?: OrderColorEntry[];
  accessoryItems?: OrderAccessoryItem[];
  stitching?: string | null;
  packaging?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  deliveryAddress?: string | null;
  deliveryCity?: string | null;
  deliveryPin?: string | null;
  notes?: string | null;
  etaDate?: string | null;
  quoteAmount?: number | null;
  serviceFee?: number;
  paymentStatus?: string;          // customer-side: unpaid | partial | paid
  paymentMode?: string | null;     // UPI / Card / Bank transfer…
  paymentDate?: string | null;
  paymentReference?: string | null;
  confirmedAt?: string | null;
  assignedEmployee?: string | null;
  trackingCourier?: string | null;
  trackingNumber?: string | null;
  // Customer rating (1–5) + feedback, submitted from the Garm App once delivered.
  rating?: number | null;
  ratingFeedback?: string | null;
  ratedAt?: string | null;
  documents?: OrderDocument[];
}

export const ordersData: Order[] = [
  {id:1, no:'ORD-20260701-004', cust:'Acme Corporation', type:'B2B', email:'hr@acmecorp.com', address:'Plot 12, Industrial Area, Bengaluru, KA 560068', qty:180, total:53100, status:'ASSIGNED', qc:'PENDING', pay:'PENDING', mfr:'ABC Garments', date:'2026-07-01',
    lines:[{p:'Garm Shirt', size:'L', color:'Black', qty:100, unit:250},{p:'Garm Shirt', size:'M', color:'White', qty:80, unit:250}]},
  {id:2, no:'ORD-20260630-003', cust:'Priya Sharma', type:'B2C', email:'priya.sharma@gmail.com', address:'12B Lake View Apartments, Pune, MH 411001', qty:5, total:1475, status:'DELIVERED', qc:'N/A', pay:'COMPLETED', mfr:'Vogue Textiles', date:'2026-06-30',
    lines:[{p:'Garm Polo', size:'M', color:'Navy', qty:5, unit:250}]},
  {id:3, no:'ORD-20260629-002', cust:'Nova Retail Pvt Ltd', type:'B2B', email:'procurement@novaretail.in', address:'Warehouse 4, MIDC, Nashik, MH 422010', qty:420, total:118500, status:'QC_READY', qc:'PENDING', pay:'PENDING', mfr:'Sunrise Apparel', date:'2026-06-29',
    lines:[{p:'Garm Cargo Pant', size:'32', color:'Khaki', qty:220, unit:220},{p:'Garm Cargo Pant', size:'34', color:'Black', qty:200, unit:220}]},
  {id:4, no:'ORD-20260628-001', cust:'Rahul Verma', type:'B2C', email:'rahul.verma@outlook.com', address:'44 MG Road, Indore, MP 452001', qty:3, total:885, status:'PAID', qc:'N/A', pay:'COMPLETED', mfr:'ABC Garments', date:'2026-06-28',
    lines:[{p:'Garm Shirt', size:'L', color:'Blue', qty:3, unit:250}]},
  {id:5, no:'ORD-20260626-009', cust:'Trishul Sportswear', type:'B2B', email:'orders@trishulsports.com', address:'Sector 5, Industrial Estate, Ludhiana, PB 141003', qty:600, total:162000, status:'IN_PROGRESS', qc:'PENDING', pay:'PENDING', mfr:'Sunrise Apparel', date:'2026-06-26',
    lines:[{p:'Garm Track Jacket', size:'L', color:'Grey', qty:600, unit:225}]},
  {id:6, no:'ORD-20260624-008', cust:'Meera Iyer', type:'B2C', email:'meera.iyer@gmail.com', address:'8 Anna Nagar, Chennai, TN 600040', qty:2, total:590, status:'SHIPPED', qc:'N/A', pay:'COMPLETED', mfr:'Vogue Textiles', date:'2026-06-24',
    lines:[{p:'Garm Polo', size:'S', color:'White', qty:2, unit:250}]},
  {id:7, no:'ORD-20260622-007', cust:'Blue Horizon Corp', type:'B2B', email:'purchasing@bluehorizon.com', address:'Tower B, Cyber City, Gurugram, HR 122002', qty:250, total:71250, status:'INVOICED', qc:'PASSED', pay:'PARTIAL', mfr:'ABC Garments', date:'2026-06-22',
    lines:[{p:'Garm Shirt', size:'XL', color:'Black', qty:250, unit:242}]},
  {id:8, no:'ORD-20260620-006', cust:'Ankit Malhotra', type:'B2C', email:'ankit.m@yahoo.com', address:'21 Park Street, Kolkata, WB 700016', qty:1, total:295, status:'CANCELLED', qc:'N/A', pay:'PENDING', mfr:'—', date:'2026-06-20',
    lines:[{p:'Garm Cap', size:'One size', color:'Black', qty:1, unit:250}]},
  {id:9, no:'ORD-20260618-005', cust:'Nova Retail Pvt Ltd', type:'B2B', email:'procurement@novaretail.in', address:'Warehouse 4, MIDC, Nashik, MH 422010', qty:300, total:82500, status:'NEW', qc:'PENDING', pay:'PENDING', mfr:'—', date:'2026-06-18',
    lines:[{p:'Garm Cargo Pant', size:'32', color:'Olive', qty:300, unit:233}]},
  {id:10, no:'ORD-20260615-004', cust:'Divya Krishnan', type:'B2C', email:'divya.k@gmail.com', address:'56 Jubilee Hills, Hyderabad, TG 500033', qty:4, total:1180, status:'INVOICED', qc:'N/A', pay:'PENDING', mfr:'Vogue Textiles', date:'2026-06-15',
    lines:[{p:'Garm Polo', size:'L', color:'Maroon', qty:4, unit:250}]},
];

export interface Manufacturer {
  id: number; name: string; city: string; cats: string[]; certs: string[];
  cap: number; lead: number; onTime: number; qc: number; status: 'ACTIVE' | 'ON_HOLD' | 'INACTIVE'; rating: number;
}

export const manufacturersData: Manufacturer[] = [
  {id:1, name:'ABC Garments', city:'Tiruppur, TN', cats:['Shirts','Pants'], certs:['ISO 9001','OEKO-TEX'], cap:5000, lead:7, onTime:95, qc:92, status:'ACTIVE', rating:4.8},
  {id:2, name:'Vogue Textiles', city:'Surat, GJ', cats:['Shirts','Accessories'], certs:['Fair Trade'], cap:3200, lead:10, onTime:89, qc:87, status:'ACTIVE', rating:4.4},
  {id:3, name:'Sunrise Apparel', city:'Ludhiana, PB', cats:['Pants','Jackets'], certs:['ISO 9001'], cap:6400, lead:9, onTime:91, qc:90, status:'ACTIVE', rating:4.6},
  {id:4, name:'Coral Weaves', city:'Kolkata, WB', cats:['Shirts'], certs:[], cap:1800, lead:12, onTime:82, qc:85, status:'ON_HOLD', rating:3.9},
  {id:5, name:'Meridian Textiles', city:'Ahmedabad, GJ', cats:['Accessories'], certs:['OEKO-TEX'], cap:2500, lead:8, onTime:96, qc:94, status:'ACTIVE', rating:4.9},
  {id:6, name:'Prestige Fabrics', city:'Jaipur, RJ', cats:['Pants','Shirts'], certs:[], cap:4000, lead:11, onTime:78, qc:80, status:'INACTIVE', rating:3.5},
];

export interface Invoice {
  no: string; ord: string; cust: string; email: string; total: number;
  status: 'DRAFT' | 'SENT' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE'; sent: string; due: string;
}

export const invoicesData: Invoice[] = [
  {no:'INV-20260701-004', ord:'ORD-20260701-004', cust:'Acme Corporation', email:'hr@acmecorp.com', total:53100, status:'SENT', sent:'01 Jul 2026', due:'31 Jul 2026'},
  {no:'INV-20260628-001', ord:'ORD-20260628-001', cust:'Rahul Verma', email:'rahul.verma@outlook.com', total:885, status:'PAID', sent:'28 Jun 2026', due:'—'},
  {no:'INV-20260622-007', ord:'ORD-20260622-007', cust:'Blue Horizon Corp', email:'purchasing@bluehorizon.com', total:71250, status:'PARTIALLY_PAID', sent:'22 Jun 2026', due:'22 Jul 2026'},
  {no:'INV-20260615-004', ord:'ORD-20260615-004', cust:'Divya Krishnan', email:'divya.k@gmail.com', total:1180, status:'OVERDUE', sent:'15 Jun 2026', due:'25 Jun 2026'},
  {no:'INV-20260610-002', ord:'ORD-20260610-002', cust:'Nova Retail Pvt Ltd', email:'procurement@novaretail.in', total:96400, status:'DRAFT', sent:'—', due:'—'},
  {no:'INV-20260602-011', ord:'ORD-20260602-011', cust:'Meera Iyer', email:'meera.iyer@gmail.com', total:590, status:'PAID', sent:'02 Jun 2026', due:'—'},
];

export interface Payment {
  ord: string; inv: string; cust: string; amount: number; method: string;
  status: 'COMPLETED' | 'PENDING' | 'FAILED' | 'REFUNDED'; date: string;
}

export const paymentsData: Payment[] = [
  {ord:'ORD-20260628-001', inv:'INV-20260628-001', cust:'Rahul Verma', amount:885, method:'UPI', status:'COMPLETED', date:'28 Jun 2026'},
  {ord:'ORD-20260622-007', inv:'INV-20260622-007', cust:'Blue Horizon Corp', amount:35625, method:'BANK_TRANSFER', status:'COMPLETED', date:'25 Jun 2026'},
  {ord:'ORD-20260615-004', inv:'INV-20260615-004', cust:'Divya Krishnan', amount:1180, method:'CARD', status:'PENDING', date:'—'},
  {ord:'ORD-20260602-011', inv:'INV-20260602-011', cust:'Meera Iyer', amount:590, method:'UPI', status:'COMPLETED', date:'02 Jun 2026'},
  {ord:'ORD-20260530-014', inv:'INV-20260530-014', cust:'Acme Corporation', amount:12000, method:'CHEQUE', status:'REFUNDED', date:'30 May 2026'},
  {ord:'ORD-20260520-009', inv:'INV-20260520-009', cust:'Trishul Sportswear', amount:81000, method:'BANK_TRANSFER', status:'PENDING', date:'—'},
];

export const activityFeedData = [
  {icon:'check', text:'QC inspection passed for ORD-20260630-003', time:'12 minutes ago', tone:'success'},
  {icon:'card', text:'Payment of ₹35,625 received from Blue Horizon Corp', time:'1 hour ago', tone:'success'},
  {icon:'factory', text:'ORD-20260701-004 assigned to ABC Garments', time:'3 hours ago', tone:'info'},
  {icon:'file', text:'Invoice INV-20260701-004 sent to Acme Corporation', time:'5 hours ago', tone:'info'},
  {icon:'package', text:'New order ORD-20260618-005 placed by Nova Retail Pvt Ltd', time:'Yesterday, 6:40 PM', tone:'purple'},
  {icon:'xCircle', text:'QC inspection failed for lot #221 — seam quality', time:'Yesterday, 3:12 PM', tone:'danger'},
];

export const alertsData = [
  {icon:'clock', text:'3 orders overdue for QC inspection (>48 hrs)', tone:'warning'},
  {icon:'card', text:'Invoice INV-20260615-004 is overdue by 14 days', tone:'danger'},
  {icon:'factory', text:'Coral Weaves on hold — pending re-verification', tone:'slate'},
  {icon:'shieldSm', text:'2 orders awaiting manager QC approval', tone:'info'},
];

export const QC_TEMPLATES: Record<string, string[]> = {
  Shirts: ['Color match with reference','Seam quality & stitching','Tag placement & stitching','Fabric quality (no defects)','Print / embroidery clarity','Button attachment','Collar shape','Sleeve length'],
  Pants: ['Color match','Seam quality','Zipper function','Button / snap attachment','Hem alignment','Tag placement','Fabric quality','Pocket stitching'],
};

export const TITLES: Record<string, string> = {
  dashboard:'Dashboard', catalog:'Catalog', orders:'Orders', manufacturers:'Manufacturers', qc:'Quality Control',
  documents:'Documents', payments:'Payments', reports:'Reports & Analytics', settings:'Settings',
};

export type Role = 'Super Admin' | 'Operations Manager' | 'QC Supervisor' | 'Finance Manager' | 'Warehouse Manager' | 'View-Only';

export const ROLE_VIEWS: Record<Role, string[]> = {
  'Super Admin': ['dashboard','catalog','orders','customers','customer-log','manufacturers','qc','documents','payments','support','reports','settings'],
  'Operations Manager': ['dashboard','catalog','orders','customers','customer-log','manufacturers','payments','support'],
  'QC Supervisor': ['dashboard','qc'],
  'Finance Manager': ['dashboard','documents','payments','reports'],
  'Warehouse Manager': ['dashboard','orders','documents'],
  'View-Only': ['dashboard','catalog','orders','customers','customer-log','manufacturers','qc','documents','payments','support','reports'],
};

export function formatINR(n: number): string {
  return '₹' + Number(n).toLocaleString('en-IN');
}

export function toneFor(status: string): string {
  const map: Record<string, string> = {
    NEW:'info', CONFIRMED:'success', ASSIGNED:'purple', IN_PROGRESS:'warning', QC_READY:'warning', QC_APPROVED:'success',
    INVOICED:'info', PAID:'success', SHIPPED:'purple', DELIVERED:'success', CANCELLED:'danger',
    PENDING:'slate', PASSED:'success', FAILED:'danger', REWORK:'warning', 'N/A':'slate', PARTIAL:'warning',
    PARTIALLY_PAID:'warning', COMPLETED:'success', REFUNDED:'slate', DRAFT:'slate', SENT:'info', OVERDUE:'danger',
    ACTIVE:'success', INACTIVE:'slate', ON_HOLD:'warning',
  };
  return map[status] || 'slate';
}

export function genTrend(end: number, n: number): number[] {
  const arr: number[] = [];
  let v = end - (Math.random() * 6 + 4);
  for (let i = 0; i < n - 1; i++) {
    arr.push(Math.max(60, Math.min(99, Math.round(v))));
    v += Math.random() * 4 - 1.2;
  }
  arr.push(end);
  return arr;
}
