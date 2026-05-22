import { Shell } from "@/pages/index";
import { loadModel } from "@/lib/model";
import { percent, rub } from "@/lib/format";
import { safeDiv } from "@/calculations/financial";

export async function getServerSideProps() {
  const data = await loadModel();
  return { props: { model: data.model, opex: data.opex } };
}

export default function PnlPage({ model, opex }: any) {
  const payroll = bucket(opex, /payroll|фот|зарп/i);
  const rent = bucket(opex, /rent|аренд/i);
  const utilities = bucket(opex, /utilities|utility|коммун|электр|вода/i);
  const marketingOpex = bucket(opex, /marketing|маркет|реклам/i);
  const knownOpex = payroll + rent + utilities + marketingOpex;
  const otherOpex = Math.max(0, model.fixedCosts + model.variableOpex - knownOpex);
  const rows = [
    ["Revenue", model.monthlyRevenue, "total"],
    ["COGS / Food cost", -model.foodCostTotal, ""],
    ["Packaging", -model.packagingTotal, ""],
    ["Gross Profit", model.grossProfit, "subtotal"],
    ["Payroll", -payroll, ""],
    ["Rent", -rent, ""],
    ["Utilities", -utilities, ""],
    ["Marketing", -(model.marketingCost + marketingOpex), ""],
    ["Aggregator fees", -model.aggregatorCommissionCost, ""],
    ["Other OPEX", -otherOpex, ""],
    ["EBITDA", model.ebitda, "total"],
    ["Taxes", -model.taxPaid, ""],
    ["Net Profit / Operating Cashflow", model.operatingCashflow, "total"]
  ];

  return (
    <Shell>
      <div className="pageHeader">
        <div>
          <h1>P&L</h1>
          <p>Read-only P&L bridge от выручки к EBITDA и operating cashflow. OPEX buckets собираются из текущих категорий справочника OPEX.</p>
        </div>
      </div>
      <div className="metrics">
        <Metric title="Revenue" value={rub(model.monthlyRevenue)} />
        <Metric title="Gross Profit" value={rub(model.grossProfit)} />
        <Metric title="EBITDA" value={rub(model.ebitda)} />
        <Metric title="EBITDA Margin" value={percent(model.ebitdaMargin)} />
        <Metric title="Taxes" value={rub(model.taxPaid)} />
        <Metric title="Operating Cashflow" value={rub(model.operatingCashflow)} />
        <Metric title="OPEX / Revenue" value={percent(safeDiv(model.fixedCosts + model.variableOpex, model.monthlyRevenue))} />
        <Metric title="COGS / Revenue" value={percent(safeDiv(model.foodCostTotal + model.packagingTotal, model.monthlyRevenue))} />
      </div>
      <section className="band">
        <table className="financeTable">
          <thead><tr><th>Line item</th><th>Monthly</th><th>% revenue</th></tr></thead>
          <tbody>
            {rows.map(([label, value, kind]) => (
              <tr key={label as string} className={kind === "total" ? "totalRow" : kind === "subtotal" ? "subtotalRow" : ""}>
                <td>{label}</td>
                <td className={Number(value) < 0 ? "negative" : Number(value) > 0 ? "positive" : ""}>{rub(Number(value))}</td>
                <td>{model.monthlyRevenue ? percent(Number(value) / model.monthlyRevenue) : "n/a"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </Shell>
  );
}

function bucket(opex: any[], pattern: RegExp) {
  return opex.filter((item) => pattern.test(item.category)).reduce((sum, item) => sum + item.amount, 0);
}

function Metric({ title, value }: { title: string; value: string }) {
  return <div className="metric"><span>{title}</span><strong>{value}</strong></div>;
}
