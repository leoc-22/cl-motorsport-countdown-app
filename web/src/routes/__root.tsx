import {
  createRootRoute,
  Link,
  Outlet,
  useRouterState,
} from "@tanstack/react-router";
import { CountdownProvider } from "../utils/CountdownContext";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  const router = useRouterState();
  const isFocusPage = router.location.pathname === "/focus";

  return (
    <CountdownProvider>
      <div
        className={`bg-background text-foreground font-mono ${isFocusPage ? "h-screen overflow-hidden" : "min-h-screen"}`}
      >
        <header className="border-b border-border">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <nav className="flex gap-2 font-sans">
              <Link
                to="/"
                className="border-b-2 px-6 py-4 text-sm font-medium transition"
                activeProps={{
                  className: "border-accent-blue text-foreground",
                }}
                inactiveProps={{
                  className:
                    "border-transparent text-subtle hover:text-foreground",
                }}
              >
                Live View
              </Link>
              <Link
                to="/focus"
                className="border-b-2 px-6 py-4 text-sm font-medium transition"
                activeProps={{
                  className: "border-accent-blue text-foreground",
                }}
                inactiveProps={{
                  className:
                    "border-transparent text-subtle hover:text-foreground",
                }}
              >
                Focus Mode
              </Link>
              <Link
                to="/configure"
                className="border-b-2 px-6 py-4 text-sm font-medium transition"
                activeProps={{
                  className: "border-accent-blue text-foreground",
                }}
                inactiveProps={{
                  className:
                    "border-transparent text-subtle hover:text-foreground",
                }}
              >
                Configure
              </Link>
            </nav>
          </div>
        </header>

        <main
          className={
            isFocusPage
              ? "h-[calc(100vh-57px)]"
              : "mx-auto max-w-7xl px-6 py-8 lg:px-8"
          }
        >
          <Outlet />
        </main>
      </div>
    </CountdownProvider>
  );
}
