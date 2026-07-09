# Garm App Integration Guide

## Overview

The Garm Admin Portal and Garm Customer App must be tightly integrated so that:
- **Admin creates/edits data** → **Garm App shows it immediately**
- **Customer places order in Garm App** → **Admin sees it instantly**
- **Admin changes order status** → **Customer notified in real-time**

---

## Architecture

### System Components

```
┌──────────────────────────────────────────────────────────────┐
│                     Garm Ecosystem                            │
├──────────────────┬──────────────────┬───────────────────────┤
│ Admin Portal     │  Shared Backend   │  Garm Customer App    │
│ (Web)            │  (Node.js API)    │  (Mobile/Web)         │
│                  │                   │                        │
│ ├─ Orders        │ ├─ REST API       │ ├─ Browse Products    │
│ ├─ QC            │ ├─ WebSocket      │ ├─ Place Orders       │
│ ├─ Invoices      │ ├─ GraphQL Sub.   │ ├─ Track Orders       │
│ ├─ Payments      │ ├─ Database       │ ├─ View Invoices      │
│ ├─ Mfr Config    │ │ (PostgreSQL)    │ └─ Make Payments      │
│ └─ Reports       │ └─ Cache (Redis)  │                        │
└──────────────────┴──────────────────┴───────────────────────┘

                         Real-time Sync
                         (WebSocket)
```

---

## Data Sync Patterns

### Pattern 1: Admin Creates New Product

```
Admin Portal                Backend                Garm App
─────────────            ─────────────            ────────────

[Admin submits
 new product form]
       │
       └─→ POST /api/products
              │
              ├─→ Save to DB
              │
              ├─→ Emit WebSocket event: "product:created"
              │                        │
              │                        └─→ Socket.io broadcast
              │                                  │
              └──────────────────────────────────┘
                                                  │
                            [Garm App receives
                             WebSocket event]
                                    │
                                    └─→ Refresh product catalog
                                    │
                                    └─→ Display new product
```

### Pattern 2: Customer Places Order in Garm App

```
Garm App                  Backend                 Admin Portal
────────────              ─────────────           ──────────────

[Customer fills
 order form]
       │
       └─→ POST /api/orders
              │
              ├─→ Save to DB
              │
              ├─→ Emit: "order:created"
              │           │
              │           └─→ Broadcast to admin
              │                    │
              └────────────────────┘
                                    │
                            [Admin dashboard
                             refreshes]
                                    │
                                    └─→ New order appears in list
```

### Pattern 3: Admin Changes Order Status

```
Admin Portal              Backend                 Garm App
──────────────           ──────────────           ──────────

[Admin clicks
 "Assign to Mfr"]
       │
       └─→ PUT /api/orders/:id
              │
              ├─→ Update DB
              │
              ├─→ Emit: "order:status_changed"
              │         → order_id: "123"
              │         → new_status: "ASSIGNED"
              │         → timestamp
              │           │
              │           └─→ Broadcast to order owner
              │                    │
              └────────────────────┘
                                    │
                            [Customer receives
                             notification]
                                    │
                                    ├─→ Order status badge updates
                                    │
                                    └─→ Toast notification shows
```

---

## WebSocket Events

### Events Emitted from Backend

#### Order Events

```javascript
// When admin creates order
io.emit('order:created', {
  orderId: 'ord-123',
  customerId: 'cust-456',
  orderNumber: 'ORD-20250115-001',
  total: 56640,
  status: 'NEW',
  createdAt: '2025-01-15T10:30:00Z',
  customer: { name: 'Acme Corp', type: 'B2B' }
});

// When admin changes order status
io.to(`customer:${customerId}`).emit('order:status_changed', {
  orderId: 'ord-123',
  oldStatus: 'NEW',
  newStatus: 'ASSIGNED',
  manufacturerName: 'ABC Garments',
  estimatedDelivery: '2025-01-25',
  updatedAt: '2025-01-15T11:00:00Z'
});

// When admin approves QC
io.to(`customer:${customerId}`).emit('order:qc_passed', {
  orderId: 'ord-123',
  status: 'QC_APPROVED',
  invoiceId: 'inv-789',
  invoiceUrl: '/api/documents/invoices/inv-789/pdf',
  message: 'Your order has passed quality control!'
});

// When payment received
io.to(`customer:${customerId}`).emit('payment:received', {
  orderId: 'ord-123',
  paymentId: 'pay-001',
  amount: 56640,
  method: 'BANK_TRANSFER',
  status: 'PAID',
  message: 'Payment confirmed. Order ready to ship!'
});
```

#### Product Events

