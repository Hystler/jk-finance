import { Shell } from "@/pages/index";
import { loadModel } from "@/lib/model";
import { rub } from "@/lib/format";

export async function getServerSideProps() {
  const data = await loadModel();
  return { props: { rows: data.sensitivity } };
}

export default function SensitivityPage({ rows }: any) {
  return (
    <Shell>
      <div className="pageHeader"><div><h1>Sensitivity Analysis</h1><p>Показывает влияние ключевых assumptions на EBITDA и payback. Food cost по ингредиентам будет расширен после ввода детального справочника закупок.</p></div></div>
      <section className="band">
        <table>
          <thead><tr><th>Параметр</th><th>-20%</th><th>-10%</th><th>Base</th><th>+10%</th><th>+20%</th><th>Impact on EBITDA</th><th>Impact on Payback</th></tr></thead>
          <tbody>
            {rows.map((row: any) => (
              <tr key={row.parameter}>
                <td>{row.parameter}</td>
                <td>{rub(row.values["-20%"])}</td>
                <td>{rub(row.values["-10%"])}</td>
                <td>{rub(row.values.Base)}</td>
                <td>{rub(row.values["+10%"])}</td>
                <td>{rub(row.values["+20%"])}</td>
                <td>{row.impactOnEbitda == null ? "n/a" : rub(row.impactOnEbitda)}</td>
                <td>{row.impactOnPayback == null ? "n/a" : `${row.impactOnPayback} мес.`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </Shell>
  );
}
