import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './index.css'
import { RoleProvider } from './components/RoleContext'
import AuthGate from './components/AuthGate'
import { ToastProvider } from './components/Toast'
import { ConfirmProvider } from './components/Confirm'
import Layout from './layout/Layout'
import Dashboard from './pages/Dashboard'
import Catalog from './pages/Catalog'
import Orders from './pages/Orders'
import Customers from './pages/Customers';
import Manufacturers from './pages/Manufacturers'
import QC from './pages/QC'
import Documents from './pages/Documents'
import Payments from './pages/Payments'
import Support from './pages/Support'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import { initTooltips } from './lib/tooltips'

initTooltips();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <RoleProvider>
        <ToastProvider>
          <ConfirmProvider>
          <AuthGate>
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="catalog" element={<Catalog />} />
                <Route path="orders" element={<Orders />} />
                <Route path="customers" element={<Customers />} />
                <Route path="manufacturers" element={<Manufacturers />} />
                <Route path="qc" element={<QC />} />
                <Route path="documents" element={<Documents />} />
                <Route path="payments" element={<Payments />} />
                <Route path="support" element={<Support />} />
                <Route path="reports" element={<Reports />} />
                <Route path="settings" element={<Settings />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Route>
            </Routes>
          </AuthGate>
          </ConfirmProvider>
        </ToastProvider>
      </RoleProvider>
    </BrowserRouter>
  </StrictMode>,
)
