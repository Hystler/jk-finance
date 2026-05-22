import { useState } from "react";
import { Shell } from "@/pages/index";
import { loadModel } from "@/lib/model";
import { calculateModelReadiness } from "@/lib/readiness";

const groupNames = [
  "All",
  "Data completeness",
  "Calculation consistency",
  "SKU margin issues",
  "Missing recipes",
  "Missing packaging",
  "Suspicious assumptions",
  "Negative EBITDA SKU",
  "Invalid payback",
  "Export readiness",
  "Investor readiness"
];

export async function getServerSideProps() {
  const data = await loadModel();
  const readiness = calculateModelReadiness({
    products: data.products,
    economics: data.economics,
    capex: data.capex,
    opex: data.opex,
    store: data.store,
    model: data.model,
    checks: data.checks,
    franchiseMissingWarnings: data.franchiseModel.missingDataWarnings
  });
  const checks = [
    ...data.checks.map((check) => ({ ...check, source: "Store Model" })),
    ...data.franchiseModel.checks.map((check: any) => ({ ...check, category: "Franchise", source: "Franchise" })),
    ...data.franchiseModel.missingDataWarnings.map((message: string) => ({ severity: "warning", code: "FRANCHISE_MISSING_DATA", message, category: "Franchise", source: "Franchise" })),
    ...(!readiness.isInvestorReady && readiness.investorWarning
      ? [{ severity: "warning", code: "MODEL_READINESS_BELOW_80", message: `${readiness.investorWarning} Model Readiness: ${readiness.score}%.`, category: "Investor readiness", source: "Readiness guard" }]
      : [])
  ];
  return { props: { checks } };
}

export default function AuditPage({ checks }: any) {
  const [filter, setFilter] = useState("All");
  const summary = buildSummary(checks);
  const groups = buildGroups(checks);
  const visibleGroups = filter === "All" ? groups : groups.filter((group) => group.name === filter);

  return (
    <Shell>
      <div className="pageHeader">
        <div>
          <h1>Audit</h1>
          <p>Группировка проверок по Data Completeness, Calculation Consistency, SKU margin, Export Readiness и Investor Readiness.</p>
        </div>
      </div>
      <div className="metrics">
        <Metric title="Critical" value={String(summary.critical)} />
        <Metric title="Warnings" value={String(summary.warning)} />
        <Metric title="Info" value={String(summary.info)} />
        <Metric title="Recipes missing" value={String(summary.recipesMissing)} />
        <Metric title="Packaging missing" value={String(summary.packagingMissing)} />
        <Metric title="Negative EBITDA SKU" value={String(summary.negativeEbitdaSku)} />
        <Metric title="Suspicious margin" value={String(summary.suspiciousMargin)} />
      </div>
      <section className="band">
        <div className="segmented wrap">
          {groupNames.map((name) => <button key={name} className={filter === name ? "active" : ""} onClick={() => setFilter(name)}>{name}</button>)}
        </div>
        <div className="auditGroups">
          {visibleGroups.map((group) => (
            <div className="auditGroup" id={groupId(group.name)} key={group.name}>
              <div className="sectionHead"><h2>{group.name}</h2><span>{group.items.length} уникальных проблем</span></div>
              <div className="checks">
                {group.items.map((item) => (
                  <div className={`check ${item.severity}`} key={`${group.name}-${item.code}-${item.message}`}>
                    <strong>{item.severity}</strong>
                    <span>{item.code}</span>
                    <span>{item.message}</span>
                    {item.count > 1 && <span className="pill">{item.count} похожих</span>}
                  </div>
                ))}
                {!group.items.length && <div className="check info">В этой группе проблем не найдено.</div>}
              </div>
            </div>
          ))}
        </div>
      </section>
    </Shell>
  );
}

function buildSummary(checks: any[]) {
  return {
    critical: checks.filter((check) => check.severity === "critical").length,
    warning: checks.filter((check) => check.severity === "warning").length,
    info: checks.filter((check) => check.severity === "info").length,
    recipesMissing: checks.filter((check) => check.code === "MISSING_RECIPE").length,
    packagingMissing: checks.filter((check) => check.code === "MISSING_PACKAGING").length,
    negativeEbitdaSku: checks.filter((check) => check.code === "NEGATIVE_SKU_EBITDA").length,
    suspiciousMargin: checks.filter((check) => ["FAKE_HIGH_MARGIN", "FOOD_COST_HIGH", "PACKAGING_COST_HIGH", "LOW_EBITDA_MARGIN"].includes(check.code)).length
  };
}

function buildGroups(checks: any[]) {
  const specs = [
    { name: "Data completeness", match: (check: any) => /MISSING|EMPTY|ZERO|AVG_ITEMS_ZERO/.test(check.code) },
    { name: "Calculation consistency", match: (check: any) => /PERCENT|VARIABLE_COSTS_OVER_REVENUE|TOTAL_COST_OVER_PRICE/.test(check.code) },
    { name: "SKU margin issues", match: (check: any) => /MARGIN|FOOD_COST_HIGH|PACKAGING_COST_HIGH|TOTAL_COST_OVER_PRICE|NEGATIVE_SKU/.test(check.code) },
    { name: "Missing recipes", match: (check: any) => /MISSING_RECIPE|ZERO_INGREDIENT_COST|FAKE_HIGH_MARGIN/.test(check.code) },
    { name: "Missing packaging", match: (check: any) => /MISSING_PACKAGING|ZERO_PACKAGING/.test(check.code) },
    { name: "Suspicious assumptions", match: (check: any) => /HIGH|OVER_100|RENT_RATIO|PAYROLL_RATIO|TAX_LOAD|COMMISSION/.test(check.code) },
    { name: "Negative EBITDA SKU", match: (check: any) => check.code === "NEGATIVE_SKU_EBITDA" },
    { name: "Invalid payback", match: (check: any) => /PAYBACK|NEGATIVE_CF/.test(check.code) },
    { name: "Export readiness", match: (check: any) => check.severity === "critical" || /MISSING|EMPTY|ZERO/.test(check.code) },
    { name: "Investor readiness", match: (check: any) => check.severity === "critical" || /FRANCHISE|PAYBACK|NEGATIVE|MISSING/.test(check.code) }
  ];
  return specs.map((spec) => ({
    name: spec.name,
    items: dedupe(checks.filter(spec.match))
  }));
}

function dedupe(checks: any[]) {
  const map = new Map<string, any>();
  checks.forEach((check) => {
    const family = `${check.code}-${normalizeMessage(check.message)}`;
    const existing = map.get(family);
    if (existing) existing.count += 1;
    else map.set(family, { ...check, count: 1 });
  });
  return Array.from(map.values()).slice(0, 12);
}

function normalizeMessage(message: string) {
  return message.replace(/^.*?:\s*/, "").replace(/[А-Яа-яA-Za-z0-9 _-]+ SKU/g, "SKU").trim();
}

function groupId(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function Metric({ title, value }: { title: string; value: string }) {
  return <div className="metric"><span>{title}</span><strong>{value}</strong></div>;
}
