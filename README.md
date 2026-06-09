# UniAbuja Screening System

Online departmental student screening system for the University of Abuja. Built with React + TypeScript + Vite + Tailwind CSS + Supabase.

## Features

- **Student portal**: upload documents, track clearance status, download Form 01
- **Officer portal**: review documents, approve/query, manage clearance queue
- **HOD portal**: analytics dashboard, officer management, activity logs, reports
- **Role-based auth**: students (reg no login), officers/HOD (email login)

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS 3, lucide-react
- **Backend**: Supabase (Auth, PostgreSQL, Storage)
- **PDF**: jspdf

## Setup

### Prerequisites

- Node.js 18+
- Supabase project

### 1. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/uniabuja-screening.git
cd uniabuja-screening
npm install
```

### 2. Configure Supabase

Create a `.env` file:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Database setup

Run these SQL scripts in your Supabase SQL Editor **in order**:

1. `supabase/schema.sql` — tables, enums, indexes, RLS policies
2. `supabase/storage.sql` — storage bucket for document uploads
3. `supabase/seed.sql` — demo data (idempotent)

### 4. Seed demo users

```bash
npm run setup
```

Prompts for your Supabase `service_role` key (found in Dashboard > Settings > API).

### 5. Start dev server

```bash
npm run dev
```

### Demo credentials

```
Student:   Reg No: 2023/123456AB  | Password: student123
Officer:   adebayo@uniabuja.edu.ng | Password: officer123
HOD:       hod@uniabuja.edu.ng     | Password: hod123
```

## Build for production

```bash
npm run build
```

Output in `dist/`. Deploy to Vercel with zero config — `vercel.json` handles SPA routing.

## Project Structure

```
src/
  App.tsx               — root with auth + routing
  components/
    LoginPage.tsx        — role-based login
    StudentDashboard.tsx — student portal
    OfficerDashboard.tsx — officer clearance
    HodDashboard.tsx     — HOD analytics
  lib/
    supabase.ts          — client init
    db.ts                — API service layer (40+ functions)
supabase/
  schema.sql             — DB schema + RLS
  storage.sql            — Storage bucket + policies
  seed.sql               — idempotent seed data
  cleanup.sql            — reset for re-seeding
  migrate-docs-to-14.sql — document list migration
scripts/
  setup-demo-users.js    — creates auth users + profiles
```
