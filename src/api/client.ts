import { API_BASE } from './config';
import type { Order } from '../data/mockData';

export interface Category {
  id: number;
  name: string;
  appliesTo: ('B2C' | 'B2B')[];
  image: string | null;
}

export interface Product {
  id: number;
  name: string;
  categoryId: number;
  appliesTo: ('B2C' | 'B2B')[];
  price: number;
  sizes: string[];
  colors: string[];
  moq: number;
  status: 'ACTIVE' | 'INACTIVE';
  image: string | null;
}

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Categories
  getCategories: () => http<Category[]>('/api/categories'),
  createCategory: (input: Partial<Category>) => http<Category>('/api/categories', { method: 'POST', body: JSON.stringify(input) }),
  updateCategory: (id: number, input: Partial<Category>) => http<Category>(`/api/categories/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  deleteCategory: (id: number) => http<{ ok: true }>(`/api/categories/${id}`, { method: 'DELETE' }),

  // Products
  getProducts: () => http<Product[]>('/api/products'),
  createProduct: (input: Partial<Product>) => http<Product>('/api/products', { method: 'POST', body: JSON.stringify(input) }),
  updateProduct: (id: number, input: Partial<Product>) => http<Product>(`/api/products/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  setProductStatus: (id: number, status: 'ACTIVE' | 'INACTIVE') => http<Product>(`/api/products/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  // Manufacturers
  getManufacturers: () => http<unknown[]>('/api/manufacturers'),
  updateManufacturer: (id: number, input: Record<string, unknown>) => http<unknown>(`/api/manufacturers/${id}`, { method: 'PUT', body: JSON.stringify(input) }),

  // Orders
  getOrders: () => http<Order[]>('/api/orders'),
  getOrder: (id: number) => http<Order>(`/api/orders/${id}`),
  createOrder: (input: Record<string, unknown>) => http<Order>('/api/orders', { method: 'POST', body: JSON.stringify(input) }),
  updateOrderStatus: (id: number, patch: Record<string, unknown>) => http<Order>(`/api/orders/${id}/status`, { method: 'PUT', body: JSON.stringify(patch) }),

  devReset: () => http<{ ok: true }>('/api/dev/reset', { method: 'POST' }),
};
