# Backend Setup Guide — Garm Admin Portal

## Tech Stack
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Authentication**: JWT + bcrypt
- **Real-time**: Socket.io
- **Payment**: Stripe SDK
- **File Storage**: AWS S3
- **Testing**: Jest + Supertest

---

## Project Structure

```
garm-admin-backend/
├── src/
│   ├── config/
│   │   ├── database.ts
│   │   ├── env.ts
│   │   ├── stripe.ts
│   ├── middleware/
│   │   ├── auth.ts
│   │   ├── errorHandler.ts
│   │   ├── validation.ts
│   │   ├── roleCheck.ts
│   ├── routes/
│   │   ├── auth.ts
│   │   ├── orders.ts
│   │   ├── manufacturers.ts
│   │   ├── qc.ts
│   │   ├── documents.ts
│   │   ├── payments.ts
│   │   ├── users.ts
│   │   ├── settings.ts
│   │   ├── reports.ts
│   ├── controllers/
│   │   ├── authController.ts
│   │   ├── orderController.ts
│   │   ├── manufacturerController.ts
│   │   ├── qcController.ts
│   │   ├── documentController.ts
│   │   ├── paymentController.ts
│   │   ├── userController.ts
│   ├── services/
│   │   ├── orderService.ts
│   │   ├── manufacturerService.ts
│   │   ├── qcService.ts
│   │   ├── documentService.ts
│   │   ├── paymentService.ts
│   │   ├── emailService.ts
│   │   ├── s3Service.ts
│   ├── models/
│   │   ├── User.ts
│   │   ├── Order.ts
│   │   ├── Manufacturer.ts
│   │   ├── QC.ts
│   │   ├── Invoice.ts
│   │   ├── Payment.ts
│   ├── types/
│   │   ├── express.d.ts (extend Express types)
│   │   ├── models.ts
│   │   ├── api.ts
│   ├── utils/
│   │   ├── logger.ts
│   │   ├── jwt.ts
│   │   ├── validators.ts
│   ├── websocket/
│   │   ├── events.ts
│   │   ├── handlers.ts
│   ├── app.ts
│   ├── server.ts
├── prisma/
│   ├── schema.prisma (database schema)
│   ├── migrations/
├── tests/
│   ├── orders.test.ts
│   ├── manufacturers.test.ts
├── .env.example
├── docker-compose.yml
├── package.json
├── tsconfig.json
```

---

## Step 1: Initial Setup

### Install Dependencies

```bash
npm init -y
npm install express dotenv cors helmet morgan jsonwebtoken bcrypt
npm install -D typescript ts-node @types/express @types/node tsx
npm install prisma @prisma/client
npm install socket.io
npm install stripe
npm install aws-sdk
npm install nodemailer
npm install joi
npm install jest @types/jest ts-jest supertest
```

### .env File

```env
# Server
PORT=5000
NODE_ENV=development
LOG_LEVEL=debug

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/garm_admin"

# JWT
JWT_SECRET=your_super_secret_key_here_change_in_production
JWT_EXPIRY=24h

# Stripe
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_PUBLIC_KEY=pk_test_xxx

# AWS S3
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_S3_BUCKET=garm-uploads
AWS_REGION=us-east-1

# Email Service
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@garm.com
SMTP_PASSWORD=xxx
SMTP_FROM=noreply@garm.com

# Garm App Integration
GARM_APP_URL=http://localhost:3000
GARM_APP_API_URL=http://localhost:3000/api
```

---

## Step 2: Database Setup (Prisma)

### prisma/schema.prisma

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(cuid())
  name      String
  email     String   @unique
  passwordHash String
  role      Role     @default(OPERATIONS_MANAGER)
  status    Status   @default(ACTIVE)
  lastLogin DateTime?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  orders Order[]
  qcInspections QCInspection[]
  auditLogs AuditLog[]

  @@map("users")
}

enum Role {
  SUPER_ADMIN
  OPERATIONS_MANAGER
  QC_SUPERVISOR
  FINANCE_MANAGER
  WAREHOUSE_MANAGER
  VIEW_ONLY
}

enum Status {
  ACTIVE
  INACTIVE
  SUSPENDED
}

model Customer {
  id        String   @id @default(cuid())
  type      CustomerType
  name      String
  email     String?
  phone     String?
  gstNumber String?
  organizationName String?
  deliveryAddress Json?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  orders Order[]

  @@map("customers")
}

enum CustomerType {
  B2B
  B2C
}

model Product {
  id        String   @id @default(cuid())
  name      String
  description String?
  category  String
  sizes     Json? // ["XS", "S", "M", "L", "XL"]
  colors    Json? // ["Black", "White", "Blue"]
  basePrice Decimal
  imageUrl  String?
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("products")
}

