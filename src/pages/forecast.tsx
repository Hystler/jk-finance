import { useMemo, useState } from "react";
import { Shell } from "@/components/Shell";
import { loadModel } from "@/lib/model";
import { num, percent, rub } from "@/lib/format";
import { percentDecimal, safeDiv } from "@/calculations/financial";
import type { OpexInput, StoreInputs, TaxInputs } from "@/models/financial";

type Scenario = "Base" | "Conservative" | "Aggressive" | "Custom";
type Period = "Month" | "12 months";
type FilterMode = "all" | "missingRecipe" | "missingPackaging" | "hundredMargin" | "negativeMargin" | "validOnly";
type TableView = "compact" | "full";

type ForecastRow = {
  id: string;
  sku: string;
  category: string;
  sellingPrice: number;
  ingredientCost: number;
  packagingCost: number;
  qtySoldPerMonth: number;
  hasRecipe: boolean;
  hasPackaging: boolean;
};

type CalculatedRow = ForecastRow & {
  adjustedQty: number;
  revenue: number;
  foodCost: number;
  packagingTotal: number;
  grossProfit: number;
  grossMargin: number;
  contributionProfit: number;
  status: string;
  statusTone: "good" | "warning" | "critical";
  missingRecipe: boolean;
  missingPackaging: boolean;
  hundredMargin: boolean;
  negativeMargin: boolean;
  valid: boolean;
};

const scenarioMultipliers: Record<Scenario, number> = {
  Base: 1,
  Conservative: 0.85,
  Aggressive: 1.15,
  Custom: 1
};

const filterOptions: Array<{ value: FilterMode; label: string }> = [
  { value: "all", label: "All" },
  { value: "missingRecipe", label: "Missing recipe" },
  { value: "missingPackaging", label: "Missing packaging" },
  { value: "hundredMargin", label: "100% margin" },
  { value: "negativeMargin", label: "Negative margin" },
  { value: "validOnly", label: "Valid only" }
];

const columnOptions = [
  { key: "category", label: "Category", compact: false },
  { key: "sellingPrice", label: "Price", compact: true },
  { key: "ingredientCost", label: "Ingredient Cost", compact: true },
  { key: "packagingCost", label: "Packaging Cost", compact: false },
  { key: "qtySold", label: "Qty Sold", compact: true },
  { key: "revenue", label: "Revenue", compact: true },
  { key: "foodCost", label: "Food Cost", compact: false },
  { key: "packagingTotal", label: "Packaging Total", compact: false },
  { key: "grossProfit", label: "Gross Profit", compact: true },
  { key: "grossMargin", label: "Gross Margin", compact: true },
  { key: "contributionProfit", label: "Contribution Profit", compact: false }
] as const;

type ColumnKey = typeof columnOptions[number]["key"];

export async function getServerSideProps() {
  const data = await loadModel();
  const activeRows = data.economics.filter((row) => data.productsRaw.find((product) => product.id === row.productId)?.isActive !== false);
  const defaultQty = data.model.monthlyItemsSold > 0 ? data.model.monthlyItemsSold / Math.max(activeRows.length, 1) : 0;
  return {
    props: {
      initialRows: activeRows.map((row) => ({
        id: row.productId,
        sku: row.name,
        category: row.category,
        sellingPrice: row.salePrice,
        ingredientCost: row.ingredientCost,
        packagingCost: row.packagingCost,
        qtySoldPerMonth: Math.round(defaultQty),
        hasRecipe: row.hasRecipe,
        hasPackaging: row.hasPackaging
      })),
      store: data.store,
      opex: data.opex,
      tax: data.tax,
      capex: data.model.initialInvestment,
      loanPaymentsMonthly: data.store.loanPaymentsMonthly,
      ownerWithdrawalsMonthly: data.store.ownerWithdrawalsMonthly
    }
  };
}

