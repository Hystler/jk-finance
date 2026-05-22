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
    ["Opening Investment", model.initialInvestment],
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
          <p>Движение денег: Opening Investment, Operating Cashflow, Net Cashflow, Cumulative Cashflow и Payback.</p>
        </div>
      </div>
      <div className="metrics">
        <Metric title="Opening Investment" value={rub(model.initialInvestment)} />
        <Metric title="Monthly Operating Cashflow" value={rub(model.operatingCashflow)} />
        <Metric title="Net Cashflow M1" value={rub(model.cumulativeCashflow[0]?.netCashflow ?? 0)} />
        <Metric title="Cumulative Cashflow M12" value={rub(model.cumulativeCashflow[11]?.cumulativeCashflow ?? 0)} />
        <Metric title="Payback" value={model.paybackMonth == null ? "n/a" : `${model.paybackMonth} мес.`} />
        <Metric title="ROI" value={model.roi == null ? "n/a" : percent(model.roi)} />
      </div>
      <section className="band">
        <div className="sectionHead"><h2>Opening Investment bridge</h2><span>Launch Costs и Initial Inventory подготовлены как отдельные строки для будущей детализации.</span></div>
        <table className="financeTable">
          <tbody>
            {openingRows.map(([label, value]) => <tr key={label as string}><td>{label}</td><td><strong>{rub(Number(value))}</strong></td></tr>)}
          </tbody>
        </table>
      </section>
      <section className="band">
        <div className="sectionHead"><h2>Cumulative Cashflow</h2><span>Month 0 включает Opening Investment.</span></div>
        <div className="tableScroll">
          <table className="cashflowTable">
            <thead><tr><th>Month</th><th>Monthly Operating Cashflow</th><th>Net Cashflow</th><th>Cumulative Cashflow</th></tr></thead>
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
