// Initial seed data for the Garm Admin backend.
// Mirrors the shapes already used by the React admin app (src/data/mockData.ts)
// so swapping the frontend from static mock arrays to live API data is a 1:1 change.

export function buildSeed() {
  return {
    meta: { nextOrderSeq: 11, nextCategoryId: 7, nextProductId: 8 },

    categories: [
      { id: 1, name: 'Shirts', appliesTo: ['B2C', 'B2B'], image: null },
      { id: 2, name: 'Polos', appliesTo: ['B2C'], image: null },
      { id: 3, name: 'Accessories', appliesTo: ['B2C'], image: null },
      { id: 4, name: 'Cargo Pants', appliesTo: ['B2C', 'B2B'], image: null },
      { id: 5, name: 'Corporate Uniforms', appliesTo: ['B2B'], image: null },
      { id: 6, name: 'Track Jackets', appliesTo: ['B2B'], image: null },
    ],

    products: [
      { id: 1, name: 'Garm Shirt', categoryId: 1, appliesTo: ['B2C', 'B2B'], price: 250, sizes: ['XS', 'S', 'M', 'L', 'XL'], colors: ['Black', 'White', 'Blue'], moq: 50, status: 'ACTIVE', image: null },
      { id: 2, name: 'Garm Polo', categoryId: 2, appliesTo: ['B2C'], price: 250, sizes: ['S', 'M', 'L', 'XL'], colors: ['Navy', 'White', 'Maroon'], moq: 0, status: 'ACTIVE', image: null },
      { id: 3, name: 'Garm Cap', categoryId: 3, appliesTo: ['B2C'], price: 250, sizes: ['One size'], colors: ['Black'], moq: 0, status: 'ACTIVE', image: null },
      { id: 4, name: 'Garm Cargo Pant', categoryId: 4, appliesTo: ['B2C', 'B2B'], price: 220, sizes: ['30', '32', '34', '36'], colors: ['Khaki', 'Black', 'Olive'], moq: 50, status: 'ACTIVE', image: null },
      { id: 5, name: 'Garm Corporate Blazer', categoryId: 5, appliesTo: ['B2B'], price: 1450, sizes: ['S', 'M', 'L', 'XL'], colors: ['Navy', 'Charcoal'], moq: 20, status: 'ACTIVE', image: null },
      { id: 6, name: 'Garm Track Jacket', categoryId: 6, appliesTo: ['B2B'], price: 225, sizes: ['S', 'M', 'L', 'XL'], colors: ['Grey'], moq: 100, status: 'ACTIVE', image: null },
      { id: 7, name: 'Garm Beanie', categoryId: 3, appliesTo: ['B2C'], price: 180, sizes: ['One size'], colors: ['Grey', 'Black'], moq: 0, status: 'INACTIVE', image: null },
    ],

    manufacturers: [
      { id: 1, name: 'ABC Garments', city: 'Tiruppur, TN', cats: ['Shirts', 'Pants'], certs: ['ISO 9001', 'OEKO-TEX'], cap: 5000, lead: 7, onTime: 95, qc: 92, status: 'ACTIVE', rating: 4.8 },
      { id: 2, name: 'Vogue Textiles', city: 'Surat, GJ', cats: ['Shirts', 'Accessories'], certs: ['Fair Trade'], cap: 3200, lead: 10, onTime: 89, qc: 87, status: 'ACTIVE', rating: 4.4 },
      { id: 3, name: 'Sunrise Apparel', city: 'Ludhiana, PB', cats: ['Pants', 'Jackets'], certs: ['ISO 9001'], cap: 6400, lead: 9, onTime: 91, qc: 90, status: 'ACTIVE', rating: 4.6 },
      { id: 4, name: 'Coral Weaves', city: 'Kolkata, WB', cats: ['Shirts'], certs: [], cap: 1800, lead: 12, onTime: 82, qc: 85, status: 'ON_HOLD', rating: 3.9 },
      { id: 5, name: 'Meridian Textiles', city: 'Ahmedabad, GJ', cats: ['Accessories'], certs: ['OEKO-TEX'], cap: 2500, lead: 8, onTime: 96, qc: 94, status: 'ACTIVE', rating: 4.9 },
      { id: 6, name: 'Prestige Fabrics', city: 'Jaipur, RJ', cats: ['Pants', 'Shirts'], certs: [], cap: 4000, lead: 11, onTime: 78, qc: 80, status: 'INACTIVE', rating: 3.5 },
    ],

    orders: [
      { id: 1, no: 'ORD-20260701-004', cust: 'Acme Corporation', type: 'B2B', email: 'hr@acmecorp.com', address: 'Plot 12, Industrial Area, Bengaluru, KA 560068', qty: 180, total: 53100, status: 'ASSIGNED', qc: 'PENDING', pay: 'PENDING', mfr: 'ABC Garments', date: '2026-07-01',
        lines: [{ p: 'Garm Shirt', size: 'L', color: 'Black', qty: 100, unit: 250 }, { p: 'Garm Shirt', size: 'M', color: 'White', qty: 80, unit: 250 }] },
      { id: 2, no: 'ORD-20260630-003', cust: 'Priya Sharma', type: 'B2C', email: 'priya.sharma@gmail.com', address: '12B Lake View Apartments, Pune, MH 411001', qty: 5, total: 1475, status: 'DELIVERED', qc: 'PASSED', pay: 'COMPLETED', mfr: 'Vogue Textiles', date: '2026-06-30',
        lines: [{ p: 'Garm Polo', size: 'M', color: 'Navy', qty: 5, unit: 250 }] },
      { id: 3, no: 'ORD-20260629-002', cust: 'Nova Retail Pvt Ltd', type: 'B2B', email: 'procurement@novaretail.in', address: 'Warehouse 4, MIDC, Nashik, MH 422010', qty: 420, total: 118500, status: 'QC_READY', qc: 'PENDING', pay: 'PENDING', mfr: 'Sunrise Apparel', date: '2026-06-29',
        lines: [{ p: 'Garm Cargo Pant', size: '32', color: 'Khaki', qty: 220, unit: 220 }, { p: 'Garm Cargo Pant', size: '34', color: 'Black', qty: 200, unit: 220 }] },
      { id: 4, no: 'ORD-20260628-001', cust: 'Rahul Verma', type: 'B2C', email: 'rahul.verma@outlook.com', address: '44 MG Road, Indore, MP 452001', qty: 3, total: 885, status: 'PAID', qc: 'PASSED', pay: 'COMPLETED', mfr: 'ABC Garments', date: '2026-06-28',
        lines: [{ p: 'Garm Shirt', size: 'L', color: 'Blue', qty: 3, unit: 250 }] },
      { id: 5, no: 'ORD-20260626-009', cust: 'Trishul Sportswear', type: 'B2B', email: 'orders@trishulsports.com', address: 'Sector 5, Industrial Estate, Ludhiana, PB 141003', qty: 600, total: 162000, status: 'IN_PROGRESS', qc: 'PENDING', pay: 'PENDING', mfr: 'Sunrise Apparel', date: '2026-06-26',
        lines: [{ p: 'Garm Track Jacket', size: 'L', color: 'Grey', qty: 600, unit: 225 }] },
      { id: 6, no: 'ORD-20260624-008', cust: 'Meera Iyer', type: 'B2C', email: 'meera.iyer@gmail.com', address: '8 Anna Nagar, Chennai, TN 600040', qty: 2, total: 590, status: 'SHIPPED', qc: 'PASSED', pay: 'COMPLETED', mfr: 'Vogue Textiles', date: '2026-06-24',
        lines: [{ p: 'Garm Polo', size: 'S', color: 'White', qty: 2, unit: 250 }] },
      { id: 7, no: 'ORD-20260622-007', cust: 'Blue Horizon Corp', type: 'B2B', email: 'purchasing@bluehorizon.com', address: 'Tower B, Cyber City, Gurugram, HR 122002', qty: 250, total: 71250, status: 'INVOICED', qc: 'PASSED', pay: 'PARTIAL', mfr: 'ABC Garments', date: '2026-06-22',
        lines: [{ p: 'Garm Shirt', size: 'XL', color: 'Black', qty: 250, unit: 242 }] },
      { id: 8, no: 'ORD-20260620-006', cust: 'Ankit Malhotra', type: 'B2C', email: 'ankit.m@yahoo.com', address: '21 Park Street, Kolkata, WB 700016', qty: 1, total: 295, status: 'CANCELLED', qc: 'PENDING', pay: 'PENDING', mfr: '—', date: '2026-06-20',
        lines: [{ p: 'Garm Cap', size: 'One size', color: 'Black', qty: 1, unit: 250 }] },
      { id: 9, no: 'ORD-20260618-005', cust: 'Nova Retail Pvt Ltd', type: 'B2B', email: 'procurement@novaretail.in', address: 'Warehouse 4, MIDC, Nashik, MH 422010', qty: 300, total: 82500, status: 'NEW', qc: 'PENDING', pay: 'PENDING', mfr: '—', date: '2026-06-18',
        lines: [{ p: 'Garm Cargo Pant', size: '32', color: 'Olive', qty: 300, unit: 233 }] },
      { id: 10, no: 'ORD-20260615-004', cust: 'Divya Krishnan', type: 'B2C', email: 'divya.k@gmail.com', address: '56 Jubilee Hills, Hyderabad, TG 500033', qty: 4, total: 1180, status: 'QC_APPROVED', qc: 'PASSED', pay: 'PENDING', mfr: 'Vogue Textiles', date: '2026-06-15',
        lines: [{ p: 'Garm Polo', size: 'L', color: 'Maroon', qty: 4, unit: 250 }] },
    ],
  };
}
