# Garm Admin Portal — Quick Start Guide

## Overview
This guide will get you up and running with both the frontend and backend in ~30 minutes.

---

## Prerequisites
- Node.js 18+ installed
- PostgreSQL 13+ installed (or Docker)
- Git installed
- Code editor (VS Code recommended)

---

## Option 1: Quick Setup with Docker (Recommended)

### Step 1: Clone & Setup Project

```bash
# Create project root
mkdir garm-admin && cd garm-admin

# Create backend folder
mkdir backend
cd backend

# Initialize Node project
npm init -y
npm install express dotenv cors helmet morgan jsonwebtoken bcrypt
npm install -D typescript ts-node @types/express @types/node tsx
npm install prisma @prisma/client
npm install socket.io stripe aws-sdk nodemailer

# Create TypeScript config
npx tsc --init

cd ..
```

### Step 2: Setup Docker Compose

**docker-compose.yml** (at project root):

```yaml
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:15
    container_name: garm_postgres
    environment:
      POSTGRES_DB: garm_admin
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  # Redis Cache
  redis:
    image: redis:7
    container_name: garm_redis
    ports:
      - "6379:6379"

volumes:
  postgres_data:

networks:
  default:
    name: garm_network
```

### Step 3: Start Services

```bash
docker-compose up -d

# Verify services are running
docker ps
# Should show postgres and redis containers

# Check PostgreSQL is ready
docker exec garm_postgres psql -U admin -d garm_admin -c "SELECT 1;"
```

---

## Option 2: Manual Setup (Local)

### Step 1: Install & Start PostgreSQL

**Windows:**
```bash
# Download from https://www.postgresql.org/download/windows/
# Run installer
# Remember: username: postgres, password: [your choice]

# Connect to PostgreSQL
psql -U postgres

# In PostgreSQL shell:
CREATE DATABASE garm_admin;
CREATE USER admin WITH PASSWORD 'password';
GRANT ALL PRIVILEGES ON DATABASE garm_admin TO admin;
\q
```

**Mac:**
```bash
brew install postgresql
brew services start postgresql

createdb garm_admin
createuser -P admin  # Enter password: password
psql garm_admin -c "GRANT ALL PRIVILEGES ON DATABASE garm_admin TO admin;"
```

---

## Setup Backend

### Step 1: Create Backend Structure

```bash
cd backend

# Create src directory structure
mkdir -p src/{config,middleware,routes,controllers,services,models,types,utils,websocket}

# Create essential files
touch src/app.ts src/server.ts .env
```

### Step 2: Copy Files from Guides

**Copy** the content from `BACKEND_SETUP_GUIDE.md` into:
- `src/app.ts`
- `src/server.ts`
- `src/config/database.ts`
- `src/middleware/auth.ts`
- `src/middleware/errorHandler.ts`
- `src/routes/auth.ts`
- `src/controllers/authController.ts`
- etc.

### Step 3: Setup Prisma

```bash
# Initialize Prisma
npx prisma init

# Copy schema from BACKEND_SETUP_GUIDE.md into prisma/schema.prisma
cp [schema content] prisma/schema.prisma

# Create .env file
cat > .env << EOF
PORT=5000
NODE_ENV=development
DATABASE_URL="postgresql://admin:password@localhost:5432/garm_admin"
JWT_SECRET=your_super_secret_key_change_in_production
JWT_EXPIRY=24h
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_PUBLIC_KEY=pk_test_xxx
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_S3_BUCKET=garm-uploads
AWS_REGION=us-east-1
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=noreply@garm.com
SMTP_PASSWORD=xxx
GARM_APP_URL=http://localhost:3000
EOF

# Run migrations
npx prisma migrate dev --name init

# Generate Prisma client
npx prisma generate

# Seed initial data (optional)
npx ts-node scripts/seed.ts
```

### Step 4: Start Backend

