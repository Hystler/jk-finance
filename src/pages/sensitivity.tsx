import { Shell } from "@/pages/index";
import { loadModel } from "@/lib/model";
import { num, percent, rub } from "@/lib/format";

export async function getServerSideProps() {
  const data = await loadModel();
  return { props: { rows: data.sensitivity } };
}

export default function SensitivityPage({ rows }: any) {
  return (
    <Shell>
      <div className="pageHeader"><div><h1>Sensitivity Analysis</h1><p>Пересчитывает всю модель по каждому параметру и показывает дельты по EBITDA, cashflow, payback, ROI и break-even. CAPEX не влияет на EBITDA; tax rate влияет после EBITDA.</p></div></div>
      <section className="band">
        <table>
          <thead><tr><th>Параметр</th><th>-20%</th><th>-10%</th><th>Base</th><th>+10%</th><th>+20%</th><th>EBITDA delta</th><th>EBITDA margin delta</th><th>Net cashflow delta</th><th>Payback delta</th><th>ROI delta</th><th>Break-even delta</th></tr></thead>
          <tbody>
            {rows.map((row: any) => (
              <tr key={row.parameter}>
                <td>{row.parameter}</td>
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
                <td className={tone(row.breakEvenDelta, true)}>{row.breakEvenDelta == null ? "n/a" : `${signed(row.breakEvenDelta)} orders/day`}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
