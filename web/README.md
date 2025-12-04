# Motorsport Countdown App

A Cloudflare-native countdown timer application for motorsport events, built with React and TanStack Router.

## Tech Stack

- **React 19** - UI framework
- **TanStack Router** - File-based routing with type safety
- **TypeScript** - Type-safe development
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling
- **Bun** - Package manager and runtime

## Features

- Real-time countdown timers for racing sessions
- Session status tracking (scheduled, running, complete, canceled)
- Configuration interface for managing countdown groups and sessions
- Timezone-aware scheduling
- Designed to integrate with Cloudflare Durable Objects for multi-tab synchronization

## Project Structure

```
src/
├── routes/              # File-based routes (TanStack Router)
│   ├── __root.tsx      # Root layout with navigation
│   ├── index.tsx       # Live countdown view
│   └── configure.tsx   # Session configuration
├── components/          # Reusable UI components
│   ├── ActiveTimer.tsx
│   ├── SessionList.tsx
│   └── StatusBadge.tsx
├── hooks/              # Custom React hooks
│   └── useCountdownTimer.ts
└── utils/              # Utilities and types
    ├── types.ts
    ├── timeUtils.ts
    └── CountdownContext.tsx
```

## Development

```bash
# Install dependencies
bun install

# Start dev server
bun run dev

# Build for production
bun run build

# Preview production build
bun run preview

# Lint code
bun run lint
```

## Routing

This app uses TanStack Router's file-based routing system. Routes are automatically generated from files in the `src/routes/` directory:

- `/` - Live countdown view
- `/configure` - Configuration interface

The route tree is automatically generated in `src/routeTree.gen.ts` by the TanStack Router Vite plugin.
