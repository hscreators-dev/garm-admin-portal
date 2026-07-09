# Frontend Setup Guide — Garm Admin Portal

## Tech Stack
- **Framework**: React 18+ with TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Build Tool**: Vite
- **State Management**: Redux Toolkit or Context API
- **HTTP Client**: Axios + React Query
- **Routing**: React Router v6
- **Charts**: Recharts
- **Forms**: React Hook Form + Zod
- **Testing**: Vitest + React Testing Library

---

## Project Setup

### Create Vite Project

```bash
npm create vite@latest garm-admin-portal -- --template react-ts
cd garm-admin-portal
npm install
```

### Install Dependencies

```bash
npm install react-router-dom
npm install @tanstack/react-query
npm install axios
npm install @reduxjs/toolkit react-redux
npm install tailwindcss postcss autoprefixer
npm install recharts
npm install react-hook-form zod @hookform/resolvers
npm install zustand (alternative to Redux)
npm install clsx class-variance-authority tailwind-merge

# UI Components
npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-tabs

# Date handling
npm install date-fns

# Notifications
npm install sonner react-hot-toast

# Socket.io for real-time
npm install socket.io-client

# Dev dependencies
npm install -D @types/react @types/react-dom typescript
npm install -D @tailwindcss/forms
npm install -D vitest @vitest/ui
```

---

## Project Structure

```
garm-admin-portal/
├── src/
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── Orders/
│   │   │   ├── OrdersList.tsx
│   │   │   ├── OrderDetail.tsx
│   │   │   ├── CreateOrder.tsx
│   │   ├── Manufacturers/
│   │   │   ├── ManufacturersList.tsx
│   │   │   ├── ManufacturerDetail.tsx
│   │   │   ├── CreateManufacturer.tsx
│   │   ├── QC/
│   │   │   ├── QCPending.tsx
│   │   │   ├── QCInspection.tsx
│   │   │   ├── QCReport.tsx
│   │   ├── Documents/
│   │   │   ├── Invoices.tsx
│   │   │   ├── InvoiceDetail.tsx
│   │   │   ├── Quotations.tsx
│   │   │   ├── PickingTickets.tsx
│   │   ├── Payments/
│   │   │   ├── PaymentsList.tsx
│   │   │   ├── RecordPayment.tsx
│   │   ├── Settings/
│   │   │   ├── Users.tsx
│   │   │   ├── Features.tsx
│   │   │   ├── Notifications.tsx
│   │   ├── Reports/
│   │   │   ├── RevenueReport.tsx
│   │   │   ├── OrdersReport.tsx
│   │   │   ├── QCReport.tsx
│   │   ├── Login.tsx
│   │   ├── NotFound.tsx
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx
│   │   │   ├── MainLayout.tsx
│   │   │   ├── Navigation.tsx
│   │   ├── common/
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Select.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Table.tsx
│   │   │   ├── Form.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── LoadingSpinner.tsx
│   │   │   ├── EmptyState.tsx
│   │   ├── orders/
│   │   │   ├── OrderForm.tsx
│   │   │   ├── OrderTable.tsx
│   │   │   ├── OrderDetailPanel.tsx
│   │   │   ├── PrintOrder.tsx
│   │   ├── manufacturers/
│   │   │   ├── ManufacturerForm.tsx
│   │   │   ├── ManufacturerTable.tsx
│   │   │   ├── ManufacturerCard.tsx
│   │   ├── qc/
│   │   │   ├── QCChecklist.tsx
│   │   │   ├── PhotoUploadField.tsx
│   │   │   ├── QCInspectionForm.tsx
│   │   ├── documents/
│   │   │   ├── InvoiceTemplate.tsx
│   │   │   ├── QuotationTemplate.tsx
│   │   │   ├── PickingTicketTemplate.tsx
│   │   │   ├── PackingSlipTemplate.tsx
│   │   ├── dashboard/
│   │   │   ├── KPICard.tsx
│   │   │   ├── OrderPipelineChart.tsx
│   │   │   ├── RevenueChart.tsx
│   │   │   ├── TopManufacturers.tsx
│   │   │   ├── AlertsList.tsx
│   │   │   ├── ActivityFeed.tsx
│   ├── hooks/
│   │   ├── useOrders.ts
│   │   ├── useManufacturers.ts
│   │   ├── useQC.ts
│   │   ├── useAuth.ts
│   │   ├── usePrint.ts
│   │   ├── useLocalStorage.ts
│   │   ├── useDebounce.ts
│   ├── services/
│   │   ├── api.ts (Axios setup)
│   │   ├── orderService.ts
│   │   ├── manufacturerService.ts
│   │   ├── qcService.ts
│   │   ├── documentService.ts
│   │   ├── paymentService.ts
│   ├── store/
│   │   ├── authSlice.ts (Redux)
│   │   ├── ordersSlice.ts
│   │   ├── manufacturersSlice.ts
│   │   ├── store.ts
│   ├── types/
│   │   ├── index.ts (All TypeScript types)
│   │   ├── api.ts
│   │   ├── models.ts
│   ├── utils/
│   │   ├── formatters.ts
│   │   ├── validators.ts
│   │   ├── constants.ts
│   │   ├── helpers.ts
│   ├── styles/
│   │   ├── globals.css
│   │   ├── print.css (Print-specific styles)
│   ├── App.tsx (Main router)
│   ├── main.tsx
│   ├── vite-env.d.ts
├── public/
│   ├── favicon.ico
│   ├── logo.svg
├── .env.example
├── tailwind.config.js
├── postcss.config.js
├── tsconfig.json
├── vite.config.ts
├── package.json
```

