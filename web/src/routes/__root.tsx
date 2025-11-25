import { createRootRoute, Link, Outlet } from '@tanstack/react-router'
import { CountdownProvider } from '../utils/CountdownContext'

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  return (
    <CountdownProvider>
      <div className="min-h-screen bg-background text-zinc-100 font-mono">
        <header className="border-b border-border">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <nav className="flex gap-2 font-sans">
              <Link
                to="/"
                className="border-b-2 px-6 py-4 text-sm font-medium transition"
                activeProps={{
                  className: 'border-accent-blue text-white',
                }}
                inactiveProps={{
                  className: 'border-transparent text-zinc-400 hover:text-zinc-200',
                }}
              >
                Live View
              </Link>
              <Link
                to="/configure"
                className="border-b-2 px-6 py-4 text-sm font-medium transition"
                activeProps={{
                  className: 'border-accent-blue text-white',
                }}
                inactiveProps={{
                  className: 'border-transparent text-zinc-400 hover:text-zinc-200',
                }}
              >
                Configure
              </Link>
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
          <Outlet />
        </main>
      </div>
    </CountdownProvider>
  )
}
