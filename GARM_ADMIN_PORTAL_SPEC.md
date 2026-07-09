# GARM ADMIN PORTAL — Complete Web App Specification

**Project**: Garm Admin Portal (Web Application)
**Version**: 1.0
**Date**: January 2025
**Status**: Design & Architecture

---

## TABLE OF CONTENTS

1. [Project Overview](#project-overview)
2. [Feature Breakdown](#feature-breakdown)
3. [User Roles & Permissions](#user-roles--permissions)
4. [Database Schema](#database-schema)
5. [API Endpoints](#api-endpoints)
6. [Frontend Architecture](#frontend-architecture)
7. [Garm App Integration](#garm-app-integration)
8. [Implementation Roadmap](#implementation-roadmap)

---

## PROJECT OVERVIEW

### Purpose
The Garm Admin Portal is an internal web application that manages:
- **Order Management** (B2B organizations & B2C individuals)
- **Manufacturer Configuration & Performance**
- **Quality Control (QC) Workflows**
- **Document Generation** (Invoices, Quotations, Receipts, Picking Tickets, Packing Slips)
- **Payment Integration & Tracking**
- **Reporting & Analytics Dashboard**
- **Bi-directional Sync with Garm Customer App**

### Tech Stack (Recommended)
**Frontend:**
- React 18+ with TypeScript
- Tailwind CSS + shadcn/ui components
- React Query for state management
- React Router for navigation
- Chart.js or Recharts for dashboard

**Backend:**
- Node.js (Express) or Python (FastAPI)
- PostgreSQL for database
- Redis for caching & real-time updates
- JWT for authentication
- Stripe/Razorpay SDK for payments

**Infrastructure:**
- Docker for containerization
- AWS/GCP for hosting
- GitHub Actions for CI/CD
- Vercel or Netlify for frontend deployment

---

## FEATURE BREAKDOWN

### 1. DASHBOARD

#### Purpose
Real-time overview of business operations and pending tasks.

#### Key Metrics (KPIs)
```
┌─────────────────────────────────────────┐
│ Total Revenue (This Month)  │  ₹2,45,000 │
├─────────────────────────────────────────┤
│ Orders Pending QC           │     15     │
├─────────────────────────────────────────┤
│ QC Pass Rate                │    92%     │
├─────────────────────────────────────────┤
│ Average Order Value         │ ₹12,500    │
├─────────────────────────────────────────┤
│ Invoices Sent This Month    │    48      │
├─────────────────────────────────────────┤
│ Outstanding Payments        │   ₹89,000  │
└─────────────────────────────────────────┘
```

#### Visual Components
1. **KPI Cards** — 6 metric cards showing key numbers
2. **Order Pipeline Chart** — Horizontal bar showing orders in each stage (New → Assigned → In Progress → QC → Invoiced → Paid)
3. **Revenue Trend Chart** — Line chart, last 12 months
4. **Top Manufacturers** — Table showing best performers (by on-time delivery, QC pass rate)
5. **Alerts & Notifications** — List of urgent items (overdue QC, failed payments, pending approvals)
6. **Recent Activity Feed** — Timeline of last 20 actions with timestamps

#### Filters
- Date range (this month, last 3 months, custom)
- Manufacturer filter
- Order type (B2B, B2C)

#### Export
- Export dashboard as PDF
- Export metrics to Excel

---

### 2. ORDERS MODULE

#### Overview
Complete order lifecycle from creation to fulfillment.

#### Order Structure
```
Order {
  id: UUID
  order_number: String (auto-generated, e.g., "ORD-20250115-001")
  customer: {
    type: "B2B" | "B2C"
    name: String
    email: String
    phone: String
    gst_number: String (B2B only)
    organization_name: String (B2B only)
    delivery_address: {
      street: String
      city: String
      state: String
      postal_code: String
      country: String
    }
  }
  items: Array<{
    product_id: UUID
    product_name: String
    size: String (XS, S, M, L, XL, etc.)
    color: String
    quantity: Number
    unit_price: Number (₹)
    total_price: Number (₹)
    customization: {
      custom_tag: Boolean
      tag_color: String
      embroidery: String (optional)
      logo: File (optional)
    }
  }>
  pricing: {
    subtotal: Number (₹)
    tax_percentage: Number (18% standard)
    tax_amount: Number (₹)
    total: Number (₹)
    discount: Number (₹, optional)
  }
  status: "NEW" | "ASSIGNED" | "IN_PROGRESS" | "QC_READY" | "QC_APPROVED" | "INVOICED" | "PAID" | "SHIPPED" | "DELIVERED" | "CANCELLED"
  assigned_manufacturer: {
    manufacturer_id: UUID
    assigned_at: DateTime
    estimated_delivery: DateTime
  }
  qc_status: "PENDING" | "IN_PROGRESS" | "PASSED" | "FAILED" | "REWORK"
  payment_status: "PENDING" | "PARTIAL" | "COMPLETED" | "REFUNDED"
  created_at: DateTime
  updated_at: DateTime
  notes: String (admin notes)
}
```

#### Features

**2.1 Order List View**
- **Columns**: Order #, Customer, Type (B2B/B2C), Items, Total, Status, QC Status, Payment Status, Actions
- **Filters**:
  - Status (dropdown)
  - Customer type (B2B / B2C)
  - Date range
  - Manufacturer
  - QC status
  - Payment status
- **Sorting**: By date, customer name, total, status
- **Search**: By order #, customer name, email
- **Inline Actions**: View detail, Edit, Print, Assign manufacturer, Delete
- **Bulk Actions**: Select multiple → Print selected, Assign to manufacturer, Mark for QC, Generate invoices, Export to Excel
- **Pagination**: 20 orders per page with load more or pagination controls

**2.2 Order Detail View**
- **Left panel**: Order info, customer details, delivery address, contact info
- **Center panel**: 
  - Itemized list (product, size, color, qty, price)
  - Pricing breakdown (subtotal, tax, discount, total)
  - Order notes section
- **Right panel**:
  - Status timeline (created → assigned → in progress → QC → invoiced → paid)
  - Current status badge with last update timestamp
  - Related documents (quotation, invoice, packing slip, etc.)
  - Payment info (status, amount, receipt)

**2.3 Create/Edit Order**
- **Form fields**:
  - Customer selection (dropdown with search, or create new)
  - Customer type toggle (B2B / B2C)
  - Delivery address (with autofill from saved addresses)
  - Add items (product picker, size, color, qty, price)
  - Customization options (custom tag, embroidery, logo upload)
  - Notes
  - Discount (optional)
- **Validation**:
  - All required fields
  - Email format
  - Phone number format
  - Minimum order quantity
  - Valid price (no negatives)
- **Submit**: Create order, Auto-generates order number, Shows success toast, Redirects to detail view

**2.4 Order-to-Invoice Flow**
- Step 1: Order placed (admin creates or customer submits via app)
- Step 2: Admin assigns to manufacturer
- Step 3: Manufacturer confirms receipt in their portal
- Step 4: Manufacturer marks as in progress
- Step 5: Admin marks as "QC Ready"
- Step 6: QC inspector inspects items (see QC module)
- Step 7: If passed, system generates invoice
- Step 8: Admin reviews invoice, sends to customer
- Step 9: Customer pays via gateway
- Step 10: Payment confirmed → order marked as paid
- Step 11: Warehouse picks & ships → tracking updated
- Step 12: Order marked delivered

---

### 3. MANUFACTURERS MODULE

#### Overview
Registry and management of manufacturing partners.

#### Manufacturer Structure
```
Manufacturer {
  id: UUID
  name: String
  email: String
  phone: String
  contact_person: String
  address: {
    street: String
    city: String
    state: String
    postal_code: String
  }
  categories: Array<String> (e.g., ["Shirts", "Pants", "Accessories"])
  certifications: Array<String> (e.g., ["ISO 9001", "OEKO-TEX", "Fair Trade"])
  capacity: {
    units_per_month: Number
    lead_time_days: Number
  }
  rates: {
    per_unit_cost: Number (₹)
    minimum_order_quantity: Number
    setup_fee: Number (₹, for custom tags/embroidery)
  }
  performance_metrics: {
    total_orders: Number
    completed_orders: Number
    on_time_delivery_rate: Number (%)
    qc_pass_rate: Number (%)
    average_lead_time_days: Number
  }
  payment_terms: {
    advance_percentage: Number (%)
    terms: String (e.g., "50% advance, 50% on completion")
    bank_details: {
      account_holder: String
      account_number: String
      ifsc_code: String
    }
  }
  status: "ACTIVE" | "INACTIVE" | "ON_HOLD"
  is_verified: Boolean
  created_at: DateTime
  updated_at: DateTime
}
```

#### Features

**3.1 Manufacturer List View**
- **Columns**: Name, City, Categories, Capacity (units/month), Lead time, On-time rate, QC pass rate, Status, Actions
- **Filters**:
  - Status (active, inactive)
  - Category (Shirts, Pants, etc.)
  - City/region
  - Certification
- **Sorting**: By name, performance metrics, lead time
- **Search**: By name, email, city
- **Inline Actions**: View detail, Edit, View orders, View payment history, Deactivate

**3.2 Manufacturer Detail View**
- **Basic Info**: Name, contact, address, categories, certifications
- **Capacity**: Units per month, lead time, minimum order qty
- **Rates**: Per-unit cost, setup fees
- **Performance Dashboard**:
  - Total orders assigned
  - Completed orders
  - On-time delivery rate (%)
  - QC pass rate (%)
  - Average lead time
  - Trend chart (last 3 months)
- **Recent Orders**: Last 10 orders assigned to this manufacturer
- **Payment History**: Invoice date, amount, payment status, date paid
- **Bank Details**: For payment disbursement

**3.3 Add/Edit Manufacturer**
- **Form fields**: Name, contact, address, categories (multi-select), certifications, capacity, rates, payment terms, bank details
- **Validation**: All required fields, email format, phone format, valid numbers
- **Status toggle**: Active / Inactive / On Hold

---

### 4. QUALITY CONTROL (QC) MODULE

#### Overview
Inspection and approval workflow for manufactured items.

#### QC Structure
```
QC_Inspection {
  id: UUID
  order_id: UUID (foreign key to Order)
  status: "PENDING" | "IN_PROGRESS" | "PASSED" | "FAILED" | "REWORK_REQUIRED"
  inspection_date: DateTime
  inspector_name: String
  checklist_items: Array<{
    item_id: UUID
    item_name: String (e.g., "Color match", "Seam quality", "Tag placement")
    status: "PASS" | "FAIL"
    notes: String (optional, for failures)
    photos: Array<File> (optional, for documentation)
  }>
  overall_notes: String
  failed_items: Array<{
    item_number: Number
    reason: String
    photo: File
  }>
  rework_required: Boolean
  rework_notes: String (if rework required)
  photos: Array<File> (before/after inspection)
  created_at: DateTime
  updated_at: DateTime
  approved_by: String (manager who approves the inspection)
  approved_at: DateTime
}
```

#### QC Checklist Templates (by category)
**For Shirts:**
- Color match with reference
- Seam quality (stitching alignment, knot strength)
- Tag placement and stitching
- Fabric quality (no holes, stains, defects)
- Print/embroidery clarity
- Button attachment (if applicable)
- Collar shape
- Sleeve length

**For Pants:**
- Color match
- Seam quality
- Zipper function (smooth operation)
- Button/snap attachment
- Hem alignment
- Tag placement
- Fabric quality
- Pocket stitching

#### Features

**4.1 QC Pending List**
- **Status**: Orders marked "QC Ready" (waiting for inspection)
- **Columns**: Order #, Manufacturer, Item type, Qty, Date marked ready, Inspector assigned, Actions
- **Filters**: By manufacturer, item type, date range
- **Sort**: By date, manufacturer
- **Inline Actions**: Start inspection, Assign to inspector

**4.2 QC Inspection Form**
- **Order Info**: Order number, customer, manufacturer, items being inspected
- **Checklist**: Pre-populated template based on item category
  - Each checklist item has: Item name, Status (Pass/Fail radio), Notes field, Photo upload
- **Overall Notes**: Text area for general comments
- **Photos**: Upload multiple inspection photos (before/after)
- **Result**: Pass / Fail / Rework required (radio buttons)
- **If Pass**: Status changes to "QC_APPROVED", auto-triggers invoice generation
- **If Fail**: Rework required → notify manufacturer → order goes back to "IN_PROGRESS"
- **Submit**: Save inspection, Generate report

**4.3 QC Report View**
- **Printable report** showing:
  - Order info
  - Inspection date & inspector
  - All checklist items with pass/fail
  - Photos
  - Failed items with reasons
  - Manager approval status
- **Print button** → browser print dialog

**4.4 QC Dashboard**
- **Metrics**: Total inspected, pass rate, fail rate, rework rate
- **Trend chart**: Pass rate last 30 days
- **Pending list**: Orders awaiting inspection
- **Inspector performance**: By inspector (avg time per inspection, pass rate)

---

### 5. DOCUMENTS MODULE (Invoices, Quotations, Picking Tickets, Packing Slips)

#### Overview
Generate, manage, and print professional documents.

#### Document Types

**5.1 Invoice**
```
Invoice {
  id: UUID
  invoice_number: String (auto-generated, e.g., "INV-20250115-001")
  order_id: UUID
  issue_date: DateTime
  due_date: DateTime (typically 15-30 days)
  customer: {
    name: String
    gst_number: String
    email: String
    billing_address: String
    shipping_address: String
  }
  items: Array<{
    description: String
    quantity: Number
    unit_price: Number (₹)
    tax_rate: Number (18% standard)
    amount: Number (₹)
  }>
  subtotal: Number (₹)
  tax_total: Number (₹)
  total: Number (₹)
  payment_terms: String (e.g., "Due within 30 days")
  bank_details: {
    account_holder: String
    account_number: String
    ifsc_code: String
  }
  gst_details: {
    gst_number: String
    place_of_supply: String
  }
  status: "DRAFT" | "SENT" | "PARTIALLY_PAID" | "PAID" | "OVERDUE"
  sent_at: DateTime (when email sent)
  created_at: DateTime
  updated_at: DateTime
}
```

**5.2 Quotation**
```
Quotation {
  id: UUID
  quotation_number: String
  customer_id: UUID
  items: Array<{
    description: String
    quantity: Number
    unit_price: Number (₹)
    amount: Number (₹)
  }>
  subtotal: Number (₹)
  tax: Number (₹)
  total: Number (₹)
  validity_date: DateTime (e.g., valid for 30 days)
  notes: String
  status: "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED" | "EXPIRED"
  created_at: DateTime
  updated_at: DateTime
}
```

**5.3 Picking Ticket**
```
PickingTicket {
  id: UUID
  order_id: UUID
  ticket_number: String
  items: Array<{
    product_name: String
    size: String
    color: String
    quantity: Number
    picked: Boolean
  }>
  printed_at: DateTime
  picked_at: DateTime (nullable)
  picked_by: String (warehouse staff)
  notes: String
}
```

**5.4 Packing Slip**
```
PackingSlip {
  id: UUID
  order_id: UUID
  slip_number: String
  items: Array<{
    product_name: String
    quantity: Number
  }>
  customer_name: String
  delivery_address: String
  order_number: String
  created_at: DateTime
}
```

#### Features

**5.1 Invoice Management**
- **List View**:
  - Columns: Invoice #, Order #, Customer, Total, Status, Sent date, Due date, Actions
  - Filters: Status, date range, customer
  - Search: By invoice # or customer name
  - Inline actions: View, Print, Send, Mark as paid, Download PDF
- **Detail View**: Full invoice display with all details
- **Create/Edit**: Form to manually create quotation/invoice (pre-populated from order)
- **Generate**: Click button on order → auto-generates invoice with order details
- **Send**: Click "Send invoice" → email dialog → input customer email → send via SMTP
- **Print**: Click "Print" → browser print dialog → select template → save as PDF
- **Track**: See when sent, mark as paid when payment received

**5.2 Print Templates**
All documents have print-optimized templates:
- **Invoice Template**: A4 size, professional format, includes GST, bank details, payment terms
- **Quotation Template**: A4 size, validity date, terms & conditions
- **Picking Ticket Template**: A5 size (half A4), includes barcode, checklist boxes
- **Packing Slip Template**: A5 size, simple design for customer

**5.3 Document Generation Workflow**
1. Admin reviews order details
2. Clicks "Generate Invoice" → system creates invoice with auto-numbering
3. Admin reviews invoice (can edit if needed)
4. Admin clicks "Send" → email dialog → specify recipient → send
5. System logs email sent time
6. When customer pays, admin marks as paid → status updates
7. OR customer pays via online gateway → webhook auto-marks as paid

---

### 6. PAYMENTS MODULE

#### Overview
Track and manage customer payments, integrate with payment gateways.

#### Payment Structure
```
Payment {
  id: UUID
  order_id: UUID
  invoice_id: UUID
  amount: Number (₹)
  payment_method: "BANK_TRANSFER" | "CARD" | "UPI" | "CASH" | "CHEQUE" | "ONLINE_GATEWAY"
  payment_status: "PENDING" | "INITIATED" | "COMPLETED" | "FAILED" | "REFUNDED"
  transaction_id: String (from Stripe/Razorpay)
  payment_date: DateTime
  received_date: DateTime (when admin confirmed receipt)
  reference_number: String (cheque #, bank ref, etc.)
  notes: String (admin notes about payment)
  refund_info: {
    refund_id: UUID
    refund_amount: Number (₹)
    refund_date: DateTime
    refund_reason: String
  }
  created_at: DateTime
  updated_at: DateTime
}
```

#### Features

**6.1 Payment List View**
- **Columns**: Order #, Invoice #, Customer, Amount, Method, Status, Payment date, Received date, Actions
- **Filters**: Status, payment method, date range
- **Search**: By order #, invoice #, customer
- **Sorting**: By date, amount, status
- **Inline actions**: View details, Mark as received, Refund, Download receipt
- **Metrics**: Total collected, pending, overdue, refunded (in current period)

**6.2 Payment Detail View**
- **Order & Invoice info**
- **Payment details**: Method, amount, transaction ID, dates
- **Receipt**: Generated payment receipt with order & invoice details
- **Print receipt**: Click "Print" → browser print dialog → PDF

**6.3 Record Payment Manually**
- **Form fields**:
  - Invoice/Order number (search dropdown)
  - Amount
  - Payment method (dropdown)
  - Payment date
  - Reference number (optional)
  - Notes
- **Submit**: Creates payment record, marks invoice as "PARTIALLY_PAID" or "PAID" (depending on amount vs total due)

**6.4 Online Payment Gateway Integration**
- **Stripe or Razorpay integration**:
  - Customer pays via link in invoice email
  - Payment gateway webhook confirms payment
  - Admin backend auto-creates Payment record
  - Order status auto-updates to "PAID"
  - Email confirmation sent to customer & admin
- **Payment link** included in invoice email & order detail page (if unpaid)

---

### 7. SETTINGS MODULE

#### Overview
Admin configuration, user management, feature toggles.

#### Features

**7.1 User Management**
- **Roles**:
  - **Super Admin**: Full access to all modules
  - **Operations Manager**: Orders, manufacturers, payments, dashboard
  - **QC Supervisor**: QC module only
  - **Finance Manager**: Invoices, payments, reports
  - **Warehouse Manager**: Picking tickets, packing slips
  - **View-Only**: Can view all data but not edit
- **User List**:
  - Columns: Name, email, role, status, last login, actions
  - Add/edit/deactivate users
- **Permissions Table**: Define what each role can do (view, create, edit, delete, print, export)

**7.2 Feature Configuration**
- **Toggle features** on/off:
  - B2B orders enabled/disabled
  - B2C orders enabled/disabled
  - QC workflow enabled
  - Payment gateway integration
  - Email notifications
  - SMS notifications
- **Settings**:
  - GST number (for invoices)
  - Company bank details
  - Email SMTP settings (for invoice emails)
  - Stripe/Razorpay API keys
  - WhatsApp integration (optional)

**7.3 Notification Settings**
- **Email notifications**:
  - New order received
  - Order assigned to manufacturer
  - QC ready
  - Invoice sent
  - Payment received
  - Payment overdue (reminder)
- **SMS notifications** (optional):
  - Same triggers as email
- **In-app notifications**: Real-time toast/banner alerts

**7.4 Audit Logs**
- **Track all actions**: User, action, timestamp, before/after values
- **Searchable**: By user, action type, date range
- **Exportable**: To CSV/Excel for compliance

**7.5 API Keys & Integrations**
- **Generate API keys** for external integrations
- **Stripe/Razorpay**: Connect payment gateway, view transaction logs
- **Email service**: Configure SMTP
- **Garm App sync**: Verify connection, check last sync time, manual sync button

---

### 8. ANALYTICS & REPORTING

#### Overview
Business insights and performance metrics.

#### Reports

**8.1 Revenue Report**
- Total revenue (current month, last 3 months, YTD)
- Revenue by B2B vs B2C
- Revenue by manufacturer
- Revenue trend (line chart, last 12 months)
- Top customers by revenue

**8.2 Orders Report**
- Total orders (current month, YTD)
- Orders by status
- Orders by customer type
- Average order value
- Order fulfillment time (avg days from order to delivery)

**8.3 QC Report**
- Total inspections
- Pass rate (%)
- Fail rate (%)
- Rework rate (%)
- Pass rate by manufacturer
- Most common failure reasons

**8.4 Manufacturer Report**
- Performance rankings (by on-time delivery, QC pass rate, volume)
- Orders assigned & completed
- Average lead time
- Payment status (advance paid, balance due, paid)

**8.5 Custom Reports**
- **Report builder**: Select date range, filters (manufacturer, customer type, status), metrics (revenue, orders, QC rate, etc.)
- **Export**: Download as PDF or Excel
- **Schedule**: Set up recurring reports to email (daily, weekly, monthly)

---

## USER ROLES & PERMISSIONS

### Role: Super Admin
- ✅ All modules full access (create, read, update, delete)
- ✅ User management
- ✅ Settings & feature toggles
- ✅ View audit logs
- ✅ Access all reports

### Role: Operations Manager
- ✅ Orders: Full CRUD
- ✅ Manufacturers: Full CRUD
- ✅ QC: View only (cannot approve)
- ✅ Documents: Generate, send, print
- ✅ Payments: View, record manually
- ✅ Dashboard: Full access
- ✅ Reports: View all
- ❌ User management
- ❌ Settings (except notifications for self)

### Role: QC Supervisor
- ✅ QC: Full access (inspect, approve, reject)
- ✅ Orders: View only
- ✅ Dashboard: View only (QC metrics)
- ❌ Manufacturers: View only
- ❌ Payments: View only
- ❌ Edit orders
- ❌ Settings

### Role: Finance Manager
- ✅ Invoices: Full access (create, send, view)
- ✅ Payments: Full access
- ✅ Orders: View only
- ✅ Reports: Full access (financial reports)
- ✅ Quotations: Create, send
- ❌ QC
- ❌ Manufacturer edit
- ❌ User management

### Role: Warehouse Manager
- ✅ Picking Tickets: Create, print, mark as picked
- ✅ Packing Slips: Create, print
- ✅ Orders: View only
- ❌ Edit orders
- ❌ Payments
- ❌ QC
- ❌ Settings

### Role: View-Only
- ✅ All modules: View only
- ❌ Any create, edit, delete, print

---

## DATABASE SCHEMA

### Core Tables

```sql
-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL, -- SUPER_ADMIN, OPERATIONS_MANAGER, QC_SUPERVISOR, FINANCE_MANAGER, WAREHOUSE_MANAGER, VIEW_ONLY
  status VARCHAR(50) NOT NULL, -- ACTIVE, INACTIVE, SUSPENDED
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Customers (B2B & B2C)
CREATE TABLE customers (
  id UUID PRIMARY KEY,
  type VARCHAR(20) NOT NULL, -- B2B, B2C
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  gst_number VARCHAR(50), -- B2B only
  organization_name VARCHAR(255), -- B2B only
  delivery_address JSONB, -- {street, city, state, postal_code, country}
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Products (Garm catalog)
CREATE TABLE products (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL, -- e.g., "Garm Shirt"
  description TEXT,
  category VARCHAR(100), -- Shirts, Pants, Accessories
  sizes JSONB, -- ["XS", "S", "M", "L", "XL"]
  colors JSONB, -- ["Black", "White", "Blue"]
  base_price DECIMAL(10, 2) NOT NULL,
  image_url VARCHAR(500),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Manufacturers
CREATE TABLE manufacturers (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  contact_person VARCHAR(255),
  address JSONB, -- {street, city, state, postal_code}
  categories JSONB, -- ["Shirts", "Pants"]
  certifications JSONB,
  capacity_units_per_month INTEGER,
  lead_time_days INTEGER,
  per_unit_cost DECIMAL(10, 2),
  minimum_order_quantity INTEGER,
  setup_fee DECIMAL(10, 2),
  payment_terms VARCHAR(255),
  bank_details JSONB,
  status VARCHAR(50) NOT NULL, -- ACTIVE, INACTIVE, ON_HOLD
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Orders
CREATE TABLE orders (
  id UUID PRIMARY KEY,
  order_number VARCHAR(50) UNIQUE NOT NULL,
  customer_id UUID NOT NULL REFERENCES customers(id),
  items JSONB, -- [{product_id, product_name, size, color, qty, unit_price, total_price, customization}]
  subtotal DECIMAL(12, 2) NOT NULL,
  tax_percentage DECIMAL(5, 2) DEFAULT 18,
  tax_amount DECIMAL(12, 2) NOT NULL,
  total DECIMAL(12, 2) NOT NULL,
  discount DECIMAL(12, 2) DEFAULT 0,
  status VARCHAR(50) NOT NULL, -- NEW, ASSIGNED, IN_PROGRESS, QC_READY, QC_APPROVED, INVOICED, PAID, SHIPPED, DELIVERED, CANCELLED
  assigned_manufacturer_id UUID REFERENCES manufacturers(id),
  assigned_at TIMESTAMP,
  estimated_delivery TIMESTAMP,
  qc_status VARCHAR(50), -- PENDING, IN_PROGRESS, PASSED, FAILED, REWORK
  payment_status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- PENDING, PARTIAL, COMPLETED, REFUNDED
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- QC Inspections
CREATE TABLE qc_inspections (
  id UUID PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id),
  status VARCHAR(50) NOT NULL,
  inspection_date TIMESTAMP,
  inspector_name VARCHAR(255),
  checklist_items JSONB, -- [{item_id, item_name, status, notes, photos}]
  overall_notes TEXT,
  failed_items JSONB, -- [{item_number, reason, photo}]
  rework_required BOOLEAN DEFAULT FALSE,
  rework_notes TEXT,
  photos JSONB, -- [array of file URLs]
  approved_by VARCHAR(255),
  approved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Invoices
CREATE TABLE invoices (
  id UUID PRIMARY KEY,
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  order_id UUID NOT NULL REFERENCES orders(id),
  issue_date TIMESTAMP NOT NULL,
  due_date TIMESTAMP,
  customer_id UUID NOT NULL REFERENCES customers(id),
  items JSONB,
  subtotal DECIMAL(12, 2),
  tax_total DECIMAL(12, 2),
  total DECIMAL(12, 2),
  payment_terms VARCHAR(255),
  gst_number VARCHAR(50),
  status VARCHAR(50) NOT NULL, -- DRAFT, SENT, PARTIALLY_PAID, PAID, OVERDUE
  sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payments
CREATE TABLE payments (
  id UUID PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id),
  invoice_id UUID REFERENCES invoices(id),
  amount DECIMAL(12, 2) NOT NULL,
  payment_method VARCHAR(50) NOT NULL, -- BANK_TRANSFER, CARD, UPI, CASH, CHEQUE, ONLINE_GATEWAY
  payment_status VARCHAR(50) NOT NULL,
  transaction_id VARCHAR(255),
  payment_date TIMESTAMP,
  received_date TIMESTAMP,
  reference_number VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Picking Tickets
CREATE TABLE picking_tickets (
  id UUID PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id),
  ticket_number VARCHAR(50) UNIQUE NOT NULL,
  items JSONB, -- [{product_name, size, color, qty, picked}]
  printed_at TIMESTAMP,
  picked_at TIMESTAMP,
  picked_by VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Packing Slips
CREATE TABLE packing_slips (
  id UUID PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id),
  slip_number VARCHAR(50) UNIQUE NOT NULL,
  items JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit Logs
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  action VARCHAR(100) NOT NULL, -- CREATE, UPDATE, DELETE, PRINT, SEND_EMAIL, etc.
  entity_type VARCHAR(50), -- ORDER, INVOICE, PAYMENT, etc.
  entity_id UUID,
  changes JSONB, -- {before: {}, after: {}}
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  type VARCHAR(100), -- NEW_ORDER, INVOICE_SENT, PAYMENT_RECEIVED, etc.
  title VARCHAR(255),
  message TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## API ENDPOINTS

### Authentication
```
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/refresh
GET /api/auth/me (current user)
```

### Dashboard
```
GET /api/dashboard/metrics
GET /api/dashboard/order-pipeline
GET /api/dashboard/revenue-trend
GET /api/dashboard/top-manufacturers
GET /api/dashboard/alerts
GET /api/dashboard/activity-feed
```

### Orders
```
GET /api/orders (list with filters)
GET /api/orders/:id
POST /api/orders (create)
PUT /api/orders/:id (update)
DELETE /api/orders/:id
POST /api/orders/:id/assign-manufacturer
POST /api/orders/bulk-assign
GET /api/orders/:id/print (get print template)
```

### Manufacturers
```
GET /api/manufacturers
GET /api/manufacturers/:id
POST /api/manufacturers
PUT /api/manufacturers/:id
DELETE /api/manufacturers/:id
GET /api/manufacturers/:id/performance
GET /api/manufacturers/:id/orders
GET /api/manufacturers/:id/payment-history
```

### QC
```
GET /api/qc/pending
GET /api/qc/:id
POST /api/qc/:order_id/inspect
PUT /api/qc/:id (update inspection)
POST /api/qc/:id/approve
POST /api/qc/:id/reject
GET /api/qc/:id/print
GET /api/qc/dashboard
```

### Documents
```
GET /api/documents/invoices
GET /api/documents/invoices/:id
POST /api/documents/invoices/generate/:order_id
PUT /api/documents/invoices/:id (edit draft)
POST /api/documents/invoices/:id/send
GET /api/documents/invoices/:id/print

GET /api/documents/quotations
POST /api/documents/quotations
GET /api/documents/quotations/:id/print

GET /api/documents/picking-tickets/:order_id
POST /api/documents/picking-tickets/generate/:order_id
GET /api/documents/picking-tickets/:id/print

GET /api/documents/packing-slips/:order_id
```

### Payments
```
GET /api/payments
POST /api/payments (record manual payment)
GET /api/payments/:id
PUT /api/payments/:id (update)
POST /api/payments/:id/refund
POST /api/payments/webhook (Stripe/Razorpay webhook)
```

### Users & Settings
```
GET /api/users
POST /api/users
PUT /api/users/:id
DELETE /api/users/:id
GET /api/settings
PUT /api/settings (update settings)
GET /api/audit-logs
```

### Reports
```
GET /api/reports/revenue
GET /api/reports/orders
GET /api/reports/qc
GET /api/reports/manufacturers
POST /api/reports/custom
```

---

## FRONTEND ARCHITECTURE

### Project Structure
```
garm-admin-portal/
├── src/
│   ├── pages/
│   │   ├── dashboard.tsx
│   │   ├── orders/
│   │   │   ├── list.tsx
│   │   │   ├── detail.tsx
│   │   │   ├── create.tsx
│   │   ├── manufacturers/
│   │   │   ├── list.tsx
│   │   │   ├── detail.tsx
│   │   │   ├── create.tsx
│   │   ├── qc/
│   │   │   ├── pending.tsx
│   │   │   ├── inspect-form.tsx
│   │   │   ├── report.tsx
│   │   ├── documents/
│   │   │   ├── invoices/list.tsx
│   │   │   ├── invoices/detail.tsx
│   │   │   ├── quotations/list.tsx
│   │   │   ├── picking-tickets.tsx
│   │   ├── payments/
│   │   │   ├── list.tsx
│   │   │   ├── detail.tsx
│   │   ├── settings/
│   │   │   ├── users.tsx
│   │   │   ├── features.tsx
│   │   │   ├── notifications.tsx
│   │   │   ├── integrations.tsx
│   │   ├── reports/
│   │   │   ├── revenue.tsx
│   │   │   ├── orders.tsx
│   │   │   ├── qc.tsx
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx
│   │   │   ├── MainLayout.tsx
│   │   ├── common/
│   │   │   ├── Button.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Table.tsx
│   │   │   ├── Form.tsx
│   │   │   ├── Badge.tsx
│   │   ├── orders/
│   │   │   ├── OrderForm.tsx
│   │   │   ├── OrderTable.tsx
│   │   │   ├── OrderDetailPanel.tsx
│   │   ├── manufacturers/
│   │   │   ├── ManufacturerForm.tsx
│   │   │   ├── ManufacturerTable.tsx
│   │   ├── qc/
│   │   │   ├── QCChecklist.tsx
│   │   │   ├── PhotoUpload.tsx
│   │   │   ├── InspectionForm.tsx
│   │   ├── documents/
│   │   │   ├── InvoiceTemplate.tsx
│   │   │   ├── QuotationTemplate.tsx
│   │   │   ├── PickingTicketTemplate.tsx
│   │   │   ├── PackingSlipTemplate.tsx
│   │   ├── dashboard/
│   │   │   ├── KPICard.tsx
│   │   │   ├── OrderPipelineChart.tsx
│   │   │   ├── RevenueChart.tsx
│   ├── hooks/
│   │   ├── useOrders.ts
│   │   ├── useManufacturers.ts
│   │   ├── useQC.ts
│   │   ├── useAuth.ts
│   │   ├── usePrint.ts
│   ├── services/
│   │   ├── api.ts
│   │   ├── orderService.ts
│   │   ├── manufacturerService.ts
│   │   ├── qcService.ts
│   │   ├── documentService.ts
│   │   ├── paymentService.ts
│   ├── store/ (Redux or Context API)
│   │   ├── authSlice.ts
│   │   ├── ordersSlice.ts
│   │   ├── manufacturersSlice.ts
│   ├── styles/
│   │   ├── globals.css
│   │   ├── print.css (print-specific styles)
│   │   ├── tailwind.config.js
│   ├── utils/
│   │   ├── formatters.ts
│   │   ├── validators.ts
│   │   ├── constants.ts
│   ├── App.tsx
│   ├── main.tsx
├── public/
│   ├── favicon.ico
│   ├── logo.svg
├── .env.example
├── tailwind.config.js
├── tsconfig.json
├── vite.config.ts
├── package.json
```

### Key Components & Functionality

**1. Authentication**
- Login form with email/password
- JWT token management
- Role-based route protection
- Auto-logout on token expiry

**2. Sidebar Navigation**
- Menu items based on user role
- Active state highlighting
- Collapsed state for mobile
- Logout button

**3. Data Tables**
- Server-side pagination
- Column sorting
- Row filtering
- Bulk actions (select multiple, apply action)
- Inline actions (edit, delete, view)
- Search functionality
- Export to CSV/Excel

**4. Forms**
- Text inputs, selects, checkboxes, radio buttons
- Date pickers
- File uploads (for photos, logos, attachments)
- Multi-select (for manufacturers, categories)
- Form validation
- Error display
- Submit & reset buttons

**5. Print Templates**
- CSS `@media print` rules for print-only layouts
- Hide UI elements when printing
- Optimize spacing for paper
- Include all necessary information
- Page breaks for multi-page documents

---

## GARM APP INTEGRATION

### How Admin Changes Sync to Garm App

#### Scenario 1: Admin Adds a New Product (List)
**Admin Portal:**
1. Super Admin goes to Settings → Products Management
2. Clicks "Add Product"
3. Fills form: Name, Category, Sizes, Colors, Base Price, Image
4. Submits → Product saved to database

**Garm App (Automatic):**
1. Backend detects new product in database
2. Publishes event to Garm App via webhook or GraphQL subscription
3. Garm App receives update
4. Product appears in customer's product catalog immediately
5. Customers can view and order the new product

#### Scenario 2: Admin Updates Manufacturer Info
**Admin Portal:**
1. Operations Manager goes to Manufacturers
2. Clicks on a manufacturer
3. Edits fields: Name, Categories, Rates, Status
4. Submits → Updates database

**Garm App (Automatic):**
1. Backend detects manufacturer update
2. Garm App manufacturers list refreshes (if open)
3. Customers see updated manufacturer info (if B2B ordering)

#### Scenario 3: Admin Changes Order Status
**Admin Portal:**
1. Operations Manager assigns order to manufacturer
2. Status changes from "NEW" → "ASSIGNED"
3. Backend updates order.status in database

**Garm App (Real-time):**
1. Customer (who placed order) sees real-time update
2. Order status badge updates on their dashboard
3. Customer receives notification (push, email, SMS)
4. Customer can click order to see details

#### Scenario 4: Admin Records Payment
**Admin Portal:**
1. Finance Manager goes to Payments
2. Clicks "Record Payment"
3. Selects invoice, enters amount, date, method
4. Submits → Payment saved to database
5. Order status auto-updates to "PAID"

**Garm App:**
1. Backend detects payment recorded
2. Customer sees order marked as "Paid" ✓
3. Order moves to "Shipped" (or next stage automatically)
4. Customer sees tracking info

### Data Sync Architecture

**Option 1: Real-time WebSockets (Recommended)**
```
Admin Portal → Backend WebSocket → Garm App
(When admin creates/updates data)
- Admin submits form
- Backend updates database
- Backend broadcasts event to all connected Garm App clients
- Customers see instant update (no refresh needed)
- Uses Socket.io or native WebSocket
```

**Option 2: GraphQL Subscriptions**
```
Admin Portal (Mutation) → Backend → Database
Garm App (Subscription) → Listens for changes
- Admin submits form
- GraphQL mutation executes
- Backend updates database & emits subscription event
- Garm App receives event & updates UI
```

**Option 3: Polling**
```
Admin Portal → Backend REST API → Database
Garm App polls every 30 seconds
- Admin updates
- Garm App queries endpoint every 30 seconds
- If data changed, UI updates
- Less real-time but simpler implementation
```

### Shared Data Models

**Products** (Admin creates, Garm App displays)
```javascript
{
  id: UUID,
  name: String,
  category: String,
  sizes: Array,
  colors: Array,
  base_price: Number,
  image_url: String,
  is_active: Boolean
}
```

**Manufacturers** (Admin manages, Garm App shows for B2B)
```javascript
{
  id: UUID,
  name: String,
  categories: Array,
  certifications: Array,
  capacity_units_per_month: Number,
  lead_time_days: Number,
  per_unit_cost: Number,
  rating: Number (calculated from QC pass rate),
  is_verified: Boolean
}
```

**Orders** (Customer creates in Garm, Admin manages)
```javascript
{
  id: UUID,
  order_number: String,
  customer_id: UUID,
  items: Array,
  total: Number,
  status: String, // Synchronized
  payment_status: String, // Synchronized
  created_at: DateTime,
  updated_at: DateTime
}
```

### API Contract (Admin ↔ Garm App)

**Garm App calls Admin API to:**
1. **Create order** → POST /api/orders
2. **Get order details** → GET /api/orders/:id
3. **Get product catalog** → GET /api/products
4. **Get manufacturers** → GET /api/manufacturers
5. **Check invoice/quotation** → GET /api/documents/invoices/:id
6. **Get payment link** → GET /api/orders/:id/payment-link

**Admin backend publishes to Garm App:**
1. **New product added** → Webhook event
2. **Order status changed** → WebSocket update
3. **Payment received** → WebSocket update
4. **Invoice generated** → Webhook notification
5. **Quotation created** → Webhook notification

---

## IMPLEMENTATION ROADMAP

### Phase 1: Foundation (Weeks 1-2)
- [ ] Database schema design & migrations
- [ ] Backend project setup (Express/FastAPI, auth, middleware)
- [ ] Frontend project setup (React, Tailwind, routing)
- [ ] Authentication system (login, JWT, role-based access)
- [ ] Basic layout (sidebar, header, footer)
- [ ] Reusable components (Table, Form, Modal, Button, Badge)

### Phase 2: Core Modules (Weeks 3-5)
- [ ] Customers module (B2B & B2C)
- [ ] Products module (add, edit, delete)
- [ ] Orders module (create, list, detail, edit, assign)
- [ ] Manufacturers module (CRUD, performance metrics)
- [ ] Basic dashboard (KPI cards)

### Phase 3: QC & Documents (Weeks 6-8)
- [ ] QC module (checklist, inspection form, approval)
- [ ] Invoice generation & management
- [ ] Quotation management
- [ ] Picking ticket generation
- [ ] Packing slip generation
- [ ] Print functionality for all documents

### Phase 4: Payments & Integration (Weeks 9-10)
- [ ] Payments module (record, track, refund)
- [ ] Stripe/Razorpay integration
- [ ] Webhook handling (payment confirmations)
- [ ] Payment status automation

### Phase 5: Settings & Admin Features (Week 11)
- [ ] User management
- [ ] Role-based permissions
- [ ] Settings & feature toggles
- [ ] Audit logs
- [ ] Notifications system

### Phase 6: Reports & Analytics (Week 12)
- [ ] Dashboard enhancements
- [ ] Revenue report
- [ ] Orders report
- [ ] QC report
- [ ] Manufacturer report

### Phase 7: Garm App Integration (Week 13-14)
- [ ] WebSocket setup for real-time sync
- [ ] Webhook endpoints
- [ ] Data sync testing
- [ ] Manufacturer portal (for manufacturer login & order updates)

### Phase 8: Polish & Testing (Week 15-16)
- [ ] End-to-end testing
- [ ] Performance optimization
- [ ] Security audit
- [ ] Mobile responsiveness
- [ ] Documentation
- [ ] Deployment setup

---

## DEPLOYMENT CHECKLIST

**Before going live:**
- [ ] Database backed up
- [ ] Environment variables configured (.env file)
- [ ] Payment gateway in production mode
- [ ] SMTP email service configured
- [ ] SSL certificates installed
- [ ] Rate limiting enabled
- [ ] Error tracking (Sentry) set up
- [ ] Monitoring & alerting configured
- [ ] All features tested end-to-end
- [ ] User documentation created
- [ ] Team trained on system
- [ ] Support process documented

---

## NOTES FOR DEVELOPMENT

1. **Print Optimization**: Use CSS `@media print` rules to hide UI and optimize documents for A4/A5 printing. Test on different browsers.

2. **Real-time Updates**: Use WebSocket or polling to keep Garm App in sync with admin actions. Consider Socket.io for easier implementation.

3. **File Uploads**: Store files on AWS S3 or GCP Cloud Storage. Return signed URLs for access. Implement virus scanning for security.

4. **Email Service**: Use SendGrid, AWS SES, or Mailgun. Implement email templates for invoices, quotations, notifications.

5. **Payment Gateway**: Implement webhooks from Stripe/Razorpay to auto-update payment status. Store transaction IDs for refund processing.

6. **Error Handling**: Log all errors to a centralized service (Sentry). Show user-friendly error messages on frontend.

7. **Pagination**: Implement server-side pagination to handle large datasets. Use limit/offset or cursor-based pagination.

8. **Caching**: Cache frequently accessed data (products, manufacturers) in Redis. Invalidate cache when data changes.

9. **Performance**: Optimize images, lazy-load routes, use code splitting. Target <3s first paint on 4G.

10. **Security**: Implement CSRF protection, SQL injection prevention, XSS protection, rate limiting on APIs, secure password hashing (bcrypt).

---

END OF SPECIFICATION
