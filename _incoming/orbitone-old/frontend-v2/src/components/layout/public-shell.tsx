import { Outlet } from "react-router-dom";

export function PublicShell({ header }: { header?: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      {header}
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-border py-6">
        <div className="mx-auto max-w-7xl px-4 text-center text-sm text-muted sm:px-6 lg:px-8">
          &copy; {new Date().getFullYear()} OrbitOne. Turn every introduction into an opportunity.
        </div>
      </footer>
    </div>
  );
}
