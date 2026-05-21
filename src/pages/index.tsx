import Link from "next/link";
import { AlertTriangle, Download, FileUp, Gauge, PackagePlus, Plus, Table2, Wheat } from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
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
  const negativeEbitdaCount = economics.filter((sku: any) => sku.ebitdaPerItem < 0).length;
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
  const completeness = [
    { label: "SKU prices imported", done: products.filter((sku: any) => sku.salePrice > 0).length, total: products.length },
    { label: "Recipes filled", done: economics.filter((sku: any) => sku.hasRecipe).length, total: economics.length },
    { label: "Packaging filled", done: economics.filter((sku: any) => sku.hasPackaging).length, total: economics.length },
    { label: "CAPEX filled", done: capex.filter((row: any) => row.amount > 0).length, total: Math.max(capex.length, 1) },
    { label: "OPEX filled", done: opex.filter((row: any) => row.amount > 0).length, total: Math.max(opex.length, 1) },
    { label: "Store Model filled", done: [store.workingDaysPerMonth, store.avgOrdersPerDay, store.avgItemsPerOrder, store.avgCheck].filter((value: number) => value > 0).length, total: 4 },
    { label: "Franchise Mode filled", done: [
      franchiseModel.franchise.franchiseWorkingDaysPerMonth,
      franchiseModel.franchise.franchiseAvgOrdersPerDay,
      franchiseModel.franchise.franchiseAvgItemsPerOrder,
      franchiseModel.franchise.franchiseAvgCheck,
      franchiseModel.franchise.franchiseRent + franchiseModel.franchise.franchisePayroll + franchiseModel.franchise.franchiseOtherFixedOpex
    ].filter((value: number) => value > 0).length, total: 5 }
  ];

  return (
    <Shell>
      <div className="pageHeader">
        <div>
          <h1>Жуй Кайфуй: финансовая модель MVP</h1>
          <p>Все неизвестные финансовые значения остаются editable assumptions. Публичное меню импортируется отдельно от расчетов.</p>
        </div>
        <div className="actions">
          <Link className="button" href="/import"><FileUp size={16} /> Импорт</Link>
          <a className="button primary" href="/api/export/full"><Download size={16} /> XLSX</a>
        </div>
      </div>

      <div className="metrics">
        <Metric title="Monthly revenue" value={rub(summary.monthlyRevenue)} />
        <Metric title="Gross profit" value={rub(summary.grossProfit)} />
        <Metric title="EBITDA" value={rub(summary.ebitda)} />
        <Metric title="EBITDA margin" value={percent(summary.ebitdaMargin)} />
        <Metric title="Operating cashflow" value={rub(summary.operatingCashflow)} />
        <Metric title="Opening investment" value={rub(summary.initialInvestment)} />
        <Metric title="Payback" value={summary.paybackMonth ? `${summary.paybackMonth} мес.` : "n/a"} />
        <Metric title="Break-even / день" value={summary.breakEvenOrdersPerDay == null ? "n/a" : `${Math.ceil(summary.breakEvenOrdersPerDay)} заказов`} />
        <Metric title="Active SKU count" value={num(activeSkuCount, 0)} />
        <Metric title="SKU with missing recipe" value={num(missingRecipeCount, 0)} />
        <Metric title="SKU with negative EBITDA" value={num(negativeEbitdaCount, 0)} />
        <Metric title="ROI" value={summary.roi == null ? "n/a" : percent(summary.roi)} />
      </div>

      <section className="band quickActions">
        <div className="sectionHead">
          <h2>Quick Actions</h2>
          <span>Самые частые переходы для заполнения модели</span>
        </div>
        <div className="actions">
          <Link className="button primary" href="/menu"><Plus size={16} /> Добавить SKU</Link>
          <Link className="button" href="/ingredients"><Wheat size={16} /> Добавить ингредиент</Link>
          <Link className="button" href="/store">Заполнить Store Model</Link>
          <Link className="button" href="/capex"><PackagePlus size={16} /> Добавить CAPEX</Link>
          <Link className="button" href="/opex">Добавить OPEX</Link>
          <Link className="button" href="/franchise">Открыть Franchise Mode</Link>
          <a className="button" href="/api/export/full"><Download size={16} /> Export XLSX</a>
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
              <XAxis dataKey="month" />
              <YAxis tickFormatter={(value) => compactRub(Number(value))} width={82} />
              <Tooltip formatter={(value: number) => rub(value)} />
              <Legend />
              <Bar dataKey="revenue" fill="#D9B88F" name="Revenue" />
              <Line type="monotone" dataKey="ebitda" stroke="#6F7F52" strokeWidth={2} dot={false} name="EBITDA" />
              <Line type="monotone" dataKey="cashflow" stroke="#B23A2E" strokeWidth={2} dot={false} name="Cashflow" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      <Diagnostics diagnostics={diagnostics} />

      <div className="twoCol">
        <section className="band">
          <h2>Структура расходов</h2>
          <div className="chart">
            {expenseStructure.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={expenseStructure} dataKey="value" nameKey="name" innerRadius={54} outerRadius={92}>
                    {expenseStructure.map((_: any, index: number) => <Cell key={index} fill={["#7A4E2D", "#D9B88F", "#B23A2E", "#4B2F1D", "#C9822B", "#6F7F52"][index % 6]} />)}
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
                <XAxis dataKey="ordersPerDay" />
                <YAxis tickFormatter={(value) => compactRub(Number(value))} width={82} />
                <Tooltip formatter={(value: number) => rub(value)} />
                <ReferenceLine y={0} stroke="#B23A2E" />
                <Line type="monotone" dataKey="ebitda" stroke="#7A4E2D" strokeWidth={2} dot />
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
                    <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(value) => rub(Number(value))} />
                    <YAxis type="category" dataKey="shortName" width={220} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(value: number) => rub(value)} labelFormatter={(_, payload: any) => payload?.[0]?.payload?.fullName ?? ""} />
                    <ReferenceLine x={0} stroke="#4B2F1D" />
                    <Bar dataKey="ebitdaPerItem" name="EBITDA / item" fill="#6F7F52" />
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
                <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(value) => compactRub(Number(value))} />
                <YAxis type="category" dataKey="parameter" width={210} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: number) => rub(value)} labelFormatter={(_, payload: any) => payload?.[0]?.payload?.fullName ?? ""} />
                <Bar dataKey="impact">
                  {tornado.map((row: any, index: number) => <Cell key={index} fill={row.impact < 0 ? "#B23A2E" : "#6F7F52"} />)}
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
                  <XAxis dataKey="month" tickFormatter={(value) => `M${value}`} />
                  <YAxis tickFormatter={(value) => compactRub(Number(value))} width={82} />
                  <Tooltip formatter={(value: number) => rub(value)} labelFormatter={(label) => `Month ${label}`} />
                  <ReferenceLine y={0} stroke="#B23A2E" strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="cumulativeCashflow" stroke="#7A4E2D" strokeWidth={2} dot={false} />
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
          <h2>Checks</h2>
          <Link href="/checks">Открыть все</Link>
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

function Diagnostics({ diagnostics }: { diagnostics: any[] }) {
  return (
    <section className="band warningPanel">
      <h2>Почему EBITDA / Cashflow отрицательные</h2>
      {diagnostics.length ? diagnostics.map((item) => <div className={`check ${item.severity}`} key={item.message}>{item.message}</div>) : <p>Явных причин отрицательных значений сейчас нет. Для реальной модели заполните рецептуры, упаковку и операционные assumptions.</p>}
    </section>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <nav className="nav">
        <Link href="/" className="brand"><Gauge size={18} /> JK Finance</Link>
        <Link href="/menu"><Table2 size={16} /> SKU</Link>
        <Link href="/ingredients"><Wheat size={16} /> Ingredients</Link>
        <Link href="/store">Store Model</Link>
        <Link href="/capex">CAPEX</Link>
        <Link href="/opex">OPEX</Link>
        <Link href="/sensitivity">Sensitivity</Link>
        <Link href="/franchise">Franchise</Link>
        <Link href="/checks">Checks</Link>
      </nav>
      <main className="main">{children}</main>
    </div>
  );
}


function Metric({ title, value }: { title: string; value: string }) {
  return (
    <div className="metric">
      <span>{title}</span>
      <strong>{value}</strong>
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
