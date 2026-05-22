import Link from "next/link";
import { Shell } from "@/pages/index";
import { loadModel } from "@/lib/model";
import { percent, rub } from "@/lib/format";

export async function getServerSideProps() {
  const data = await loadModel();
  return { props: { franchise: data.franchise, franchisor: data.franchiseModel.franchisor } };
}

export default function FranchisorPage({ franchise, franchisor }: any) {
  const networkRows = [1, 5, 10, 25].map((locations) => {
    const monthlyRevenue = franchisor.monthlyRevenue * locations;
    const ebitda = monthlyRevenue - franchisor.supportCostPerFranchisee * locations - franchise.franchisorFixedTeamCosts;
    return { locations, monthlyRevenue, ebitda };
  });

  return (
    <Shell>
      <div className="pageHeader">
        <div>
          <h1>Franchisor Economics</h1>
          <p>Royalty, Marketing Fee, Supply Markup, Support Cost и HQ economics для сети франшизы.</p>
        </div>
        <div className="actions"><Link className="button" href="/franchise">Открыть Franchise Overview</Link></div>
      </div>
      <div className="metrics">
        <Metric title="Initial Franchise Fee" value={rub(franchisor.lumpSumFee)} />
        <Metric title="Royalty Revenue" value={rub(franchisor.royalty)} />
        <Metric title="Marketing Fee Revenue" value={rub(franchisor.marketingFee)} />
        <Metric title="Supply Markup" value={rub(franchisor.supplyChainMarkupRevenue)} />
        <Metric title="Support Cost / Franchisee" value={rub(franchisor.supportCostPerFranchisee)} />
        <Metric title="Fixed HQ Costs" value={rub(franchise.franchisorFixedTeamCosts)} />
        <Metric title="Franchisor EBITDA" value={rub(franchisor.ebitda)} />
        <Metric title="EBITDA Margin" value={percent(franchisor.ebitdaMargin)} />
      </div>
      <section className="band">
        <h2>Profit by network size</h2>
        <div className="tableScroll">
          <table className="financeTable">
            <thead><tr><th>Locations</th><th>Monthly Revenue</th><th>Monthly EBITDA</th><th>Annual EBITDA</th></tr></thead>
            <tbody>
              {networkRows.map((row) => (
                <tr key={row.locations}>
                  <td>{row.locations}</td>
                  <td>{rub(row.monthlyRevenue)}</td>
                  <td className={row.ebitda < 0 ? "negative" : "positive"}>{rub(row.ebitda)}</td>
                  <td className={row.ebitda < 0 ? "negative" : "positive"}>{rub(row.ebitda * 12)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="band">
        <h2>Revenue bridge per franchisee</h2>
        <table className="financeTable">
          <tbody>
            <Row label="Royalty" value={rub(franchisor.royalty)} />
            <Row label="Marketing fee" value={rub(franchisor.marketingFee)} />
            <Row label="Supply markup" value={rub(franchisor.supplyChainMarkupRevenue)} />
            <Row label="Monthly fixed fees" value={rub(franchisor.monthlyFixedFees)} />
            <Row label="Support cost" value={rub(-franchisor.supportCostPerFranchisee)} />
            <Row label="Allocated HQ costs" value={rub(-franchisor.allocatedFixedTeamCosts)} />
            <Row label="Franchisor EBITDA / franchisee" value={rub(franchisor.ebitda)} />
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
