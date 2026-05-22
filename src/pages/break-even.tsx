import { Shell } from "@/pages/index";
import { loadModel } from "@/lib/model";
import { num, percent, rub } from "@/lib/format";
import { safeDiv } from "@/calculations/financial";

export async function getServerSideProps() {
  const data = await loadModel();
  return { props: { model: data.model } };
}

export default function BreakEvenPage({ model }: any) {
  const contributionProfit = model.monthlyRevenue - model.foodCostTotal - model.packagingTotal - model.variableCosts;
  const contributionMargin = safeDiv(contributionProfit, model.monthlyRevenue);
  const breakEvenAverageCheck = model.breakEvenRevenue != null && model.monthlyOrders > 0
    ? model.breakEvenRevenue / model.monthlyOrders
    : null;
  const safetyMargin = model.breakEvenRevenue != null && model.monthlyRevenue > 0
    ? (model.monthlyRevenue - model.breakEvenRevenue) / model.monthlyRevenue
    : null;

  return (
    <Shell>
      <div className="pageHeader">
        <div>
          <h1>Break-even</h1>
          <p>Read-only операционный break-even: выручка, заказы, средний чек и запас прочности на текущих assumptions.</p>
        </div>
      </div>
      <div className="metrics">
        <Metric title="Break-even revenue/month" value={model.breakEvenRevenue == null ? "n/a" : rub(model.breakEvenRevenue)} />
        <Metric title="Break-even orders/day" value={model.breakEvenOrdersPerDay == null ? "n/a" : `${num(model.breakEvenOrdersPerDay, 1)} orders`} />
        <Metric title="Break-even average check" value={breakEvenAverageCheck == null ? "n/a" : rub(breakEvenAverageCheck)} />
        <Metric title="Fixed costs/month" value={rub(model.fixedCosts)} />
        <Metric title="Contribution margin %" value={percent(contributionMargin)} />
        <Metric title="Safety margin" value={safetyMargin == null ? "n/a" : percent(safetyMargin)} />
      </div>
      <section className="band">
        <table>
          <tbody>
            <Row label="Current revenue" value={rub(model.monthlyRevenue)} />
            <Row label="Contribution profit" value={rub(contributionProfit)} />
            <Row label="Fixed costs/month" value={rub(model.fixedCosts)} />
            <Row label="Break-even revenue/month" value={model.breakEvenRevenue == null ? "n/a" : rub(model.breakEvenRevenue)} />
            <Row label="Break-even orders/day" value={model.breakEvenOrdersPerDay == null ? "n/a" : `${num(model.breakEvenOrdersPerDay, 1)}`} />
            <Row label="Safety margin" value={safetyMargin == null ? "n/a" : percent(safetyMargin)} />
          </tbody>
        </table>
      </section>
    </Shell>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return <div className="metric"><span>{title}</span><strong>{value}</strong></div>;
}

function Row({ label, value }: { label: string; value: string }) {
  return <tr><td>{label}</td><td><strong>{value}</strong></td></tr>;
}
