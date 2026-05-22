import { AlertTriangle } from "lucide-react";
import { Shell } from "@/pages/index";
import { loadModel } from "@/lib/model";
import { percent, rub } from "@/lib/format";
import { calculateModelReadiness } from "@/lib/readiness";

export async function getServerSideProps() {
  const data = await loadModel();
  return {
    props: {
      franchiseModel: data.franchiseModel,
      checks: data.checks,
      products: data.products,
      economics: data.economics,
      capex: data.capex,
      opex: data.opex,
      store: data.store,
      model: data.model
    }
  };
}

export default function InvestorViewPage({ franchiseModel, checks, products, economics, capex, opex, store, model }: any) {
  const franchisee = franchiseModel.franchisee;
  const readiness = calculateModelReadiness({
    products,
    economics,
    capex,
    opex,
    store,
    model,
    checks,
    franchiseMissingWarnings: franchiseModel.missingDataWarnings
  });
  const readinessWarnings = [
    readiness.investorWarning,
    ...franchiseModel.missingDataWarnings,
    ...checks.filter((check: any) => check.severity === "critical").slice(0, 5).map((check: any) => check.message)
  ].filter(Boolean);
  const scenarioRows = franchiseModel.scenarios.rows.filter((row: any) => ["Revenue", "EBITDA after fees", "Net cashflow", "Payback month", "ROI", "Break-even orders/day"].includes(row.metric));

  return (
    <Shell>
      <div className="pageHeader">
        <div>
          <h1>Investor View</h1>
          <p>Внешний режим для демонстрации экономики франшизы инвестору или партнёру. Inputs на этой странице не показываются.</p>
          <div className="badgeRow">
            <span className={`status ${readiness.isInvestorReady ? "good" : "warning"}`}>{readiness.financialLabel}</span>
            <span className="pill">Model Readiness {readiness.score}%</span>
          </div>
        </div>
      </div>
      {readinessWarnings.length > 0 && (
        <section className="band warningPanel">
          <div className="sectionHead"><h2>Investor Readiness warning</h2><span>{readinessWarnings.length} проблем</span></div>
          <div className="checks">
            {readinessWarnings.slice(0, 6).map((message: string) => <div className="check warning" key={message}><AlertTriangle size={16} /> {message}</div>)}
          </div>
        </section>
      )}
      <div className="metrics">
        <Metric title="Opening Investment" value={rub(franchisee.openingInvestment)} note={readiness.financialLabel} />
        <Metric title="Expected Revenue" value={rub(franchisee.revenueMonth12)} note={readiness.financialLabel} />
        <Metric title="Expected EBITDA" value={rub(franchisee.ebitdaAfterFeesMonth12)} note={readiness.financialLabel} />
        <Metric title="Payback" value={franchisee.paybackMonth == null ? "n/a" : `${franchisee.paybackMonth} мес.`} note={readiness.financialLabel} />
        <Metric title="ROI" value={franchisee.annualROI == null ? "n/a" : percent(franchisee.annualROI)} note={readiness.financialLabel} />
        <Metric title="Break-even" value={franchisee.breakEvenOrdersPerDay == null ? "n/a" : `${franchisee.breakEvenOrdersPerDay.toFixed(1)} заказов/день`} note={readiness.financialLabel} />
      </div>
      <section className="band">
        <h2>Scenario comparison</h2>
        <div className="tableScroll">
          <table className="financeTable">
            <thead><tr><th>Metric</th><th>Downside</th><th>Base</th><th>Upside</th></tr></thead>
            <tbody>
              {scenarioRows.map((row: any) => (
                <tr key={row.metric}>
                  <td>{formatMetricName(row.metric)}</td>
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
          <table className="financeTable">
            <tbody>
              <Row label="SKU in model" value={String(products.length)} />
              <Row label="Month 12 Revenue" value={rub(franchisee.revenueMonth12)} />
              <Row label="EBITDA Margin after fees" value={percent(franchisee.ebitdaMarginAfterFeesMonth12)} />
              <Row label="Net Cashflow Margin" value={percent(franchisee.netCashflowMargin)} />
            </tbody>
          </table>
        </section>
        <section className="band">
          <h2>What franchisee gets</h2>
          <div className="checks">
            <div className="check info">Brand package, SKU economics и launch assumptions.</div>
            <div className="check info">Opening support, training и operating model.</div>
            <div className="check info">Franchise financial model со сравнением сценариев.</div>
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

function formatMetricName(metric: string) {
  const labels: Record<string, string> = {
    "EBITDA margin": "EBITDA Margin",
    "Net cashflow": "Net Cashflow",
    "Payback month": "Payback",
    "Break-even orders/day": "Break-even Orders / day"
  };
  return labels[metric] ?? metric;
}

function Metric({ title, value, note }: { title: string; value: string; note?: string }) {
  return <div className="metric"><span>{title}</span><strong>{value}</strong>{note && <small>{note}</small>}</div>;
}

function Row({ label, value }: { label: string; value: string }) {
  return <tr><td>{label}</td><td><strong>{value}</strong></td></tr>;
}