model Manufacturer {
  id        String   @id @default(cuid())
  name      String
  email     String?
  phone     String?
  contactPerson String?
  address   Json?
  categories Json?
  certifications Json?
  capacityUnitsPerMonth Int?
  leadTimeDays Int?
  perUnitCost Decimal?
  minimumOrderQuantity Int?
  setupFee  Decimal?
  paymentTerms String?
  bankDetails Json?
  status    ManufacturerStatus @default(ACTIVE)
  isVerified Boolean @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  orders Order[]
  qcInspections QCInspection[]

  @@map("manufacturers")
}

enum ManufacturerStatus {
  ACTIVE
  INACTIVE
  ON_HOLD
}

model Order {
  id        String   @id @default(cuid())
  orderNumber String @unique
  customerId String
  customer  Customer @relation(fields: [customerId], references: [id])
  
  items     Json // [{product_id, name, size, color, qty, price}]
  subtotal  Decimal
  taxPercentage Decimal @default(18)
  taxAmount Decimal
  total     Decimal
  discount  Decimal @default(0)
  
  status    OrderStatus @default(NEW)
  assignedManufacturerId String?
  assignedManufacturer Manufacturer? @relation(fields: [assignedManufacturerId], references: [id])
  assignedAt DateTime?
  estimatedDelivery DateTime?
  
  qcStatus  QCStatus @default(PENDING)
  paymentStatus PaymentStatus @default(PENDING)
  
  notes     String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  qcInspections QCInspection[]
  invoices Invoice[]
  payments Payment[]
  pickingTickets PickingTicket[]
  packingSlips PackingSlip[]

  @@index([customerId])
  @@index([assignedManufacturerId])
  @@map("orders")
}

enum OrderStatus {
  NEW
  ASSIGNED
  IN_PROGRESS
  QC_READY
  QC_APPROVED
  INVOICED
  PAID
  SHIPPED
  DELIVERED
  CANCELLED
}

enum QCStatus {
  PENDING
  IN_PROGRESS
  PASSED
  FAILED
  REWORK
}

enum PaymentStatus {
  PENDING
  PARTIAL
  COMPLETED
  REFUNDED
}

model QCInspection {
  id        String   @id @default(cuid())
  orderId   String
  order     Order    @relation(fields: [orderId], references: [id])
  
  status    QCStatus
  inspectionDate DateTime?
  inspectorName String?
  checklistItems Json?
  overallNotes String?
  failedItems Json?
  reworkRequired Boolean @default(false)
  reworkNotes String?
  photos    Json? // [file URLs]
  
  approvedBy String?
  approvedAt DateTime?
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([orderId])
  @@map("qc_inspections")
}

model Invoice {
  id        String   @id @default(cuid())
  invoiceNumber String @unique
  orderId   String
  order     Order    @relation(fields: [orderId], references: [id])
  
  issueDate DateTime
  dueDate   DateTime?
  customerId String
  
  items     Json?
  subtotal  Decimal?
  taxTotal  Decimal?
  total     Decimal?
  
  paymentTerms String?
  gstNumber String?
  status    InvoiceStatus @default(DRAFT)
  
  sentAt    DateTime?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([orderId])
  @@map("invoices")
}

enum InvoiceStatus {
  DRAFT
  SENT
  PARTIALLY_PAID
  PAID
  OVERDUE
}

model Payment {
  id        String   @id @default(cuid())
  orderId   String
  order     Order    @relation(fields: [orderId], references: [id])
  invoiceId String?
  
  amount    Decimal
  paymentMethod PaymentMethod
  paymentStatus PaymentStatus
  transactionId String?
  paymentDate DateTime?
  receivedDate DateTime?
  referenceNumber String?
  
  notes     String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([orderId])
  @@map("payments")
}

enum PaymentMethod {
  BANK_TRANSFER
  CARD
  UPI
  CASH
  CHEQUE
  ONLINE_GATEWAY
}

model PickingTicket {
  id        String   @id @default(cuid())
  orderId   String
  order     Order    @relation(fields: [orderId], references: [id])
  
  ticketNumber String @unique
  items     Json?
  printedAt DateTime?
  pickedAt  DateTime?
  pickedBy  String?
  notes     String?
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([orderId])
  @@map("picking_tickets")
}

model PackingSlip {
  id        String   @id @default(cuid())
  orderId   String
  order     Order    @relation(fields: [orderId], references: [id])
  
  slipNumber String @unique
  items     Json?
  createdAt DateTime @default(now())

  @@index([orderId])
  @@map("packing_slips")
}

model AuditLog {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  
  action    String
  entityType String?
  entityId  String?
  changes   Json?
  
  createdAt DateTime @default(now())

  @@index([userId])
  @@map("audit_logs")
}

