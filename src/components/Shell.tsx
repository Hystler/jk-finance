import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";
import { BarChart3, Database, Download, Eye, FileSearch, FileUp, Gauge, GitBranch, Landmark, Menu, Table2, X } from "lucide-react";

const navGroups = [
  {
    label: "Dashboard",
    icon: Gauge,
    href: "/",
    aliases: ["/dashboard"],
    links: [{ href: "/", label: "Executive", description: "Executive summary" }]
  },
  {
    label: "Model",
    icon: BarChart3,
    href: "/unit-economics",
    links: [
      { href: "/unit-economics", label: "Unit Economics", description: "Per-order margin" },
      { href: "/pnl", label: "P&L", description: "Monthly profit bridge" },
      { href: "/cashflow", label: "Cashflow", description: "Investment recovery" },
      { href: "/break-even", label: "Break-even", description: "Required traffic" },
      { href: "/store-model", label: "Store Model", description: "Operating inputs" }
    ]
  },
  {
    label: "Scenarios",
    icon: GitBranch,
    href: "/sensitivity",
    links: [
      { href: "/sensitivity", label: "Sensitivity", description: "Parameter deltas" },
      { href: "/scenario-builder", label: "Scenario Builder", description: "Case comparison" }
    ]
  },
  {
    label: "Franchise",
    icon: Landmark,
    href: "/franchise",
    links: [
      { href: "/franchise", label: "Overview", description: "Franchise model" },
      { href: "/franchisee", label: "Franchisee", description: "Unit economics" },
      { href: "/franchisor", label: "Franchisor", description: "Network economics" },
      { href: "/investor", label: "Investor View", description: "External summary" }
    ]
  },
  {
    label: "Data",
    icon: Database,
    href: "/sku",
    aliases: ["/menu", "/ingredients", "/recipes", "/packaging", "/capex", "/opex"],
    links: [
      { href: "/sku", label: "SKU", description: "Menu items" },
      { href: "/ingredients", label: "Ingredients", description: "Food costs" },
      { href: "/recipes", label: "Recipes", description: "Cost build-up" },
      { href: "/packaging", label: "Packaging", description: "SKU packaging" },
      { href: "/capex", label: "CAPEX", description: "Opening investment" },
      { href: "/opex", label: "OPEX", description: "Operating costs" }
    ]
  },
  {
    label: "Audit",
    icon: FileSearch,
    href: "/audit",
    aliases: ["/checks"],
    links: [
      { href: "/audit", label: "Model Audit", description: "Grouped issues" },
      { href: "/audit#data-completeness", label: "Data Completeness", description: "Missing inputs" },
      { href: "/audit#export-readiness", label: "Export Readiness", description: "Investor blockers" }
    ]
  }
];

export function Shell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const currentPath = router.pathname;
  const isPathActive = (href: string) => {
    const [path, hash] = href.split("#");
    if (hash) return router.asPath === href;
    if (path === "/") return currentPath === "/";
    if (path === "/sku") return currentPath === "/sku" || currentPath === "/menu" || currentPath.startsWith("/sku/");
    return currentPath === path || currentPath.startsWith(`${path}/`);
  };
  const activeGroup = navGroups.find((group) =>
    isPathActive(group.href) || group.links.some((link) => isPathActive(link.href)) || group.aliases?.some((alias) => isPathActive(alias))
  ) ?? navGroups[0];

  return (
    <div>
      <header className={`navShell ${menuOpen ? "open" : ""}`}>
        <nav className="nav" aria-label="Main navigation">
          <Link href="/" className="brand" onClick={() => setMenuOpen(false)}><Table2 size={18} /> JK Finance</Link>
          <button className="mobileMenuButton" type="button" aria-expanded={menuOpen} aria-label="Toggle navigation" onClick={() => setMenuOpen((value) => !value)}>
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          <div className="navMain">
            {navGroups.map((group) => {
              const Icon = group.icon;
              return (
                <Link
                  className={activeGroup.label === group.label ? "active" : ""}
                  href={group.href}
                  key={group.label}
                  onClick={() => setMenuOpen(false)}
                >
                  <Icon size={15} /> {group.label}
                </Link>
              );
            })}
          </div>
          <div className="navActions">
            <Link href="/import" onClick={() => setMenuOpen(false)}><FileUp size={15} /> Import</Link>
            <a href="/api/export/full" onClick={() => setMenuOpen(false)}><Download size={15} /> Export XLSX</a>
            <Link className="investorNavAction" href="/investor" onClick={() => setMenuOpen(false)}><Eye size={15} /> Investor View</Link>
          </div>
        </nav>
        <div className="subnavShell" aria-label={`${activeGroup.label} navigation`}>
          <div className="subnavHeader">
            <span>{activeGroup.label}</span>
            <strong>{activeGroup.links.length} modules</strong>
          </div>
          <div className="subnavGrid">
            {activeGroup.links.map((link) => (
              <Link
                className={isPathActive(link.href) ? "active" : ""}
                href={link.href}
                key={link.href}
                onClick={() => setMenuOpen(false)}
              >
                <span>{link.label}</span>
                <small>{link.description}</small>
              </Link>
            ))}
          </div>
        </div>
      </header>
      <main className="main">{children}</main>
    </div>
  );
}