---

## Step 1: Tailwind CSS Setup

### tailwind.config.js

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#3b82f6',
        secondary: '#8b5cf6',
        accent: '#ec4899',
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}
```

### postcss.config.js

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

### src/styles/globals.css

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer components {
  .btn-primary {
    @apply px-4 py-2 bg-primary text-white rounded-lg hover:bg-blue-600 transition;
  }

  .btn-secondary {
    @apply px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition;
  }

  .card {
    @apply bg-white rounded-lg shadow-sm border border-gray-200 p-6;
  }

  .input-field {
    @apply w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary;
  }
}

/* Print styles */
@media print {
  .no-print {
    display: none !important;
  }

  .print-only {
    display: block !important;
  }

  body {
    background: white;
    color: black;
  }

  .card, .btn {
    box-shadow: none !important;
    border: 1px solid #ccc !important;
  }
}
```

---

## Step 2: API Service Setup

### src/services/api.ts

```typescript
import axios, { AxiosInstance } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 responses (expired token)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('authToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
```

### src/services/orderService.ts

```typescript
import api from './api';
import { Order, CreateOrderRequest } from '../types';

export const orderService = {
  // Get all orders with pagination & filtering
  getOrders: (params: {
    page?: number;
    limit?: number;
    status?: string;
    customerId?: string;
  }) => api.get<{ orders: Order[]; total: number }>('/orders', { params }),

  // Get single order
  getOrderById: (id: string) => api.get<Order>(`/orders/${id}`),

  // Create order
  createOrder: (data: CreateOrderRequest) => api.post<Order>('/orders', data),

  // Update order
  updateOrder: (id: string, data: Partial<Order>) => api.put<Order>(`/orders/${id}`, data),

  // Delete order
  deleteOrder: (id: string) => api.delete(`/orders/${id}`),

  // Assign to manufacturer
  assignToManufacturer: (orderId: string, manufacturerId: string) =>
    api.post(`/orders/${orderId}/assign-manufacturer`, { manufacturerId }),

  // Print order
  getPrintTemplate: (orderId: string, templateType: 'receipt' | 'picking' | 'packing' | 'invoice') =>
    api.get(`/orders/${orderId}/print`, { params: { templateType } }),
};
```

---

## Step 3: Authentication & State Management

### src/store/authSlice.ts (Redux)

```typescript
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  token: localStorage.getItem('authToken'),
  isAuthenticated: !!localStorage.getItem('authToken'),
  loading: false,
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    loginSuccess: (state, action: PayloadAction<{ token: string; user: User }>) => {
      state.token = action.payload.token;
      state.user = action.payload.user;
      state.isAuthenticated = true;
      state.error = null;
      localStorage.setItem('authToken', action.payload.token);
    },
    logout: (state) => {
      state.token = null;
      state.user = null;
      state.isAuthenticated = false;
      localStorage.removeItem('authToken');
    },
    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
    },
  },
});

export const { setLoading, loginSuccess, logout, setError } = authSlice.actions;
export default authSlice.reducer;
```

### src/store/store.ts

```typescript
import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import ordersReducer from './ordersSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    orders: ordersReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

---

## Step 4: Layout Components

### src/components/layout/MainLayout.tsx

```typescript
import { ReactNode } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

interface MainLayoutProps {
  children: ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <Header />

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
```

### src/components/layout/Sidebar.tsx

```typescript
import { Link, useLocation } from 'react-router-dom';
import { useAppSelector } from '../../hooks/useAppDispatch';

const menuItems = [
  { label: 'Dashboard', href: '/', icon: '📊' },
  { label: 'Orders', href: '/orders', icon: '📦' },
  { label: 'Manufacturers', href: '/manufacturers', icon: '🏭' },
  { label: 'QC', href: '/qc', icon: '✓' },
  { label: 'Documents', href: '/documents', icon: '📄' },
  { label: 'Payments', href: '/payments', icon: '💳' },
  { label: 'Reports', href: '/reports', icon: '📈' },
  { label: 'Settings', href: '/settings', icon: '⚙️' },
];

export default function Sidebar() {
  const location = useLocation();
  const user = useAppSelector((state) => state.auth.user);

  return (
    <div className="w-64 bg-gray-900 text-white p-6 hidden md:flex flex-col">
      {/* Logo */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Garm Admin</h1>
        <p className="text-sm text-gray-400">{user?.role}</p>
      </div>

      {/* Menu */}
      <nav className="flex-1 space-y-2">
        {menuItems.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            className={`block px-4 py-3 rounded-lg transition ${
              location.pathname === item.href
                ? 'bg-primary text-white'
                : 'text-gray-300 hover:bg-gray-800'
            }`}
          >
            {item.icon} {item.label}
          </Link>
        ))}
      </nav>

      {/* User Info */}
      <div className="border-t border-gray-700 pt-4">
        <p className="text-sm text-gray-400">{user?.name}</p>
      </div>
    </div>
  );
}
```

---

## Step 5: Common Components

### src/components/common/Table.tsx

```typescript
import { ReactNode } from 'react';