```javascript
// When admin adds new product
io.emit('product:created', {
  productId: 'prod-001',
  name: 'Garm Shirt',
  category: 'Shirts',
  basePrice: 250,
  sizes: ['XS', 'S', 'M', 'L', 'XL'],
  colors: ['Black', 'White', 'Blue'],
  imageUrl: 'https://cdn.garm.com/products/shirt-001.jpg'
});

// When admin updates product
io.emit('product:updated', {
  productId: 'prod-001',
  changes: {
    basePrice: 275, // Price changed
    sizes: ['S', 'M', 'L', 'XL', 'XXL'] // Added XXL
  }
});

// When admin deactivates product
io.emit('product:deactivated', {
  productId: 'prod-001',
  message: 'Product no longer available'
});
```

#### Manufacturer Events

```javascript
// When admin adds/updates manufacturer
io.emit('manufacturer:updated', {
  manufacturerId: 'mfr-001',
  name: 'ABC Garments',
  capacityUnitsPerMonth: 5000,
  leadTimeDays: 7,
  perUnitCost: 180,
  onTimeDeliveryRate: 95,
  qcPassRate: 92,
  isVerified: true
});
```

### Events Received from Garm App

```javascript
// When customer places order
socket.on('customer:order_placed', (data) => {
  // data = {
  //   customerId, customername, customerEmail,
  //   items, total, deliveryAddress, timestamp
  // }
  // Backend saves order to DB
  // Backend broadcasts 'order:created' to admin
});

// When customer views order
socket.on('customer:viewing_order', (orderId) => {
  // Track viewing for analytics
});

// When customer initiates payment
socket.on('customer:payment_initiated', (data) => {
  // data = { orderId, invoiceId, amount, paymentMethod }
  // Backend logs payment attempt
});
```

---

## Backend WebSocket Setup

### src/websocket/events.ts

```typescript
import { Server as SocketIOServer } from 'socket.io';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const setupWebSocketEvents = (io: SocketIOServer) => {
  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Customer joins their room when they log in
    socket.on('customer:join', (customerId: string) => {
      socket.join(`customer:${customerId}`);
      console.log(`Customer ${customerId} joined their room`);
    });

    // Admin joins general admin room
    socket.on('admin:join', (adminId: string) => {
      socket.join('admins');
      console.log(`Admin ${adminId} joined admin room`);
    });

    // Listen for order placement from Garm App
    socket.on('customer:order_placed', async (orderData) => {
      try {
        const order = await prisma.order.create({
          data: {
            orderNumber: `ORD-${Date.now()}`,
            customerId: orderData.customerId,
            items: orderData.items,
            subtotal: orderData.subtotal,
            taxAmount: orderData.tax,
            total: orderData.total,
          },
          include: { customer: true },
        });

        // Broadcast to all admins
        io.to('admins').emit('order:created', {
          orderId: order.id,
          orderNumber: order.orderNumber,
          customerName: order.customer.name,
          total: order.total,
          timestamp: new Date(),
        });

        // Confirm to customer
        io.to(`customer:${orderData.customerId}`).emit('order:creation_confirmed', {
          orderId: order.id,
          orderNumber: order.orderNumber,
        });
      } catch (error) {
        socket.emit('error', { message: 'Failed to create order' });
      }
    });

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });
};
```

### src/websocket/handlers.ts

```typescript
import { Server as SocketIOServer } from 'socket.io';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Emit when admin updates order status
export const emitOrderStatusChanged = (io: SocketIOServer, orderId: string, newStatus: string) => {
  io.emit(`order:${orderId}:status_changed`, { newStatus, timestamp: new Date() });
};

// Emit when admin approves QC
export const emitQCApproved = (io: SocketIOServer, customerId: string, orderId: string) => {
  io.to(`customer:${customerId}`).emit('order:qc_approved', {
    orderId,
    message: 'Your order has passed quality control!',
  });
};

// Emit when payment received
export const emitPaymentReceived = (io: SocketIOServer, customerId: string, orderId: string) => {
  io.to(`customer:${customerId}`).emit('payment:received', {
    orderId,
    message: 'Payment confirmed. Order ready to ship!',
  });
};

// Emit when product added
export const emitProductCreated = (io: SocketIOServer, productData: any) => {
  io.emit('product:created', productData);
};
```

### src/server.ts (Updated)