export default function ForecastPage({ initialRows, store, opex, tax, capex, loanPaymentsMonthly, ownerWithdrawalsMonthly }: {
  initialRows: ForecastRow[];
  store: StoreInputs;
  opex: OpexInput[];
  tax: TaxInputs;
  capex: number;
  loanPaymentsMonthly: number;
  ownerWithdrawalsMonthly: number;
}) {
  const [rows, setRows] = useState<ForecastRow[]>(initialRows);
  const [applyOpex, setApplyOpex] = useState(true);
  const [applyCapex, setApplyCapex] = useState(true);
  const [scenario, setScenario] = useState<Scenario>("Base");
  const [period, setPeriod] = useState<Period>("Month");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [tableView, setTableView] = useState<TableView>("compact");
  const [visibleColumns, setVisibleColumns] = useState<Record<ColumnKey, boolean>>(() =>
    Object.fromEntries(columnOptions.map((column) => [column.key, true])) as Record<ColumnKey, boolean>
  );
  const [bulkCategory, setBulkCategory] = useState("__all__");
  const [bulkFoodCostPercent, setBulkFoodCostPercent] = useState("");
  const [bulkPackagingCost, setBulkPackagingCost] = useState("");
  const [bulkQtySold, setBulkQtySold] = useState("");
  const [bulkMissingOnly, setBulkMissingOnly] = useState(true);

  const forecast = useMemo(() => calculateForecast({
    rows,
    store,
    opex,
    tax,
    capex,
    loanPaymentsMonthly,
    ownerWithdrawalsMonthly,
    applyOpex,
    applyCapex,
    scenario,
    period
  }), [rows, store, opex, tax, capex, loanPaymentsMonthly, ownerWithdrawalsMonthly, applyOpex, applyCapex, scenario, period]);

  const categories = useMemo(() => Array.from(new Set(rows.map((row) => row.category))).sort(), [rows]);
  const filteredRows = useMemo(() => forecast.rows.filter((row) => rowMatchesFilter(row, filter)), [forecast.rows, filter]);
  const missingCostCount = forecast.rows.filter((row) => row.missingRecipe).length;
  const manyMissingCosts = forecast.rows.length > 0 && (missingCostCount >= 5 || missingCostCount / forecast.rows.length >= 0.25);

  function updateRow(id: string, field: keyof Pick<ForecastRow, "sellingPrice" | "ingredientCost" | "packagingCost" | "qtySoldPerMonth">, value: string) {
    const parsed = Number(value.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed < 0) return;
    setRows((current) => current.map((row) => (row.id === id ? { ...row, [field]: parsed } : row)));
    setScenario("Custom");
  }

  function applyBulkEdit() {
    const foodPercent = parseOptionalNumber(bulkFoodCostPercent);
    const packagingCost = parseOptionalNumber(bulkPackagingCost);
    const qtySold = parseOptionalNumber(bulkQtySold);
    if (foodPercent == null && packagingCost == null && qtySold == null) return;

    setRows((current) => current.map((row) => {
      if (bulkCategory !== "__all__" && row.category !== bulkCategory) return row;
      const next = { ...row };
      if (foodPercent != null && (!bulkMissingOnly || row.ingredientCost <= 0 || !row.hasRecipe)) {
        next.ingredientCost = Math.max(0, row.sellingPrice * (foodPercent / 100));
      }
      if (packagingCost != null && (!bulkMissingOnly || row.packagingCost <= 0 || !row.hasPackaging)) {
        next.packagingCost = Math.max(0, packagingCost);
      }
      if (qtySold != null && (!bulkMissingOnly || row.qtySoldPerMonth <= 0)) {
        next.qtySoldPerMonth = Math.max(0, qtySold);
      }
      return next;
    }));
    setScenario("Custom");
  }

  function shouldShowColumn(key: ColumnKey) {
    const column = columnOptions.find((item) => item.key === key);
    if (!column) return false;
    if (tableView === "compact" && !column.compact) return false;
    return visibleColumns[key];
  }

  return (
    <Shell>
      <div className="pageHeader">
        <div>
          <h1>Forecast</h1>
          <p>Ручной прогноз продаж по SKU с расчётом Revenue, Gross Profit, EBITDA и Cashflow. Используйте bulk edit, чтобы быстро заполнить черновые Food Cost, Packaging Cost и Qty Sold по категориям.</p>
        </div>
      </div>

      {manyMissingCosts && (
        <div className="check warning warningBlock">
          Forecast является черновым: у многих SKU не заполнена себестоимость.
        </div>
      )}

      <section className="band forecastControls">
        <div className="segmented" aria-label="Учитывать OPEX">
          <button type="button" className={applyOpex ? "active" : ""} onClick={() => setApplyOpex(true)}>OPEX: да</button>
          <button type="button" className={!applyOpex ? "active" : ""} onClick={() => setApplyOpex(false)}>OPEX: нет</button>
        </div>
        <div className="segmented" aria-label="Учитывать CAPEX">
          <button type="button" className={applyCapex ? "active" : ""} onClick={() => setApplyCapex(true)}>CAPEX: да</button>
          <button type="button" className={!applyCapex ? "active" : ""} onClick={() => setApplyCapex(false)}>CAPEX: нет</button>
        </div>
        <label>Scenario
          <select value={scenario} onChange={(event) => setScenario(event.target.value as Scenario)}>
            <option>Base</option>
            <option>Conservative</option>
            <option>Aggressive</option>
            <option>Custom</option>
          </select>
        </label>
        <label>Period
          <select value={period} onChange={(event) => setPeriod(event.target.value as Period)}>
            <option>Month</option>
            <option>12 months</option>
          </select>
        </label>
      </section>

      <section className="band bulkEditPanel">
        <div className="sectionHead">
          <h2>Bulk edit</h2>
          <span>Заполнить черновые SKU по категории</span>
        </div>
        <div className="bulkEditGrid">
          <label>Category
            <select value={bulkCategory} onChange={(event) => setBulkCategory(event.target.value)}>
              <option value="__all__">All categories</option>
              {categories.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
          </label>
          <label>Food Cost %
            <input inputMode="decimal" value={bulkFoodCostPercent} onChange={(event) => setBulkFoodCostPercent(event.currentTarget.value)} placeholder="Например: 32" />
          </label>
          <label>Packaging Cost
            <input inputMode="decimal" value={bulkPackagingCost} onChange={(event) => setBulkPackagingCost(event.currentTarget.value)} placeholder="₽ / SKU" />
          </label>
          <label>Qty Sold
            <input inputMode="decimal" value={bulkQtySold} onChange={(event) => setBulkQtySold(event.currentTarget.value)} placeholder="шт / мес" />
          </label>
          <label className="checkLine">
            <input type="checkbox" checked={bulkMissingOnly} onChange={(event) => setBulkMissingOnly(event.currentTarget.checked)} />
            Apply to missing only
          </label>
          <button type="button" className="primary" onClick={applyBulkEdit}>Применить</button>
        </div>
      </section>

      <div className="metrics forecastKpis">
        <Metric title="Qty Sold" value={num(forecast.totalUnitsSold, 0)} />
        <Metric title="Revenue" value={rub(forecast.revenue)} />
        <Metric title="Food Cost" value={rub(forecast.foodCost)} />
        <Metric title="Packaging Cost" value={rub(forecast.packagingCost)} />
        <Metric title="Gross Profit" value={rub(forecast.grossProfit)} />
        <Metric title="Gross Margin" value={percent(forecast.grossMargin)} />
        <Metric title="OPEX" value={rub(forecast.opex)} />
        <Metric title="EBITDA" value={rub(forecast.ebitda)} tone={forecast.ebitda < 0 ? "negative" : "positive"} />
        <Metric title="CAPEX" value={rub(forecast.capex)} />
        <Metric title="Net Cashflow" value={rub(forecast.netCashflow)} tone={forecast.netCashflow < 0 ? "negative" : "positive"} />
        <Metric title="Payback" value={forecast.payback == null ? "n/a" : `${num(forecast.payback, 1)} мес.`} />
      </div>

      <section className="band">
        <div className="sectionHead">
          <h2>SKU Forecast Table</h2>
          <span>{filteredRows.length} / {forecast.rows.length} SKU · {scenario} · {period}</span>
        </div>
        <div className="tableToolbar">
          <div className="segmented wrap" aria-label="Forecast filters">
            {filterOptions.map((option) => (
              <button key={option.value} type="button" className={filter === option.value ? "active" : ""} onClick={() => setFilter(option.value)}>
                {option.label}
              </button>
            ))}
          </div>
          <div className="segmented" aria-label="Table view">
            <button type="button" className={tableView === "compact" ? "active" : ""} onClick={() => setTableView("compact")}>Compact</button>
            <button type="button" className={tableView === "full" ? "active" : ""} onClick={() => setTableView("full")}>Full</button>
          </div>
        </div>
        <details className="columnSettings">
          <summary>Column visibility</summary>
          <div>
            {columnOptions.map((column) => (
              <label className="checkLine" key={column.key}>
                <input
                  type="checkbox"
                  checked={visibleColumns[column.key]}
                  onChange={(event) => setVisibleColumns((current) => ({ ...current, [column.key]: event.currentTarget.checked }))}
                />
                {column.label}
              </label>
            ))}
          </div>
        </details>
        <div className="tableScroll">
          <table className="skuTable forecastTable">
            <thead>
              <tr>
                <th className="stickyCol">SKU</th>
                {shouldShowColumn("category") && <th>Category</th>}
                {shouldShowColumn("sellingPrice") && <th>Price</th>}
                {shouldShowColumn("ingredientCost") && <th>Ingredient Cost</th>}
                {shouldShowColumn("packagingCost") && <th>Packaging Cost</th>}
                {shouldShowColumn("qtySold") && <th>Qty Sold / month</th>}
                {shouldShowColumn("revenue") && <th>Revenue</th>}
                {shouldShowColumn("foodCost") && <th>Food Cost</th>}
                {shouldShowColumn("packagingTotal") && <th>Packaging Total</th>}
                {shouldShowColumn("grossProfit") && <th>Gross Profit</th>}
                {shouldShowColumn("grossMargin") && <th>Gross Margin</th>}
                {shouldShowColumn("contributionProfit") && <th>Contribution Profit</th>}
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.id}>
                  <td className="stickyCol"><strong className="skuName" title={row.sku}>{row.sku}</strong></td>
                  {shouldShowColumn("category") && <td className="textCell">{row.category}</td>}
                  {shouldShowColumn("sellingPrice") && <td><NumberInput value={row.sellingPrice} onBlur={(value) => updateRow(row.id, "sellingPrice", value)} /></td>}
                  {shouldShowColumn("ingredientCost") && <td><NumberInput value={row.ingredientCost} onBlur={(value) => updateRow(row.id, "ingredientCost", value)} /></td>}
                  {shouldShowColumn("packagingCost") && <td><NumberInput value={row.packagingCost} onBlur={(value) => updateRow(row.id, "packagingCost", value)} /></td>}
                  {shouldShowColumn("qtySold") && <td><NumberInput value={row.qtySoldPerMonth} step={1} onBlur={(value) => updateRow(row.id, "qtySoldPerMonth", value)} /></td>}
                  {shouldShowColumn("revenue") && <td className="moneyCell">{rub(row.revenue)}</td>}
                  {shouldShowColumn("foodCost") && <td className="moneyCell">{rub(row.foodCost)}</td>}
                  {shouldShowColumn("packagingTotal") && <td className="moneyCell">{rub(row.packagingTotal)}</td>}
                  {shouldShowColumn("grossProfit") && <td className={`moneyCell ${row.grossProfit < 0 ? "negative" : "positive"}`}>{rub(row.grossProfit)}</td>}
                  {shouldShowColumn("grossMargin") && <td className={`percentCell ${row.grossMargin < 0 ? "negative" : "positive"}`}>{percent(row.grossMargin)}</td>}
                  {shouldShowColumn("contributionProfit") && <td className={`moneyCell ${row.contributionProfit < 0 ? "negative" : "positive"}`}>{rub(row.contributionProfit)}</td>}
                  <td><span className={`status ${row.statusTone}`}>{row.status}</span></td>
                </tr>
              ))}
              {!filteredRows.length && <tr><td colSpan={14}>Нет SKU под выбранный фильтр.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </Shell>
  );
}

