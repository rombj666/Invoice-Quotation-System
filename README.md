# Hour Coffee Quotation & Invoice System

A full-stack web application for creating Hour Coffee quotations, converting them into invoices, storing structured data in Neon PostgreSQL, and storing uploaded files in Cloudinary.

## Tech Stack

- Frontend: Next.js, TypeScript, Tailwind CSS
- Backend: Node.js, TypeScript, Express
- Database: Neon PostgreSQL
- ORM: Prisma
- File storage: Cloudinary

## Project Structure

- `apps/web`: customer and internal web app
- `apps/api`: backend API
- `packages/shared/pricing`: shared pricing module placeholder
- `packages/shared/types`: shared TypeScript types
- `packages/shared/constants`: shared constants
- `prisma/schema.prisma`: database schema

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy environment variables:

```bash
cp .env.example .env
```

3. Add your Neon PostgreSQL connection string:

```txt
DATABASE_URL=postgresql://...
```

4. Add your Cloudinary credentials:

```txt
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

5. Generate Prisma Client:

```bash
npm run prisma:generate
```

6. Create the database tables:

```bash
npm run prisma:migrate
```

7. Run development apps:

```bash
npm run dev:web
npm run dev:api
```

## Notes For Developers

Keep quotation and invoice logic separate. Shared calculation rules should live in `packages/shared/pricing` so the frontend and backend can use the same source of truth.

Cloudinary upload code should live in `apps/api/src/services/cloudinary.service.ts`.

Invoice PDF generation should live in `apps/api/src/services/invoice-pdf.service.ts`.