```bash
# From backend/ directory
npm run dev

# Expected output:
# Server running on http://localhost:5000
```

---

## Setup Frontend

### Step 1: Create React Project

```bash
# From project root
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
```

### Step 2: Install Dependencies

```bash
npm install react-router-dom
npm install @tanstack/react-query axios
npm install @reduxjs/toolkit react-redux
npm install tailwindcss postcss autoprefixer
npm install recharts react-hook-form zod
npm install socket.io-client sonner
npm install -D @tailwindcss/forms
npm install -D @types/react @types/react-dom

# Initialize Tailwind
npx tailwindcss init -p
```

### Step 3: Copy Files from Guides

Copy structure and files from `FRONTEND_SETUP_GUIDE.md`:

```bash
# Create directory structure
mkdir -p src/{pages/Orders,pages/Manufacturers,pages/QC,pages/Documents,pages/Payments,pages/Settings,pages/Reports}
mkdir -p src/{components/layout,components/common,components/orders,components/manufacturers,components/qc,components/documents,components/dashboard}
mkdir -p src/{hooks,services,store,types,utils,styles}

# Copy Tailwind config
cp [tailwind.config.js content] tailwind.config.js
cp [postcss.config.js content] postcss.config.js

# Copy App.tsx, main.tsx, and component files
cp [file contents] src/
```

### Step 4: Create .env File

```bash
cat > .env << EOF
VITE_API_URL=http://localhost:5000/api
VITE_APP_NAME=Garm Admin Portal
EOF
```

### Step 5: Start Frontend

```bash
npm run dev

# Expected output:
# VITE v4.x.x  ready in XXXms
# ➜  Local:   http://localhost:5173/
```

---

## Verify Everything Works

### 1. Check Backend API

```bash
# Open new terminal, test API
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Admin User",
    "email": "admin@garm.com",
    "password": "password123",
    "role": "SUPER_ADMIN"
  }'

# Expected response:
# {"user":{"id":"...","name":"Admin User","email":"admin@garm.com"}}
```

### 2. Check Database

```bash
# In another terminal
psql -U admin -d garm_admin

# In PostgreSQL shell
SELECT * FROM users;
SELECT COUNT(*) FROM orders;

\q
```

### 3. Open Frontend in Browser

```bash
# Visit http://localhost:5173/login
# Try login with credentials:
# Email: admin@garm.com
# Password: password123
```

---

## Project Structure Summary

```
garm-admin/
├── backend/
│   ├── src/
│   │   ├── app.ts (Express app)
│   │   ├── server.ts (Entry point)
│   │   ├── routes/ (API endpoints)
│   │   ├── controllers/ (Business logic)
│   │   ├── services/ (External integrations)
│   │   ├── middleware/ (Auth, error handling)
│   │   └── models/ (TypeScript types)
│   ├── prisma/
│   │   ├── schema.prisma (Database schema)
│   │   └── migrations/
│   ├── .env
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── pages/ (Page components)
│   │   ├── components/ (Reusable components)
│   │   ├── hooks/ (Custom hooks)
│   │   ├── services/ (API calls)
│   │   ├── store/ (Redux state)
│   │   ├── styles/ (CSS & Tailwind)
│   │   ├── App.tsx (Routes)
│   │   └── main.tsx (Entry point)
│   ├── public/ (Static assets)
│   ├── .env
│   ├── tailwind.config.js
│   ├── vite.config.ts
│   ├── package.json
│   └── tsconfig.json
│
└── docker-compose.yml
```

---

## Common Commands

### Backend

```bash
cd backend

# Development
npm run dev

# Build
npm run build

# Database
npx prisma studio  # Visual database explorer
npx prisma migrate  # Run migrations
npx prisma reset  # Reset database (dev only)

# Testing
npm test
```

### Frontend

```bash
cd frontend

# Development
npm run dev

# Build
npm run build

# Preview production build
npm run preview

# Testing
npm run test
```