```typescript
import app from './app';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { setupWebSocketEvents } from './websocket/events';

const PORT = process.env.PORT || 5000;

const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: [
      process.env.GARM_APP_URL, // Customer app
      process.env.ADMIN_PORTAL_URL, // Admin portal
    ],
    methods: ['GET', 'POST'],
  },
});

// Setup WebSocket events
setupWebSocketEvents(io);

// Make io accessible to routes
app.locals.io = io;

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`WebSocket listening for connections`);
});

export { io };
```

---

## API Endpoints for Sync

### Create Order (from Garm App)
```
POST /api/orders
Content-Type: application/json

{
  "customerId": "cust-456",
  "items": [
    {
      "productId": "prod-001",
      "productName": "Garm Shirt",
      "size": "L",
      "color": "Black",
      "quantity": 100,
      "unitPrice": 250
    }
  ],
  "subtotal": 25000,
  "tax": 4500,
  "total": 29500,
  "deliveryAddress": {...}
}

Response:
{
  "id": "ord-123",
  "orderNumber": "ORD-20250115-001",
  "status": "NEW",
  "createdAt": "2025-01-15T10:30:00Z"
}
```

### Get Order Details (from Garm App)
```
GET /api/orders/:id
Response:
{
  "id": "ord-123",
  "orderNumber": "ORD-20250115-001",
  "status": "ASSIGNED",
  "qcStatus": "PASSED",
  "paymentStatus": "PENDING",
  "items": [...],
  "total": 29500,
  "estimatedDelivery": "2025-01-25",
  "assignedManufacturer": {
    "name": "ABC Garments",
    "estimatedDelivery": "2025-01-25"
  },
  "timeline": [
    { "status": "NEW", "timestamp": "2025-01-15T10:30:00Z" },
    { "status": "ASSIGNED", "timestamp": "2025-01-15T11:00:00Z" },
    { "status": "IN_PROGRESS", "timestamp": "2025-01-17T09:00:00Z" }
  ]
}
```

### Get Products (from Garm App)
```
GET /api/products?limit=50&page=1

Response:
{
  "products": [
    {
      "id": "prod-001",
      "name": "Garm Shirt",
      "category": "Shirts",
      "basePrice": 250,
      "sizes": ["XS", "S", "M", "L", "XL"],
      "colors": ["Black", "White", "Blue"],
      "imageUrl": "...",
      "isActive": true
    },
    ...
  ],
  "total": 150,
  "page": 1,
  "limit": 50
}
```

### Get Manufacturers (from Garm App for B2B)
```
GET /api/manufacturers?active=true&limit=20

Response:
{
  "manufacturers": [
    {
      "id": "mfr-001",
      "name": "ABC Garments",
      "categories": ["Shirts", "Pants"],
      "capacityUnitsPerMonth": 5000,
      "leadTimeDays": 7,
      "perUnitCost": 180,
      "minimumOrderQuantity": 50,
      "onTimeDeliveryRate": 95,
      "qcPassRate": 92,
      "isVerified": true,
      "rating": 4.8
    },
    ...
  ],
  "total": 25
}
```

---

## Frontend Integration (Garm App)

### React Hook for Real-time Updates

```typescript
// hooks/useOrderSync.ts
import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export const useOrderSync = (customerId: string) => {
  const [order, setOrder] = useState(null);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    // Connect to WebSocket
    const newSocket = io(import.meta.env.VITE_API_URL, {
      auth: { token: localStorage.getItem('authToken') },
    });

    // Join customer room
    newSocket.emit('customer:join', customerId);

    // Listen for order status changes
    newSocket.on('order:status_changed', (data) => {
      setOrder((prev) => ({
        ...prev,
        status: data.newStatus,
        updatedAt: data.timestamp,
      }));
      showNotification(`Order status: ${data.newStatus}`);
    });

    // Listen for QC approval
    newSocket.on('order:qc_approved', (data) => {
      setOrder((prev) => ({
        ...prev,
        qcStatus: 'PASSED',
      }));
      showNotification('🎉 Your order passed quality control!');
    });

    // Listen for payment
    newSocket.on('payment:received', (data) => {
      setOrder((prev) => ({
        ...prev,
        paymentStatus: 'COMPLETED',
      }));
      showNotification('✓ Payment confirmed!');
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [customerId]);

  return { order, socket };
};
```

### Order Status Timeline Component

