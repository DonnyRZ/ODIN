# ODIN Tech Stack Overview

## Frontend

- **Next.js (App Router) + React + TypeScript**: Delivers fast routing between the home screen and workspace, supports server components for lighter bundles, and enforces type safety for UI state and API contracts.
- **Tailwind CSS**: Speeds up building the calm, minimalist UI while keeping design tokens centralized (colors, spacing, typography) so the visuals stay on-brand.
- **Canvas + custom selection overlay**: Lightweight HTML canvas/SVG tools for drawing the selection rectangle, showing pixel dimensions, and implementing ratio snapping without heavy dependencies.
- **Zustand (or Jotai) for client state**: Simple, predictable store for managing the current project, history panel, and UI toggles without over-engineering.
- **LocalStorage persistence**: Powers Recent Projects and History in MVP; abstracts cleanly so it can later sync with cloud data if the user signs in.

## Backend / API layer

- **Node.js with Next.js API routes or Fastify/Hono**: Thin orchestration layer to handle uploads, trigger AI generation endpoints, log history, and expose project metadata.
- **Managed Postgres (Supabase) or Firebase**: Ready-made auth + storage for the future “cloud history” goal; start with anonymous usage, seamlessly upgrade to authenticated storage.
- **Object storage (Supabase Storage or S3-compatible)**: Persistent storage for generated visuals when cloud history is enabled; optional for the MVP.

## Supporting Services

- **Authentication provider (Clerk, Supabase Auth, or Firebase Auth)**: Optional login for syncing history; start disabled and flip on when needed.
- **Payments (Stripe or Lemon Squeezy)**: For the future gateway requirement; easy to bolt onto the Node backend once pricing is finalized.

This stack keeps the MVP lean—everything can run with client-side storage and minimal backend logic today—while leaving clean upgrade paths for persistence, collaboration, and monetization.
