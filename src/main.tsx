import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './index.css'
import { RoleProvider } from './components/RoleContext'
import { ToastProvider } from './components/Toast'
import Layout from './layout/Layout'
import Dashboard from './pages/Dashboard'
import Orders from './pages/Orders'
import Manufacturers from './pages/Manufacturers'
import QC from './pages/QC'
import Documents from './pages/Documents'
import Payments from './pages/Payments'
import Reports from './pages/Reports'
import Settings from './pages/Settings'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename="/garm-admin-portal">
      <RoleProvider>
        <ToastProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="orders" element={<Orders />} />
              <Route path="manufacturers" element={<Manufacturers />} />
              <Route path="qc" element={<QC />} />
              <Route path="documents" element={<Documents />} />
              <Route path="payments" element={<Payments />} />
              <Route path="reports" element={<Reports />} />
              <Route path="settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Route>
          </Routes>
        </ToastProvider>
      </RoleProvider>
    </BrowserRouter>
  </StrictMode>,
)