model Notification {
  id        String   @id @default(cuid())
  userId    String?
  type      String
  title     String
  message   String
  isRead    Boolean  @default(false)
  createdAt DateTime @default(now())

  @@map("notifications")
}
```

### Run Migrations

```bash
npx prisma migrate dev --name init
npx prisma db push
```

---

## Step 3: Express App Setup

### src/app.ts

```typescript
import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import authRoutes from './routes/auth';
import orderRoutes from './routes/orders';
import manufacturerRoutes from './routes/manufacturers';
import qcRoutes from './routes/qc';
import documentRoutes from './routes/documents';
import paymentRoutes from './routes/payments';
import userRoutes from './routes/users';
import settingsRoutes from './routes/settings';
import { errorHandler } from './middleware/errorHandler';
import { authMiddleware } from './middleware/auth';

const app: Express = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/orders', authMiddleware, orderRoutes);
app.use('/api/manufacturers', authMiddleware, manufacturerRoutes);
app.use('/api/qc', authMiddleware, qcRoutes);
app.use('/api/documents', authMiddleware, documentRoutes);
app.use('/api/payments', authMiddleware, paymentRoutes);
app.use('/api/users', authMiddleware, userRoutes);
app.use('/api/settings', authMiddleware, settingsRoutes);

// Error handler (last)
app.use(errorHandler);

export default app;
```

### src/server.ts

```typescript
import app from './app';
import { PrismaClient } from '@prisma/client';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

const PORT = process.env.PORT || 5000;
const prisma = new PrismaClient();

const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: { origin: process.env.GARM_APP_URL },
});

// WebSocket event handlers
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

// Emit events from backend
export const emitOrderUpdate = (orderId: string, data: any) => {
  io.emit(`order:${orderId}`, data);
};

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
```

---

## Step 4: Authentication Example

### src/routes/auth.ts

```typescript
import { Router } from 'express';
import { login, register, refresh } from '../controllers/authController';

const router = Router();

router.post('/login', login);
router.post('/register', register);
router.post('/refresh', refresh);

export default router;
```

### src/controllers/authController.ts

```typescript
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: process.env.JWT_EXPIRY || '24h' }
    );

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
};

export const register = async (req: Request, res: Response) => {
  try {
    const { name, email, password, role } = req.body;

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { name, email, passwordHash: hashedPassword, role },
    });

    res.status(201).json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Registration failed' });
  }
};

export const refresh = (req: Request, res: Response) => {
  // Implementation
};
```

---

## Step 5: Example Order API

### src/routes/orders.ts

```typescript
import { Router } from 'express';
import { getOrders, getOrderById, createOrder, updateOrder, deleteOrder } from '../controllers/orderController';

const router = Router();

router.get('/', getOrders);
router.get('/:id', getOrderById);
router.post('/', createOrder);
router.put('/:id', updateOrder);
router.delete('/:id', deleteOrder);

export default router;
```

### src/controllers/orderController.ts

```typescript
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getOrders = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 20, status, customerId } = req.query;

    const orders = await prisma.order.findMany({
      where: {
        status: status as string,
        customerId: customerId as string,
      },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
      include: { customer: true, assignedManufacturer: true },
      orderBy: { createdAt: 'desc' },
    });

    const total = await prisma.order.count();

    res.json({ orders, total, page, limit });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
};

export const getOrderById = async (req: Request, res: Response) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        customer: true,
        assignedManufacturer: true,
        qcInspections: true,
        invoices: true,
        payments: true,
      },
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json(order);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch order' });
  }
};

export const createOrder = async (req: Request, res: Response) => {
  try {
    const { customerId, items, total, tax, discount } = req.body;

    const order = await prisma.order.create({
      data: {
        orderNumber: `ORD-${Date.now()}`,
        customerId,
        items,
        total,
        taxAmount: tax,
        subtotal: total - tax,
        discount,
      },
    });

    res.status(201).json(order);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create order' });
  }
};

export const updateOrder = async (req: Request, res: Response) => {
  try {
    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: req.body,
    });

    res.json(order);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update order' });
  }
};

export const deleteOrder = async (req: Request, res: Response) => {
  try {
    await prisma.order.delete({
      where: { id: req.params.id },
    });

    res.json({ message: 'Order deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete order' });
  }
};
```

---

## Deployment

### Docker Setup

**Dockerfile:**
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 5000

CMD ["npm", "start"]
```

**docker-compose.yml:**
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: garm_admin
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"

  app:
    build: .
    ports:
      - "5000:5000"
    depends_on:
      - postgres
    environment:
      DATABASE_URL: postgresql://admin:password@postgres:5432/garm_admin
      JWT_SECRET: your_secret_here
```

### Run with Docker

```bash
docker-compose up
```

---

END OF BACKEND SETUP
