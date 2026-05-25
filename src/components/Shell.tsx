import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";
import { BarChart3, Database, FileSearch, FileUp, Gauge, GitBranch, Landmark, Menu, Table2, TrendingUp, X } from "lucide-react";

const navGroups = [
  {
    label: "Dashboard",
    icon: Gauge,
    href: "/",
    aliases: ["/dashboard"],
    links: [{ href: "/", label: "Executive", description: "Сводка модели" }]
  },
  {
    label: "Forecast",
    icon: TrendingUp,
    href: "/forecast",
    links: [{ href: "/forecast", label: "SKU Forecast", description: "Ручной прогноз SKU" }]
  },
  {
    label: "Model",
    icon: BarChart3,
    href: "/unit-economics",
    links: [
      { href: "/unit-economics", label: "Unit Economics", description: "Маржа заказа и SKU" },
      { href: "/pnl", label: "P&L", description: "Месячный profit bridge" },
      { href: "/cashflow", label: "Cashflow", description: "Возврат инвестиций" },
      { href: "/break-even", label: "Break-even", description: "Необходимый трафик" },
      { href: "/store-model", label: "Store Model", description: "Операционные inputs" }
    ]
  },
  {
    label: "Scenarios",
    icon: GitBranch,
    href: "/sensitivity",
    links: [
      { href: "/sensitivity", label: "Sensitivity", description: "Дельты по параметрам" },
      { href: "/scenario-builder", label: "Scenario Builder", description: "Сравнение сценариев" }
    ]
  },
  {
    label: "Franchise",
    icon: Landmark,
    href: "/franchise",
    links: [
      { href: "/franchise", label: "Franchise Overview", description: "Модель франшизы" },
      { href: "/franchisee", label: "Franchisee", description: "Экономика точки" },
      { href: "/franchisor", label: "Franchisor", description: "Экономика сети" },
      { href: "/investor", label: "Investor View", description: "Внешняя сводка" }
    ]
  },
  {
    label: "Data",
    icon: Database,
    href: "/sku",
    aliases: ["/menu", "/ingredients", "/recipes", "/packaging", "/capex", "/opex"],
    links: [
      { href: "/sku", label: "SKU", description: "Позиции меню" },
      { href: "/ingredients", label: "Ingredients", description: "Закупочные цены" },
      { href: "/recipes", label: "Recipes", description: "Сборка себестоимости" },
      { href: "/packaging", label: "Packaging", description: "Упаковка SKU" },
      { href: "/capex", label: "CAPEX", description: "Opening Investment" },
      { href: "/opex", label: "OPEX", description: "Операционные расходы" }
    ]
  },
  {
    label: "Audit",
    icon: FileSearch,
    href: "/audit",
    aliases: ["/checks"],
    links: [
      { href: "/audit", label: "Model Audit", description: "Группировка проблем" },
      { href: "/audit#data-completeness", label: "Data Completeness", description: "Незаполненные inputs" },
      { href: "/audit#export-readiness", label: "Export Readiness", description: "Блокеры внешнего показа" }
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
          </div>
        </nav>
        {activeGroup.links.length > 1 && (
          <div className="subnavShell" aria-label={`${activeGroup.label} navigation`}>
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
        )}
      </header>
      <main className="main">{children}</main>
    </div>
  );
}
