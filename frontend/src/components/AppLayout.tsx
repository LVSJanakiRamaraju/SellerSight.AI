import { NavLink } from "react-router-dom";
import type { ReactNode } from "react";

type NavItem = {
  to: string;
  label: string;
};

const navItems: NavItem[] = [
  { to: "/", label: "Dashboard" },
  { to: "/upload", label: "Upload" },
  { to: "/jobs", label: "Jobs" },
  { to: "/products", label: "Products" },
  { to: "/alerts", label: "Alerts" },
];

function linkClasses(isActive: boolean): string {
  return [
    "block rounded-xl px-4 py-2 text-sm font-semibold transition",
    isActive
      ? "bg-brand-500 text-white shadow-sm"
      : "text-slate-700 hover:bg-slate-100",
  ].join(" ");
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#eefcf9_0,_#f8fafc_40%,_#f8fafc_100%)] text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col md:flex-row">
        <aside className="border-b border-slate-200 bg-white/80 p-5 backdrop-blur md:w-64 md:border-b-0 md:border-r">
          <div className="mb-6">
            <h1 className="text-2xl font-extrabold tracking-tight text-brand-700">SellerSight.AI</h1>
            <p className="text-xs text-slate-500">Product Intelligence Dashboard</p>
          </div>

          <nav className="grid grid-cols-2 gap-2 md:grid-cols-1">
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => linkClasses(isActive)} end={item.to === "/"}>
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="flex-1 p-5 md:p-8">{children}</main>
      </div>
    </div>
  );
}
