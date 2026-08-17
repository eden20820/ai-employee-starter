# AI Employee Starter

A production-minded SaaS foundation for creating AI employees from natural-language job descriptions.

## Current milestone

Foundation work now includes:

- Supabase Auth integration
- Multi-tenant organizations and memberships
- Row Level Security
- Employee persistence
- Employee versioning
- Server-side organization resolution
- Typed Supabase clients

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` from `.env.example`.

3. Fill in `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` with the publishable key from the `ai-employee` Supabase project.

4. Run:

```bash
npm run dev
```

5. Open `http://localhost:3000`.

## Security model

Customer data is scoped to an organization. Browser-provided organization IDs are not trusted; tenant membership is verified server-side and enforced again by Postgres RLS.

## Next milestone

Validate authentication end-to-end in the browser, then build the structured Employee Specification and AI-generated Employee Plan.