function calculateForecast(input: {
  rows: ForecastRow[];
  store: StoreInputs;
  opex: OpexInput[];
  tax: TaxInputs;
  capex: number;
  loanPaymentsMonthly: number;
  ownerWithdrawalsMonthly: number;
  applyOpex: boolean;
  applyCapex: boolean;
  scenario: Scenario;
  period: Period;
}) {
  const scenarioMultiplier = scenarioMultipliers[input.scenario];
  const calculatedRows = input.rows.map((row) => calculateRow(row, input.store, scenarioMultiplier));
  const monthlyUnits = calculatedRows.reduce((sum, row) => sum + row.adjustedQty, 0);
  const monthlyRevenue = calculatedRows.reduce((sum, row) => sum + row.revenue, 0);
  const monthlyFoodCost = calculatedRows.reduce((sum, row) => sum + row.foodCost, 0);
  const monthlyPackagingCost = calculatedRows.reduce((sum, row) => sum + row.packagingTotal, 0);
  const monthlyGrossProfit = calculatedRows.reduce((sum, row) => sum + row.grossProfit, 0);
  const monthlyContribution = calculatedRows.reduce((sum, row) => sum + row.contributionProfit, 0);
  const monthlyOrders = safeDiv(monthlyUnits, input.store.avgItemsPerOrder || 1);
  const monthlyVariableOpex = input.applyOpex ? calculateVariableOpex(input.opex, monthlyRevenue, monthlyOrders, monthlyUnits) : 0;
  const monthlyFixedOpex = input.applyOpex ? input.opex.filter((row) => row.behavior === "FIXED").reduce((sum, row) => sum + row.amount, 0) : 0;
  const monthlyOpex = monthlyFixedOpex + monthlyVariableOpex;
  const monthlyEbitda = monthlyContribution - monthlyOpex;
  const monthlyTax = calculateTax(monthlyRevenue, monthlyEbitda, input.tax);
  const monthlyOperatingCashflow = monthlyEbitda - monthlyTax - input.loanPaymentsMonthly - input.ownerWithdrawalsMonthly;
  const periodMultiplier = input.period === "12 months" ? 12 : 1;
  const capex = input.applyCapex ? input.capex : 0;
  const netCashflow = monthlyOperatingCashflow * periodMultiplier - capex;
  const payback = capex > 0 && monthlyOperatingCashflow > 0 ? capex / monthlyOperatingCashflow : null;

  return {
    rows: calculatedRows,
    totalUnitsSold: monthlyUnits * periodMultiplier,
    revenue: monthlyRevenue * periodMultiplier,
    foodCost: monthlyFoodCost * periodMultiplier,
    packagingCost: monthlyPackagingCost * periodMultiplier,
    grossProfit: monthlyGrossProfit * periodMultiplier,
    grossMargin: safeDiv(monthlyGrossProfit, monthlyRevenue),
    opex: monthlyOpex * periodMultiplier,
    ebitda: monthlyEbitda * periodMultiplier,
    capex,
    netCashflow,
    payback
  };
}