```typescript
// components/OrderTimeline.tsx
import { Order } from '../types';

interface OrderTimelineProps {
  order: Order;
}

export default function OrderTimeline({ order }: OrderTimelineProps) {
  const steps = [
    { status: 'NEW', label: 'Order Placed', icon: '📦' },
    { status: 'ASSIGNED', label: 'Assigned to Manufacturer', icon: '🏭' },
    { status: 'IN_PROGRESS', label: 'In Production', icon: '⚙️' },
    { status: 'QC_READY', label: 'Quality Check', icon: '✓' },
    { status: 'INVOICED', label: 'Invoice Sent', icon: '📄' },
    { status: 'PAID', label: 'Payment Received', icon: '💳' },
    { status: 'SHIPPED', label: 'Shipped', icon: '🚚' },
    { status: 'DELIVERED', label: 'Delivered', icon: '✅' },
  ];

  const currentStepIndex = steps.findIndex((s) => s.status === order.status);

  return (
    <div className="relative pt-8">
      <div className="space-y-4">
        {steps.map((step, index) => (
          <div key={step.status} className="flex gap-4">
            {/* Timeline circle */}
            <div className="flex flex-col items-center">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center text-xl ${
                  index <= currentStepIndex
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-300 text-gray-600'
                }`}
              >
                {step.icon}
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`w-1 h-12 ${
                    index < currentStepIndex ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                />
              )}
            </div>

            {/* Timeline content */}
            <div className="pb-4">
              <p className="font-medium">{step.label}</p>
              {index <= currentStepIndex && (
                <p className="text-sm text-gray-500">
                  {order.timeline?.[index]?.timestamp
                    ? new Date(order.timeline[index].timestamp).toLocaleString()
                    : 'In progress'}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## Testing the Integration

### 1. Start Both Apps

```bash
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Frontend (Admin)
cd frontend && npm run dev

# Terminal 3: Garm App (Customer)
cd garm-app && npm run dev
```

### 2. Create Test Data

```bash
# Login to admin portal
# Create a manufacturer: ABC Garments
# Create a product: Garm Shirt
```

### 3. Place Order from Garm App

```bash
# Login to Garm App as customer
# Select product
# Fill order details
# Submit order
```

### 4. Verify Sync

- **Admin Portal**: Refresh dashboard → new order should appear
- **Garm App**: Order should show status "NEW"

### 5. Admin Updates Order

```bash
# In Admin Portal
# Select order
# Click "Assign to Manufacturer"
# Select ABC Garments
# Submit
```

### 6. Verify Real-time Update

- **Garm App**: Customer should see order status change to "ASSIGNED" in real-time (no page refresh needed)

---

## Deployment Considerations

### Environment Variables

**.env (Backend)**
```env
GARM_APP_URL=https://garm-app.yourdomain.com
ADMIN_PORTAL_URL=https://admin.yourdomain.com
WEBSOCKET_ENABLED=true
REDIS_URL=redis://redis-service:6379
```

### Docker Compose for Prod

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: garm_admin
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}

  redis:
    image: redis:7

  backend:
    build: ./backend
    environment:
      DATABASE_URL: postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/garm_admin
      REDIS_URL: redis://redis:6379
      GARM_APP_URL: ${GARM_APP_URL}
      ADMIN_PORTAL_URL: ${ADMIN_PORTAL_URL}
    depends_on:
      - postgres
      - redis
    ports:
      - "5000:5000"

  frontend:
    build: ./frontend
    environment:
      VITE_API_URL: ${API_URL}
    ports:
      - "3001:3000"

  garm-app:
    build: ./garm-app
    environment:
      VITE_API_URL: ${API_URL}
    ports:
      - "3000:3000"
```

---

## Monitoring & Debugging

### Check WebSocket Connections

```javascript
// In browser console (Frontend)
const socket = io('http://localhost:5000');
socket.on('connect', () => console.log('Connected!'));
socket.on('order:created', (data) => console.log('Order event:', data));
```

### View Real-time Events

```bash
# Terminal
curl "http://localhost:5000/api/websocket-events" # If you expose this endpoint for debugging
```

---

## Troubleshooting

### Orders not syncing to Garm App

1. Check WebSocket connection: `io.connected` in browser console
2. Verify `GARM_APP_URL` in backend .env
3. Check CORS: Make sure origin is allowed
4. Check Redis: `redis-cli KEYS "*"` to see if events are cached

### Latency Issues

- Optimize database queries with indexes
- Cache frequently accessed data (products, manufacturers) in Redis
- Use CDN for static assets

### Connection Drops

- Implement automatic reconnection: `socket.io` client has built-in retry logic
- Use heartbeat/ping-pong mechanism

---

## Next Steps

1. Implement Notification Service (email, SMS, push)
2. Add message queue (RabbitMQ) for async events
3. Set up monitoring (Sentry, LogRocket)
4. Add analytics tracking (Mixpanel, Amplitude)
5. Implement audit logging for compliance

---

END OF GARM APP INTEGRATION GUIDE
