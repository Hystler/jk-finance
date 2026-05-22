import Link from "next/link";
import { Shell } from "@/pages/index";
import { loadModel } from "@/lib/model";
import { percent, rub } from "@/lib/format";

export async function getServerSideProps() {
  const data = await loadModel();
  return { props: { franchiseModel: data.franchiseModel } };
}

export default function FranchiseePage({ franchiseModel }: any) {
  const franchisee = franchiseModel.franchisee;
  return (
    <Shell>
      <div className="pageHeader">
        <div>
          <h1>Franchisee Economics</h1>
          <p>Экономика одной franchisee-точки. Ввод данных находится в Franchise Overview.</p>
        </div>
        <div className="actions"><Link className="button" href="/franchise">Открыть Franchise Overview</Link></div>
      </div>
      <div className="metrics">
        <Metric title="Opening Investment" value={rub(franchisee.openingInvestment)} />
        <Metric title="Revenue" value={rub(franchisee.revenueMonth12)} />
        <Metric title="Gross Profit" value={rub(franchisee.grossProfit)} />
        <Metric title="Royalty" value={rub(franchisee.royalty)} />
        <Metric title="Marketing Fee" value={rub(franchisee.marketingFee)} />
        <Metric title="OPEX" value={rub(franchisee.fixedCosts.total)} />
        <Metric title="EBITDA after fees" value={rub(franchisee.ebitdaAfterFeesMonth12)} />
        <Metric title="Net Cashflow" value={rub(franchisee.netCashflowMonth12)} />
        <Metric title="Payback" value={franchisee.paybackMonth == null ? "n/a" : `${franchisee.paybackMonth} мес.`} />
        <Metric title="ROI" value={franchisee.annualROI == null ? "n/a" : percent(franchisee.annualROI)} />
      </div>
      <section className="band">
        <h2>Franchisee P&L Month 12</h2>
        <div className="tableScroll">
          <table className="financeTable">
            <thead><tr><th>Line item</th><th>Value</th><th>% revenue</th></tr></thead>
            <tbody>
              {franchisee.pnlRowsMonth12.map((row: any) => (
                <tr key={row.key} className={row.kind === "total" ? "totalRow" : row.kind === "subtotal" ? "subtotalRow" : row.kind === "margin" ? "marginRow" : ""}>
                  <td>{row.label}</td>
                  <td className={row.value < 0 ? "negative" : row.value > 0 ? "positive" : ""}>{row.kind === "margin" ? percent(row.value) : rub(row.value)}</td>
                  <td>{row.margin == null ? "-" : percent(row.margin)}</td>
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
