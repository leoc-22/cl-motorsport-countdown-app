import { createRootRoute, Link, Outlet } from '@tanstack/react-router'
import { CountdownProvider } from '../utils/CountdownContext'

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  return (
    <CountdownProvider>
      <div className="min-h-screen px-4 py-10 text-slate-100 md:px-10 lg:px-20">
        <div className="mx-auto max-w-6xl space-y-10">
          <header className="space-y-4 text-center md:text-left">
            <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Cloudflare-native Countdown</p>
            <h1 className="font-display text-4xl font-semibold text-white md:text-5xl">
              Plan once. Stay synced everywhere.
            </h1>
            <p className="text-base text-slate-300 md:max-w-3xl">
              Each countdown group is backed by a Durable Object that orchestrates session order, replays state from D1,
              and streams ticks to every tab. This playground view renders mock data so the UI can be iterated independently
              from the Worker.
            </p>

            <nav className="flex gap-4 pt-4">
              <Link
                to="/"
                className="rounded-lg px-4 py-2 text-sm font-medium transition hover:bg-white/10"
                activeProps={{
                  className: 'bg-sky-500/20 text-sky-300',
                }}
                inactiveProps={{
                  className: 'text-slate-300',
                }}
              >
                Live View
              </Link>
              <Link
                to="/configure"
                className="rounded-lg px-4 py-2 text-sm font-medium transition hover:bg-white/10"
                activeProps={{
                  className: 'bg-sky-500/20 text-sky-300',
                }}
                inactiveProps={{
                  className: 'text-slate-300',
                }}
              >
                Configure
              </Link>
            </nav>
          </header>

          <Outlet />
        </div>
      </div>
    </CountdownProvider>
  )
}