interface Column<T> {
  header: string;
  accessor: keyof T | ((row: T) => ReactNode);
  width?: string;
}

interface TableProps<T> {
  data: T[];
  columns: Column<T>[];
  loading?: boolean;
  onRowClick?: (row: T) => void;
}

export default function Table<T extends { id: string }>({
  data,
  columns,
  loading,
  onRowClick,
}: TableProps<T>) {
  if (loading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  if (data.length === 0) {
    return <div className="text-center py-8 text-gray-500">No data found</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-100 border-b">
          <tr>
            {columns.map((col) => (
              <th key={String(col.accessor)} className="px-4 py-3 text-left text-sm font-medium">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr
              key={row.id}
              onClick={() => onRowClick?.(row)}
              className="border-b hover:bg-gray-50 cursor-pointer transition"
            >
              {columns.map((col) => {
                const value = typeof col.accessor === 'function' ? col.accessor(row) : row[col.accessor];
                return (
                  <td key={String(col.accessor)} className="px-4 py-3 text-sm">
                    {value}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### src/components/common/Modal.tsx

```typescript
import { ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
}

export default function Modal({ open, title, children, onClose, footer }: ModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-2xl p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="mb-6">{children}</div>

        {/* Footer */}
        {footer && <div className="border-t pt-4">{footer}</div>}
      </div>
    </div>
  );
}
```

---

## Step 6: Print Utilities

### src/hooks/usePrint.ts

```typescript
export const usePrint = () => {
  const printDocument = (elementId: string, fileName: string) => {
    const element = document.getElementById(elementId);
    if (!element) {
      console.error(`Element with id ${elementId} not found`);
      return;
    }

    const printWindow = window.open('', '', 'height=600,width=800');
    printWindow?.document.write(element.innerHTML);
    printWindow?.document.close();
    printWindow?.print();
  };

  return { printDocument };
};
```

### src/styles/print.css

```css
@media print {
  /* Hide all UI elements */
  .sidebar,
  .header,
  .btn,
  .no-print {
    display: none !important;
  }

  /* Print-specific styles */
  .print-container {
    width: 100%;
    margin: 0;
    padding: 20px;
    font-family: 'Arial', sans-serif;
  }

  /* Invoice/Receipt styles */
  .invoice-header {
    border-bottom: 2px solid #333;
    padding-bottom: 20px;
    margin-bottom: 20px;
  }

  .invoice-items table {
    width: 100%;
    border-collapse: collapse;
  }

  .invoice-items td {
    padding: 8px;
    border-bottom: 1px solid #ddd;
  }

  /* Picking ticket styles */
  .picking-ticket {
    width: 10.5cm;
    height: 14.8cm; /* A6 size */
    page-break-after: always;
  }

  /* Barcode */
  .barcode {
    display: block;
    margin: 10px 0;
  }

  /* Page breaks */
  .page-break {
    page-break-after: always;
  }
}
```

---

## Step 7: Routes & App Setup

### src/App.tsx

```typescript
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Provider } from 'react-redux';
import { store } from './store/store';
import { queryClient } from './services/queryClient';

import MainLayout from './components/layout/MainLayout';
import Dashboard from './pages/Dashboard';
import OrdersList from './pages/Orders/OrdersList';
import OrderDetail from './pages/Orders/OrderDetail';
import ManufacturersList from './pages/Manufacturers/ManufacturersList';
import QCPending from './pages/QC/QCPending';
import Login from './pages/Login';
import NotFound from './pages/NotFound';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />

            {/* Protected Routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <Dashboard />
                  </MainLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/orders"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <OrdersList />
                  </MainLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/orders/:id"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <OrderDetail />
                  </MainLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/manufacturers"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <ManufacturersList />
                  </MainLayout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/qc"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <QCPending />
                  </MainLayout>
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </Router>
      </QueryClientProvider>
    </Provider>
  );
}

export default App;
```

---

## Step 8: Protected Routes

### src/components/ProtectedRoute.tsx

```typescript
import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAppSelector } from '../hooks/useAppDispatch';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: string;
}

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAppSelector((state) => state.auth);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && user?.role !== requiredRole) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
```

---

## Running the App

### .env.example

```env
VITE_API_URL=http://localhost:5000/api
VITE_APP_NAME=Garm Admin Portal
```

### package.json Scripts

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "eslint src --ext ts,tsx",
    "test": "vitest",
    "test:ui": "vitest --ui"
  }
}
```

### Run Development Server

```bash
npm run dev
# App available at http://localhost:5173
```

---

## Deployment

### Build for Production

```bash
npm run build
```

### Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### Deploy to Netlify

```bash
npm run build
# Drag & drop 'dist' folder to Netlify
```

---

END OF FRONTEND SETUP
