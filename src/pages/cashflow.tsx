import { Shell } from "@/pages/index";
import { loadModel } from "@/lib/model";
import { percent, rub } from "@/lib/format";

export async function getServerSideProps() {
  const data = await loadModel();
  return { props: { model: data.model, capex: data.capex, store: data.store } };
}

export default function CashflowPage({ model, capex, store }: any) {
  const capexTotal = capex.reduce((sum: number, item: any) => sum + item.amount, 0);
  const openingRows = [
    ["Opening investment", model.initialInvestment],
    ["CAPEX", capexTotal],
    ["Launch costs", 0],
    ["Initial inventory", 0],
    ["Working capital", store.workingCapitalChangeMonthly ?? 0]
  ];
  const cashflowRows = [
    { month: 0, netCashflow: -model.initialInvestment, cumulativeCashflow: -model.initialInvestment },
    ...model.cumulativeCashflow
  ];

  return (
    <Shell>
      <div className="pageHeader">
        <div>
          <h1>Cashflow</h1>
          <p>Read-only cashflow view: opening investment, monthly operating cashflow, net cashflow, cumulative cashflow and payback month.</p>
        </div>
      </div>
      <div className="metrics">
        <Metric title="Opening investment" value={rub(model.initialInvestment)} />
        <Metric title="Monthly operating cashflow" value={rub(model.operatingCashflow)} />
        <Metric title="Net cashflow M1" value={rub(model.cumulativeCashflow[0]?.netCashflow ?? 0)} />
        <Metric title="Cumulative cashflow M12" value={rub(model.cumulativeCashflow[11]?.cumulativeCashflow ?? 0)} />
        <Metric title="Payback month" value={model.paybackMonth == null ? "n/a" : `${model.paybackMonth} мес.`} />
        <Metric title="ROI" value={model.roi == null ? "n/a" : percent(model.roi)} />
      </div>
      <section className="band">
        <div className="sectionHead"><h2>Opening investment bridge</h2><span>Launch costs and initial inventory are prepared as separate lines for future detailed inputs.</span></div>
        <table>
          <tbody>
            {openingRows.map(([label, value]) => <tr key={label as string}><td>{label}</td><td><strong>{rub(Number(value))}</strong></td></tr>)}
          </tbody>
        </table>
      </section>
      <section className="band">
        <div className="sectionHead"><h2>Cumulative cashflow</h2><span>Month 0 includes opening investment.</span></div>
        <div className="tableScroll">
          <table className="cashflowTable">
            <thead><tr><th>Month</th><th>Monthly operating cashflow</th><th>Net cashflow</th><th>Cumulative cashflow</th></tr></thead>
            <tbody>
              {cashflowRows.map((row: any) => (
                <tr key={row.month} className={row.month === 0 ? "totalRow" : ""}>
                  <td>Month {row.month}</td>
                  <td>{row.month === 0 ? rub(0) : rub(model.operatingCashflow)}</td>
                  <td className={row.netCashflow < 0 ? "negative" : "positive"}>{rub(row.netCashflow)}</td>
                  <td className={row.cumulativeCashflow < 0 ? "negative" : "positive"}>{rub(row.cumulativeCashflow)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </Shell>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return <div className="metric"><span>{title}</span><strong>{value}</strong></div>;
}
