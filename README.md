# ERP Server

Node.js + Express + TypeScript backend for the Shop Management System.

## Prerequisites

- Node.js 20+
- npm
- MongoDB Atlas account (or local MongoDB)

## Setup

```bash
# Install dependencies
npm install

# Copy env file and fill in your values
copy .env.example .env
```

Edit `.env` and set:
- `MONGODB_URI` — your MongoDB Atlas connection string
- `JWT_SECRET` — random string, min 32 characters
- `JWT_REFRESH_SECRET` — different random string, min 32 characters

## Run

```bash
# Development (auto-restart on file change)
npm run dev

# Production build
npm run build
npm start
```

## First-time Setup

After starting the server, create your admin account:

```
POST http://localhost:5000/api/auth/setup
Content-Type: application/json

{
  "name": "Admin",
  "email": "admin@yourshop.com",
  "password": "YourPassword123"
}
```

This only works once — when no users exist.

## API Docs

Swagger UI available at: `http://localhost:5000/api/docs`

## Test

```bash
npm test
```
