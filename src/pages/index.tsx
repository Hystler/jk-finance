import Link from "next/link";
import { AlertTriangle, Download, FileUp } from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { loadModel } from "@/lib/model";
import { truncateSkuName } from "@/lib/charts";
import { num, percent, rub } from "@/lib/format";
import { calculateModelReadiness } from "@/lib/readiness";
import { Shell } from "@/components/Shell";

export { Shell } from "@/components/Shell";

type KpiCard = {
  title: string;
  value: string;
  note?: string;
  tone?: "positive" | "negative";
  badge?: string;
  subtext?: string;
  tooltip?: string;
};

export async function getServerSideProps() {
  const data = await loadModel();
  return {
    props: {
      summary: data.model,
      checks: data.checks,
      diagnostics: data.diagnostics,
      economics: data.economics,
      sensitivity: data.sensitivity,
      cashflow: data.model.cumulativeCashflow.slice(0, 24),
      franchiseModel: data.franchiseModel,
      products: data.products,
      capex: data.capex,
      opex: data.opex,
      store: data.store
    }
  };
}

export default function Dashboard({ summary, checks, diagnostics, economics, sensitivity, cashflow, franchiseModel, products, capex, opex, store }: any) {
  const withCosts = economics.filter((sku: any) => sku.ingredientCost > 0 || sku.packagingCost > 0);
  const top = [...withCosts].sort((a, b) => b.ebitdaPerItem - a.ebitdaPerItem).slice(0, 10);
  const weak = [...withCosts].sort((a, b) => a.contributionMarginPercent - b.contributionMarginPercent).slice(0, 5);
  const activeSkuCount = products.filter((sku: any) => sku.isActive !== false).length;
  const missingRecipeCount = economics.filter((sku: any) => !sku.hasRecipe).length;
  const missingPackagingCount = economics.filter((sku: any) => !sku.hasPackaging).length;
  const negativeEbitdaCount = economics.filter((sku: any) => sku.ebitdaPerItem < 0).length;
  const opexIncomplete = !opex.some((row: any) => Number(row.amount ?? 0) > 0) || summary.fixedCosts <= 0;
  const forecast = Array.from({ length: 12 }, (_, index) => ({
    month: index + 1,
    revenue: summary.monthlyRevenue,
    ebitda: summary.ebitda,
    cashflow: summary.operatingCashflow,
    cumulativeCashflow: cashflow[index]?.cumulativeCashflow ?? 0
  }));
  const expenseStructure = [
    { name: "Food cost", value: summary.foodCostTotal },
    { name: "Packaging", value: summary.packagingTotal },
    { name: "Variable costs", value: summary.variableCosts },
    { name: "Fixed costs", value: summary.fixedCosts },
    { name: "Taxes", value: summary.taxPaid },
    { name: "Depreciation", value: summary.monthlyDepreciation }
  ].filter((item) => item.value > 0);
  const breakEven = Array.from({ length: 9 }, (_, index) => {
    const ordersPerDay = Math.max(0, Math.round((summary.breakEvenOrdersPerDay ?? 50) * (0.4 + index * 0.15)));
    const revenue = ordersPerDay * (summary.monthlyRevenue / Math.max(summary.monthlyOrders, 1)) * 30;
    const scale = summary.monthlyRevenue > 0 ? revenue / summary.monthlyRevenue : 0;
    return { ordersPerDay, ebitda: summary.ebitda * scale + summary.fixedCosts * (scale - 1) };
  });
  const hasSkuCosts = withCosts.length > 0;
  const skuRanking = top.map((row: any) => ({
    shortName: truncateSkuName(row.name, 28),
    fullName: row.name,
    ebitdaPerItem: row.ebitdaPerItem
  }));
  const skuChartHeight = Math.max(320, skuRanking.length * 36);
  const tornado = sensitivity
    .map((row: any) => ({ parameter: truncateSkuName(row.parameter, 26), fullName: row.parameter, impact: row.impactOnEbitda ?? 0 }))
    .sort((a: any, b: any) => Math.abs(b.impact) - Math.abs(a.impact))
    .slice(0, 8);
  const tornadoHeight = Math.max(320, tornado.length * 42);
  const franchisePayback = franchiseModel?.franchisee?.cumulativeCashflow24 ?? [];
  const hasFranchisePreview = franchisePayback.some((row: any) => row.openingInvestment > 0 || row.cumulativeCashflow !== 0);
  const readiness = calculateModelReadiness({
    products,
    economics,
    capex,
    opex,
    store,
    model: summary,
    checks,
    franchiseMissingWarnings: franchiseModel.missingDataWarnings
  });
  const completeness = readiness.items;
  const isDraftModel = readiness.score < 80 || !readiness.isInvestorReady;
  const draftTooltip = "Расчёт предварительный: не заполнены рецептуры или упаковка.";
  const foodCostDraftText = missingRecipeCount > 0 || missingPackagingCount > 0
    ? "Расчёт предварительный: не заполнены рецептуры или упаковка."
    : undefined;
  const ebitdaSubtext = opexIncomplete
    ? "EBITDA incomplete: OPEX не заполнен."
    : foodCostDraftText;
  const mainKpis: KpiCard[] = [
    { title: "Monthly Revenue", value: rub(summary.monthlyRevenue), note: "Текущий base case" },
    { title: "EBITDA", value: rub(summary.ebitda), note: percent(summary.ebitdaMargin), tone: summary.ebitda < 0 ? "negative" : "positive", badge: isDraftModel ? "Draft estimate" : undefined, subtext: ebitdaSubtext, tooltip: draftTooltip },
    { title: "Payback", value: summary.paybackMonth ? `${summary.paybackMonth} мес.` : "n/a", note: "Возврат Opening Investment", badge: isDraftModel ? "Draft estimate" : undefined, subtext: foodCostDraftText, tooltip: draftTooltip },
    { title: "ROI", value: summary.roi == null ? "n/a" : percent(summary.roi), note: "Годовая доходность Cashflow", tone: summary.roi != null && summary.roi < 0 ? "negative" : "positive", badge: isDraftModel ? "Draft estimate" : undefined, subtext: foodCostDraftText, tooltip: draftTooltip }
  ];
  const secondaryKpis: KpiCard[] = [
    { title: "Gross Profit", value: rub(summary.grossProfit) },
    { title: "Operating Cashflow", value: rub(summary.operatingCashflow), tone: summary.operatingCashflow < 0 ? "negative" : "positive" },
    { title: "Opening Investment", value: rub(summary.initialInvestment) },
    { title: "Break-even / day", value: summary.breakEvenOrdersPerDay == null ? "n/a" : `${Math.ceil(summary.breakEvenOrdersPerDay)} заказов`, note: summary.breakEvenUnavailableReason ? translateBreakEvenReason(summary.breakEvenUnavailableReason) : undefined },
    { title: "Active SKU", value: num(activeSkuCount, 0) },
    { title: "Нет рецептуры", value: num(missingRecipeCount, 0), tone: missingRecipeCount > 0 ? "negative" : "positive" },
    { title: "Negative EBITDA SKU", value: num(negativeEbitdaCount, 0), tone: negativeEbitdaCount > 0 ? "negative" : "positive" },
    { title: "Model Readiness", value: `${readiness.score}%`, note: readiness.status },
    { title: "Investor-grade status", value: readiness.isInvestorReady ? "true" : "false", tone: readiness.isInvestorReady ? "positive" : "negative" }
  ];
  const modelDiagnostics = buildModelDiagnostics({
    readiness,
    missingRecipeCount,
    missingPackagingCount,
    opexIncomplete,
    breakEvenReason: summary.breakEvenUnavailableReason,
    sensitivity
  });

  return (
    <Shell>
      <section className="heroPanel">
        <div className="heroContent">
          <div>
            <div className="eyebrow">Premium franchise analytics</div>
            <h1>JK Finance</h1>
            <p>Финансовая модель франшизы: Unit Economics, Forecast, Investor Readiness, сценарии и контроль Operating Cashflow.</p>
          </div>
          <div className="heroControls">
            <label className="scenarioSelect">Scenario
              <select defaultValue="Base Case" aria-label="Scenario selector">
                <option>Base Case</option>
                <option>Demo</option>
                <option>Conservative</option>
                <option>Aggressive</option>
              </select>
            </label>
            <div className="actions">
              <a className="button primary" href="/api/export/full"><Download size={16} /> Export XLSX</a>
              <Link className="button" href="/import"><FileUp size={16} /> Import</Link>
            </div>
          </div>
        </div>
      </section>

      <div className="metrics mainKpis">
        {mainKpis.map((item) => <Metric key={item.title} {...item} />)}
      </div>

      <div className="metrics secondaryKpis">
        {secondaryKpis.map((item) => <Metric key={item.title} {...item} />)}
      </div>

      <section className="band">
        <div className="sectionHead">
          <h2>Executive summary</h2>
          <span>{readiness.status}</span>
        </div>
        <div className="summaryGrid">
          <div>
            <strong>{activeSkuCount}</strong>
            <span>активных SKU</span>
          </div>
          <div>
            <strong>{missingRecipeCount}</strong>
            <span>нет рецептуры</span>
          </div>
          <div>
            <strong>{negativeEbitdaCount}</strong>
            <span>SKU с отрицательной EBITDA</span>
          </div>
          <div>
            <strong>{checks.filter((check: any) => check.severity === "critical").length}</strong>
            <span>критичных проверок</span>
          </div>
        </div>
        <div className="actions modelLinks">
          <Link className="button" href="/unit-economics">Unit Economics</Link>
          <Link className="button" href="/pnl">P&L</Link>
          <Link className="button" href="/cashflow">Cashflow</Link>
          <Link className="button" href="/break-even">Break-even</Link>
          <Link className="button" href="/audit">Audit</Link>
        </div>
      </section>

      <section className="band">
        <div className="sectionHead">
          <h2>Model Readiness</h2>
          <span>{readiness.status}</span>
        </div>
        <div className="readinessPanel">
          <div>
            <div className="readinessScore">
              <div>
                <strong>{readiness.score}%</strong>
                <span>overall readiness</span>
              </div>
            </div>
            {!readiness.isInvestorReady && <div className="readinessWarning">{readiness.investorWarning}</div>}
          </div>
          <div className="progressGrid">
            {completeness.slice(0, 6).map((item) => <ProgressCard key={item.label} {...item} />)}
          </div>
        </div>
      </section>

      <section className="band">
        <div className="sectionHead">
          <h2>Revenue / EBITDA / Cashflow</h2>
          <span>12 месяцев на базе текущих assumptions</span>
        </div>
        <div className="chart">
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={forecast} margin={{ top: 16, right: 24, bottom: 8, left: 12 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={(value) => compactRub(Number(value))} width={82} />
              <Tooltip formatter={(value: number) => rub(value)} />
              <Legend />
              <Bar dataKey="revenue" fill="#D6B56D" name="Revenue" radius={[8, 8, 0, 0]} />
              <Line type="monotone" dataKey="ebitda" stroke="#7FB069" strokeWidth={2.5} dot={false} name="EBITDA" />
              <Line type="monotone" dataKey="cashflow" stroke="#C86B5A" strokeWidth={2.5} dot={false} name="Cashflow" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      <ModelDiagnostics diagnostics={modelDiagnostics} />

      <div className="twoCol">
        <section className="band">
          <h2>Структура расходов</h2>
          <div className="chart">
            {expenseStructure.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={expenseStructure} dataKey="value" nameKey="name" innerRadius={54} outerRadius={92}>
                    {expenseStructure.map((_: any, index: number) => <Cell key={index} fill={["#D6B56D", "#E8D8B0", "#C86B5A", "#7FB069", "#D99A3D", "#8F7A4A"][index % 6]} />)}
                  </Pie>
                  <Tooltip formatter={(value: number) => rub(value)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : <div className="emptyState">Заполните SKU, OPEX и Tax settings, чтобы увидеть структуру расходов.</div>}
          </div>
        </section>
        <section className="band">
          <h2>Break-even</h2>
          <div className="chart">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={breakEven} margin={{ top: 16, right: 24, bottom: 8, left: 12 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="ordersPerDay" />
                <YAxis tickFormatter={(value) => compactRub(Number(value))} width={82} />
                <Tooltip formatter={(value: number) => rub(value)} />
                <ReferenceLine y={0} stroke="#C86B5A" />
                <Line type="monotone" dataKey="ebitda" stroke="#D6B56D" strokeWidth={2.5} dot />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <div className="twoCol">
        <section className="band">
          <h2>SKU economics chart</h2>
          {!hasSkuCosts ? (
            <div className="emptyState">Заполните рецептуры SKU, чтобы увидеть рейтинг маржинальности.</div>
          ) : (
            <>
              {economics.length > 10 && <Link className="subtleLink" href="/menu">Показать все в таблице</Link>}
              <div className="chart" style={{ height: skuChartHeight }}>
                <ResponsiveContainer width="100%" height={skuChartHeight}>
                  <BarChart data={skuRanking} layout="vertical" margin={{ left: 18, right: 18 }}>
                    <CartesianGrid horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(value) => rub(Number(value))} />
                    <YAxis type="category" dataKey="shortName" width={220} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(value: number) => rub(value)} labelFormatter={(_, payload: any) => payload?.[0]?.payload?.fullName ?? ""} />
                    <ReferenceLine x={0} stroke="#706B64" />
                    <Bar dataKey="ebitdaPerItem" name="EBITDA / item" fill="#7FB069" radius={[0, 8, 8, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </section>
        <section className="band">
          <h2>Sensitivity tornado</h2>
          <div className="chart" style={{ height: tornadoHeight }}>
            <ResponsiveContainer width="100%" height={tornadoHeight}>
              <BarChart data={tornado} layout="vertical" margin={{ left: 18, right: 18 }}>
                <CartesianGrid horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(value) => compactRub(Number(value))} />
                <YAxis type="category" dataKey="parameter" width={210} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: number) => rub(value)} labelFormatter={(_, payload: any) => payload?.[0]?.payload?.fullName ?? ""} />
                <Bar dataKey="impact">
                  {tornado.map((row: any, index: number) => <Cell key={index} fill={row.impact < 0 ? "#C86B5A" : "#7FB069"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <div className="twoCol">
        <section className="band">
          <h2>Franchise payback preview</h2>
          {hasFranchisePreview ? (
            <div className="chart">
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={franchisePayback} margin={{ top: 16, right: 24, bottom: 8, left: 12 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="month" tickFormatter={(value) => `M${value}`} />
                  <YAxis tickFormatter={(value) => compactRub(Number(value))} width={82} />
                  <Tooltip formatter={(value: number) => rub(value)} labelFormatter={(label) => `Month ${label}`} />
                  <ReferenceLine y={0} stroke="#C86B5A" strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="cumulativeCashflow" stroke="#D6B56D" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="emptyState"><Link className="button primary" href="/franchise">Заполнить Franchise Mode</Link></div>
          )}
        </section>
        <section className="band">
          <h2>Data completeness</h2>
          <div className="progressGrid">
            {completeness.map((item) => <ProgressCard key={item.label} {...item} />)}
          </div>
        </section>
      </div>

      <div className="twoCol">
        <section className="band">
          <h2>Top profitable SKU</h2>
          <SimpleSkuList rows={top} />
        </section>
        <section className="band">
          <h2>Weak SKU by margin</h2>
          <SimpleSkuList rows={weak} />
        </section>
      </div>

      <section className="band">
        <div className="sectionHead">
          <h2>Audit</h2>
          <Link href="/audit">Открыть Audit</Link>
        </div>
        <div className="checks">
          {checks.slice(0, 10).map((check: any) => (
            <div className={`check ${check.severity}`} key={`${check.code}-${check.message}`}>
              <AlertTriangle size={16} />
              <span>{check.message}</span>
            </div>
          ))}
          {!checks.length && <p>Критичных проверок нет.</p>}
        </div>
      </section>
    </Shell>
  );
}

function ModelDiagnostics({ diagnostics }: { diagnostics: ReturnType<typeof buildModelDiagnostics> }) {
  return (
    <section className={`band ${diagnostics.isReady ? "successPanelSoft" : "warningPanel"}`}>
      <div className="sectionHead">
        <h2>Model Diagnostics</h2>
        <span>{diagnostics.status}</span>
      </div>
      <p className="diagnosticLead">{diagnostics.message}</p>
      <div className="checks">
        {diagnostics.blockers.map((item) => <div className={`check ${item.severity}`} key={item.message}>{item.message}</div>)}
      </div>
    </section>
  );
}

function Metric({ title, value, note, tone, badge, subtext, tooltip }: KpiCard) {
  return (
    <div className="metric" title={tooltip}>
      <span>{title}</span>
      <strong className={tone}>{value}</strong>
      {badge && <em className="draftBadge">{badge}</em>}
      {note && <small>{note}</small>}
      {subtext && <small className="metricSubtext">{subtext}</small>}
    </div>
  );
}

function SimpleSkuList({ rows }: { rows: any[] }) {
  return (
    <table>
      <tbody>
        {rows.map((row) => (
          <tr key={row.productId}>
            <td>{row.name}</td>
            <td>{rub(row.ebitdaPerItem)}</td>
            <td>{percent(row.ebitdaMarginPercent)}</td>
          </tr>
        ))}
        {!rows.length && <tr><td>Нет SKU</td></tr>}
      </tbody>
    </table>
  );
}

function ProgressCard({ label, done, total }: { label: string; done: number; total: number }) {
  const safeTotal = Math.max(total, 1);
  const pct = Math.min(100, Math.round((done / safeTotal) * 100));
  return (
    <div className="progressCard">
      <div><strong>{label}</strong><span>{done} / {safeTotal}</span></div>
      <div className="progressTrack"><span style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

function compactRub(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${num(value / 1_000_000, 1)}M`;
  if (abs >= 1_000) return `${num(value / 1_000, 0)}k`;
  return num(value, 0);
}

function buildModelDiagnostics(input: {
  readiness: any;
  missingRecipeCount: number;
  missingPackagingCount: number;
  opexIncomplete: boolean;
  breakEvenReason?: string | null;
  sensitivity: any[];
}) {
  const blockers: Array<{ severity: "info" | "warning" | "critical"; message: string }> = [];
  if (input.missingRecipeCount > 0) blockers.push({ severity: "warning", message: `Нет рецептуры: ${input.missingRecipeCount} SKU.` });
  if (input.missingPackagingCount > 0) blockers.push({ severity: "warning", message: `Нет упаковки: ${input.missingPackagingCount} SKU.` });
  if (input.opexIncomplete) blockers.push({ severity: "critical", message: "OPEX incomplete: заполните постоянные расходы, чтобы EBITDA стала достоверной." });
  if (input.breakEvenReason) blockers.push({ severity: "warning", message: translateBreakEvenReason(input.breakEvenReason) });
  const incompleteSensitivity = input.sensitivity.filter((row) => !row.driverAvailable && ["Rent", "Payroll", "Aggregator Commission"].includes(row.parameter));
  if (incompleteSensitivity.length) {
    blockers.push({ severity: "warning", message: `Sensitivity drivers incomplete: ${incompleteSensitivity.map((row) => row.parameter).join(", ")}.` });
  }

  const isReady = input.readiness.isInvestorReady && blockers.length === 0;
  const status = isReady
    ? "Готова"
    : input.readiness.score >= 55
      ? "Черновая"
      : "Не готова для внешнего показа";
  const message = isReady
    ? "Модель готова к внешнему показу: ключевые блоки заполнены, KPI можно использовать как рабочую investor-grade оценку."
    : "Модель не готова для внешнего показа. Заполните рецептуры, упаковку и OPEX, чтобы расчёты EBITDA, ROI и Payback стали достоверными.";

  return {
    isReady,
    status,
    message,
    blockers: blockers.length ? blockers : [{ severity: "info" as const, message: "Критичных блокеров не найдено. Проверьте assumptions перед внешним показом." }]
  };
}

function translateBreakEvenReason(reason: string) {
  if (reason.includes("OPEX missing")) return "Break-even unavailable: OPEX missing.";
  if (reason.includes("Contribution Margin invalid")) return "Break-even unavailable: Contribution Margin invalid.";
  if (reason.includes("Average Check missing")) return "Break-even unavailable: Average Check missing.";
  if (reason.includes("Working Days missing")) return "Break-even unavailable: Working Days missing.";
  return reason;
}
