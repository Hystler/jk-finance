import Link from "next/link";
import { BarChart3, Database, FileSearch, Gauge, GitBranch, Landmark, Table2 } from "lucide-react";

const navGroups = [
  {
    label: "Dashboard",
    icon: Gauge,
    links: [{ href: "/", label: "Executive" }]
  },
  {
    label: "Model",
    icon: BarChart3,
    links: [
      { href: "/unit-economics", label: "Unit Economics" },
      { href: "/pnl", label: "P&L" },
      { href: "/cashflow", label: "Cashflow" },
      { href: "/break-even", label: "Break-even" },
      { href: "/store-model", label: "Store Model" }
    ]
  },
  {
    label: "Scenarios",
    icon: GitBranch,
    links: [
      { href: "/sensitivity", label: "Sensitivity" },
      { href: "/scenario-builder", label: "Scenario Builder" }
    ]
  },
  {
    label: "Franchise",
    icon: Landmark,
    links: [
      { href: "/franchise", label: "Mode" },
      { href: "/franchisee", label: "Franchisee" },
      { href: "/franchisor", label: "Franchisor" },
      { href: "/investor", label: "Investor View" }
    ]
  },
  {
    label: "Data",
    icon: Database,
    links: [
      { href: "/menu", label: "SKU" },
      { href: "/ingredients", label: "Ingredients" },
      { href: "/recipes", label: "Recipes" },
      { href: "/packaging", label: "Packaging" },
      { href: "/capex", label: "CAPEX" },
      { href: "/opex", label: "OPEX" },
      { href: "/import", label: "Import / Export" }
    ]
  },
  {
    label: "Audit",
    icon: FileSearch,
    links: [{ href: "/audit", label: "Audit" }]
  }
];

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <nav className="nav" aria-label="Main navigation">
        <Link href="/" className="brand"><Table2 size={18} /> JK Finance</Link>
        {navGroups.map((group) => {
          const Icon = group.icon;
          return (
            <div className="navGroup" key={group.label}>
              <span className="navGroupLabel"><Icon size={14} /> {group.label}</span>
              {group.links.map((link) => <Link key={link.href} href={link.href}>{link.label}</Link>)}
            </div>
          );
        })}
      </nav>
      <main className="main">{children}</main>
    </div>
  );
}