function calculateRow(row: ForecastRow, store: StoreInputs, scenarioMultiplier: number): CalculatedRow {
  const adjustedQty = row.qtySoldPerMonth * scenarioMultiplier;
  const revenue = row.sellingPrice * adjustedQty;
  const foodCost = row.ingredientCost * adjustedQty;
  const packagingTotal = row.packagingCost * adjustedQty;
  const grossProfit = revenue - foodCost - packagingTotal;
  const acquiring = revenue * percentDecimal(store.acquiringRate);
  const aggregator = revenue * percentDecimal(store.deliveryShare) * percentDecimal(store.aggregatorShare) * percentDecimal(store.aggregatorCommissionRate);
  const deliveryLogistics = adjustedQty * safeDiv(store.deliveryLogisticsCostPerOrder * percentDecimal(store.deliveryShare), store.avgItemsPerOrder || 1);
  const marketing = adjustedQty * store.marketingCostPerItem;
  const contributionProfit = grossProfit - acquiring - aggregator - deliveryLogistics - marketing;
  const grossMargin = safeDiv(grossProfit, revenue);
  const status = getRowStatus(row, grossProfit, contributionProfit, grossMargin, revenue);
  return {
    ...row,
    adjustedQty,
    revenue,
    foodCost,
    packagingTotal,
    grossProfit,
    grossMargin,
    contributionProfit,
    status: status.label,
    statusTone: status.tone,
    missingRecipe: row.ingredientCost <= 0 || !row.hasRecipe,
    missingPackaging: row.packagingCost <= 0 || !row.hasPackaging,
    hundredMargin: revenue > 0 && grossMargin >= 0.999,
    negativeMargin: grossProfit < 0 || contributionProfit < 0 || grossMargin < 0,
    valid: status.tone === "good"
  };
}

