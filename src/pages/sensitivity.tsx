import { Shell } from "@/pages/index";
import { loadModel } from "@/lib/model";
import { num, percent, rub } from "@/lib/format";

export async function getServerSideProps() {
  const data = await loadModel();
  return { props: { rows: data.sensitivity, breakEvenReason: data.model.breakEvenUnavailableReason } };
}

export default function SensitivityPage({ rows, breakEvenReason }: any) {
  const translatedBreakEvenReason = breakEvenReason ? translateBreakEvenReason(breakEvenReason) : null;
  return (
    <Shell>
      <div className="pageHeader"><div><h1>Sensitivity</h1><p>Пересчитывает всю модель по каждому параметру и показывает дельты по EBITDA, Net Cashflow, Payback, ROI и Break-even. CAPEX не влияет на EBITDA; Tax Rate влияет после EBITDA.</p></div></div>
      {translatedBreakEvenReason && <div className="check warning warningBlock">{translatedBreakEvenReason}</div>}
      <section className="band">
        <div className="tableScroll">
          <table className="financeTable sensitivityTable">
            <thead><tr><th className="stickyCol">Parameter</th><th>-20%</th><th>-10%</th><th>Base EBITDA</th><th>+10%</th><th>+20%</th><th>EBITDA delta</th><th>EBITDA Margin delta</th><th>Net Cashflow delta</th><th>Payback delta</th><th>ROI delta</th><th>Break-even delta</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((row: any) => (
                <tr key={row.parameter}>
                  <td className="stickyCol"><strong>{row.parameter}</strong></td>
                  <td>{rub(row.values["-20%"])}</td>
                  <td>{rub(row.values["-10%"])}</td>
                  <td>{rub(row.values.Base)}</td>
                  <td>{rub(row.values["+10%"])}</td>
                  <td>{rub(row.values["+20%"])}</td>
                  <td className={tone(row.ebitdaDelta)}>{formatMoneyDelta(row.ebitdaDelta)}</td>
                  <td className={tone(row.ebitdaMarginDelta)}>{formatPercentPointDelta(row.ebitdaMarginDelta)}</td>
                  <td className={tone(row.netCashflowDelta)}>{formatMoneyDelta(row.netCashflowDelta)}</td>
                  <td className={tone(row.paybackDelta, true)}>{row.paybackDelta == null ? "n/a" : `${signed(row.paybackDelta)} мес.`}</td>
                  <td className={tone(row.roiDelta)}>{formatPercentPointDelta(row.roiDelta)}</td>
                  <td className={tone(row.breakEvenDelta, true)}>{row.breakEvenDelta == null ? (translatedBreakEvenReason ?? "n/a") : `${signed(row.breakEvenDelta)} заказов/день`}</td>
                  <td>{row.driverAvailable ? <span className="status good">Готово</span> : <span className="status warning" title={row.driverNote ?? undefined}>Требуется проверка</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </Shell>
  );
}

function signed(value: number) {
  return `${value > 0 ? "+" : ""}${num(value, 1)}`;
}

function formatMoneyDelta(value: number | null) {
  if (value == null) return "n/a";
  return `${value > 0 ? "+" : ""}${rub(value)}`;
}

function formatPercentPointDelta(value: number | null) {
  if (value == null) return "n/a";
  return `${value > 0 ? "+" : ""}${percent(value)}`;
}

function tone(value: number | null, inverse = false) {
  if (value == null || value === 0) return "";
  const good = inverse ? value < 0 : value > 0;
  return good ? "positive" : "negative";
}

function translateBreakEvenReason(reason: string) {
  if (reason.includes("OPEX missing")) return "Break-even unavailable: OPEX missing.";
  if (reason.includes("Contribution Margin invalid")) return "Break-even unavailable: Contribution Margin invalid.";
  if (reason.includes("Average Check missing")) return "Break-even unavailable: Average Check missing.";
  if (reason.includes("Working Days missing")) return "Break-even unavailable: Working Days missing.";
  return reason;
}
