import { AlertTriangle } from "lucide-react";
import { Shell } from "@/pages/index";
import { loadModel } from "@/lib/model";
import { percent, rub } from "@/lib/format";

export async function getServerSideProps() {
  const data = await loadModel();
  return {
    props: {
      franchiseModel: data.franchiseModel,
      checks: data.checks,
      products: data.products.length
    }
  };
}

export default function InvestorViewPage({ franchiseModel, checks, products }: any) {
  const franchisee = franchiseModel.franchisee;
  const readinessWarnings = [
    ...franchiseModel.missingDataWarnings,
    ...checks.filter((check: any) => check.severity === "critical").slice(0, 5).map((check: any) => check.message)
  ];
  const scenarioRows = franchiseModel.scenarios.rows.filter((row: any) => ["Revenue", "EBITDA after fees", "Net cashflow", "Payback month", "ROI", "Break-even orders/day"].includes(row.metric));

  return (
    <Shell>
      <div className="pageHeader">
        <div>
          <h1>Investor View</h1>
          <p>Read-only external view for a franchisee/investor conversation. No inputs are shown here.</p>
        </div>
      </div>
      {readinessWarnings.length > 0 && (
        <section className="band warningPanel">
          <div className="sectionHead"><h2>Model readiness warning</h2><span>{readinessWarnings.length} issue(s)</span></div>
          <div className="checks">
            {readinessWarnings.slice(0, 6).map((message: string) => <div className="check warning" key={message}><AlertTriangle size={16} /> {message}</div>)}
          </div>
        </section>
      )}
      <div className="metrics">
        <Metric title="Investment required" value={rub(franchisee.openingInvestment)} />
        <Metric title="Expected revenue" value={rub(franchisee.revenueMonth12)} />
        <Metric title="Expected EBITDA" value={rub(franchisee.ebitdaAfterFeesMonth12)} />
        <Metric title="Payback" value={franchisee.paybackMonth == null ? "n/a" : `${franchisee.paybackMonth} мес.`} />
        <Metric title="ROI" value={franchisee.annualROI == null ? "n/a" : percent(franchisee.annualROI)} />
        <Metric title="Break-even" value={franchisee.breakEvenOrdersPerDay == null ? "n/a" : `${franchisee.breakEvenOrdersPerDay.toFixed(1)} orders/day`} />
      </div>
      <section className="band">
        <h2>Scenario comparison</h2>
        <div className="tableScroll">
          <table className="financeTable">
            <thead><tr><th>Metric</th><th>Downside</th><th>Base</th><th>Upside</th></tr></thead>
            <tbody>
              {scenarioRows.map((row: any) => (
                <tr key={row.metric}>
                  <td>{row.metric}</td>
                  <td>{format(row.Downside, row.format)}</td>
                  <td>{format(row.Base, row.format)}</td>
                  <td>{format(row.Upside, row.format)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <div className="twoCol">
        <section className="band">
          <h2>Main assumptions</h2>
          <table>
            <tbody>
              <Row label="SKU in model" value={String(products)} />
              <Row label="Month 12 revenue" value={rub(franchisee.revenueMonth12)} />
              <Row label="EBITDA margin after fees" value={percent(franchisee.ebitdaMarginAfterFeesMonth12)} />
              <Row label="Net cashflow margin" value={percent(franchisee.netCashflowMargin)} />
            </tbody>
          </table>
        </section>
        <section className="band">
          <h2>What franchisee gets</h2>
          <div className="checks">
            <div className="check info">Brand package, SKU economics and launch assumptions</div>
            <div className="check info">Opening support, training and operating model</div>
            <div className="check info">Franchise financial model with scenario comparison</div>
          </div>
        </section>
      </div>
      <section className="band">
        <h2>Key risks</h2>
        <div className="checks">
          {franchiseModel.breakers.length ? franchiseModel.breakers.slice(0, 6).map((item: string) => <div className="check warning" key={item}>{item}</div>) : <div className="check info">Ключевые риски не обнаружены текущими проверками.</div>}
        </div>
      </section>
    </Shell>
  );
}

function format(value: number | null, kind: string) {
  if (value == null) return "n/a";
  if (kind === "money") return rub(value);
  if (kind === "percent") return percent(value);
  if (kind === "month") return `${value.toFixed(0)} мес.`;
  return value.toFixed(1);
}

function Metric({ title, value }: { title: string; value: string }) {
  return <div className="metric"><span>{title}</span><strong>{value}</strong></div>;
}

function Row({ label, value }: { label: string; value: string }) {
  return <tr><td>{label}</td><td><strong>{value}</strong></td></tr>;
}
