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
        className={`bg-background text-foreground font-mono ${isFocusPage ? "fixed inset-0 flex flex-col overflow-hidden" : "min-h-screen"}`}
      >
        <header
          className={`border-b border-border ${isFocusPage ? "shrink-0" : ""}`}
        >
          <div className="mx-auto flex max-w-7xl flex-col px-6 sm:flex-row sm:items-center sm:justify-between lg:px-8">
            <Link
              to="/"
              aria-label="CL Motorsport live view"
              className="w-fit py-3 sm:py-0"
            >
              <img
                src="/cl-motorsport-logo-orange.png"
                alt="CL Motorsport Formula Team"
                className="h-8 w-auto"
              />
            </Link>
            <nav className="flex gap-1 font-sans sm:gap-2">
              <Link
                to="/"
                className="border-b-2 px-3 py-4 text-sm font-medium transition sm:px-5 lg:px-6"
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
                className="border-b-2 px-3 py-4 text-sm font-medium transition sm:px-5 lg:px-6"
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
                className="border-b-2 px-3 py-4 text-sm font-medium transition sm:px-5 lg:px-6"
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
              ? "min-h-0 flex-1 overflow-hidden"
              : "mx-auto max-w-7xl px-6 py-8 lg:px-8"
          }
        >
          <Outlet />
        </main>
      </div>
    </CountdownProvider>
  );
}
