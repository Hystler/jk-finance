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
  const reason = model.breakEvenUnavailableReason ? translateBreakEvenReason(model.breakEvenUnavailableReason) : null;

  return (
    <Shell>
      <div className="pageHeader">
        <div>
          <h1>Break-even</h1>
          <p>Операционный расчёт Break-even: Revenue, заказы, Average Check и запас прочности на текущих assumptions.</p>
        </div>
      </div>
      <div className="metrics">
        <Metric title="Break-even Revenue / month" value={model.breakEvenRevenue == null ? "n/a" : rub(model.breakEvenRevenue)} note={model.breakEvenRevenue == null ? reason ?? undefined : undefined} />
        <Metric title="Break-even Orders / day" value={model.breakEvenOrdersPerDay == null ? "n/a" : `${num(model.breakEvenOrdersPerDay, 1)} заказов`} note={model.breakEvenOrdersPerDay == null ? reason ?? undefined : undefined} />
        <Metric title="Break-even Average Check" value={breakEvenAverageCheck == null ? "n/a" : rub(breakEvenAverageCheck)} note={breakEvenAverageCheck == null ? reason ?? undefined : undefined} />
        <Metric title="Fixed costs/month" value={rub(model.fixedCosts)} />
        <Metric title="Contribution Margin" value={percent(contributionMargin)} />
        <Metric title="Safety margin" value={safetyMargin == null ? "n/a" : percent(safetyMargin)} />
      </div>
      <section className="band">
        {reason && <div className="check warning warningBlock">{reason}</div>}
        <table className="financeTable">
          <tbody>
            <Row label="Current Revenue" value={rub(model.monthlyRevenue)} />
            <Row label="Contribution Profit" value={rub(contributionProfit)} />
            <Row label="Contribution Margin" value={percent(contributionMargin)} />
            <Row label="Fixed costs / month" value={rub(model.fixedCosts)} />
            <Row label="Break-even Revenue / month" value={model.breakEvenRevenue == null ? `n/a · ${reason}` : rub(model.breakEvenRevenue)} />
            <Row label="Break-even Orders / month" value={model.breakEvenOrders == null ? `n/a · ${reason}` : num(model.breakEvenOrders, 1)} />
            <Row label="Break-even Orders / day" value={model.breakEvenOrdersPerDay == null ? `n/a · ${reason}` : num(model.breakEvenOrdersPerDay, 1)} />
            <Row label="Safety margin" value={safetyMargin == null ? "n/a" : percent(safetyMargin)} />
          </tbody>
        </table>
      </section>
    </Shell>
  );
}

function Metric({ title, value, note }: { title: string; value: string; note?: string }) {
  return <div className="metric"><span>{title}</span><strong>{value}</strong>{note && <small>{note}</small>}</div>;
}

function Row({ label, value }: { label: string; value: string }) {
  return <tr><td>{label}</td><td><strong>{value}</strong></td></tr>;
}

function translateBreakEvenReason(reason: string) {
  if (reason.includes("OPEX missing")) return "Break-even unavailable: OPEX missing.";
  if (reason.includes("Contribution Margin invalid")) return "Break-even unavailable: Contribution Margin invalid.";
  if (reason.includes("Average Check missing")) return "Break-even unavailable: Average Check missing.";
  if (reason.includes("Working Days missing")) return "Break-even unavailable: Working Days missing.";
  return reason;
}