function calculateVariableOpex(opex: OpexInput[], revenue: number, orders: number, items: number) {
  return opex
    .filter((row) => row.behavior === "VARIABLE")
    .reduce((sum, row) => {
      if (row.driver === "LINKED_TO_REVENUE") return sum + revenue * percentDecimal(row.amount);
      if (row.driver === "LINKED_TO_ORDERS") return sum + orders * row.amount;
      if (row.driver === "LINKED_TO_ITEMS") return sum + items * row.amount;
      return sum + row.amount;
    }, 0);
}

function calculateTax(revenue: number, ebitda: number, tax: TaxInputs) {
  const revenueTax = revenue * percentDecimal(tax.revenueTaxRate ?? 0);
  const profitTax = Math.max(ebitda, 0) * percentDecimal(tax.profitTaxRate ?? 0);
  return revenueTax + profitTax + Number(tax.otherTaxes ?? 0);
}

function getRowStatus(row: ForecastRow, grossProfit: number, contributionProfit: number, grossMargin: number, revenue: number): { label: string; tone: "good" | "warning" | "critical" } {
  if (row.sellingPrice <= 0) return { label: "Ошибка данных", tone: "critical" };
  if (revenue > 0 && grossMargin >= 0.999) return { label: "Черновой расчёт", tone: "warning" };
  if (row.ingredientCost <= 0 || !row.hasRecipe) return { label: "Нет себестоимости", tone: "warning" };
  if (row.packagingCost <= 0 || !row.hasPackaging) return { label: "Нет упаковки", tone: "warning" };
  if (grossProfit < 0 || contributionProfit < 0 || grossMargin < 0) return { label: "Отрицательная маржа", tone: "critical" };
  return { label: "Готово", tone: "good" };
}

function rowMatchesFilter(row: CalculatedRow, filter: FilterMode) {
  if (filter === "missingRecipe") return row.missingRecipe;
  if (filter === "missingPackaging") return row.missingPackaging;
  if (filter === "hundredMargin") return row.hundredMargin;
  if (filter === "negativeMargin") return row.negativeMargin;
  if (filter === "validOnly") return row.valid;
  return true;
}

function parseOptionalNumber(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function NumberInput({ value, onBlur, step = 10 }: { value: number; onBlur: (value: string) => void; step?: number }) {
  const normalized = Math.round(value * 100) / 100;
  return (
    <input
      key={normalized}
      className="forecastInput"
      type="number"
      min={0}
      step={step}
      defaultValue={normalized}
      onBlur={(event) => onBlur(event.currentTarget.value)}
    />
  );
}

function Metric({ title, value, tone }: { title: string; value: string; tone?: "positive" | "negative" }) {
  return <div className="metric"><span>{title}</span><strong className={tone}>{value}</strong></div>;
}