### Docker

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Reset everything
docker-compose down -v
```

---

## Troubleshooting

### Database Connection Error
```bash
# Check PostgreSQL is running
docker ps | grep postgres

# If not running:
docker-compose up -d postgres

# Test connection
psql -U admin -d garm_admin -h localhost
```

### Port Already in Use
```bash
# Backend (5000)
lsof -i :5000
kill -9 <PID>

# Frontend (5173)
lsof -i :5173
kill -9 <PID>

# PostgreSQL (5432)
lsof -i :5432
kill -9 <PID>
```

### Prisma Migration Issues
```bash
# Reset migrations (dev only)
npx prisma migrate reset

# Or manually:
npx prisma db push --force-reset
```

### CORS Errors
Make sure backend `.env` has:
```
GARM_APP_URL=http://localhost:3000
```

And backend `src/app.ts` has:
```typescript
app.use(cors({
  origin: process.env.GARM_APP_URL,
  credentials: true,
}));
```

---

## Next Steps

1. **Create Sample Data**: Run seed scripts to populate with test orders, manufacturers
2. **Implement Features**: Start with Orders module, then add QC, Documents, Payments
3. **Add Garm App Integration**: Set up WebSocket for real-time sync
4. **Deploy**: Use Docker to deploy to AWS/GCP/Azure
5. **Monitor**: Set up error tracking (Sentry) and logging

---

## File Reference

| Document | Purpose |
|----------|---------|
| `GARM_ADMIN_PORTAL_SPEC.md` | Complete feature specification |
| `BACKEND_SETUP_GUIDE.md` | Backend implementation details |
| `FRONTEND_SETUP_GUIDE.md` | Frontend setup with React |
| `QUICK_START.md` | This file - quick setup guide |

---

## Testing the Order Flow

### 1. Create a Customer

```bash
curl -X POST http://localhost:5000/api/customers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "B2B",
    "name": "Acme Corp",
    "email": "orders@acme.com",
    "gstNumber": "27AABCA1234H1Z0"
  }'
```

### 2. Create an Order

```bash
curl -X POST http://localhost:5000/api/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "customer_id_here",
    "items": [
      {
        "productName": "Garm Shirt",
        "size": "L",
        "color": "Black",
        "quantity": 100,
        "unitPrice": 250
      }
    ],
    "total": 25000,
    "tax": 4500,
    "subtotal": 20500
  }'
```

### 3. Assign to Manufacturer

```bash
curl -X POST http://localhost:5000/api/orders/{orderId}/assign-manufacturer \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "manufacturerId": "manufacturer_id_here"
  }'
```

### 4. Start QC Inspection

Visit Frontend → QC → Pending Orders → Start Inspection

### 5. Generate Invoice

Once QC passes, invoice auto-generates. View in Documents → Invoices

### 6. Record Payment

Payments → Record Payment → Select Invoice → Confirm

### 7. Check Order Status

Orders → Select Order → View detail panel showing full order journey

---

## Performance Tips

1. **Database**: Index frequently queried columns (order_status, customer_id, manufacturer_id)
2. **API**: Implement pagination (20-50 items per page)
3. **Frontend**: Use React.memo for expensive components, lazy-load routes
4. **Caching**: Use Redis for manufacturer ratings, product lists
5. **Images**: Optimize with AWS S3 + CloudFront CDN

---

## Support

For issues, refer to:
- `GARM_ADMIN_PORTAL_SPEC.md` → Feature details
- `BACKEND_SETUP_GUIDE.md` → API & database issues
- `FRONTEND_SETUP_GUIDE.md` → UI & component issues

---

**You're ready to start developing!** 🚀

Run these commands in 3 separate terminals:

```bash
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Frontend
cd frontend && npm run dev

# Terminal 3: Database (if using local PostgreSQL)
# No command needed if using Docker
```

Visit `http://localhost:5173/login` and start building! 💪

---

END OF QUICK START
