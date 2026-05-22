import { Shell } from "@/pages/index";
import { loadModel } from "@/lib/model";
import { num, percent, rub } from "@/lib/format";
import { safeDiv } from "@/calculations/financial";

export async function getServerSideProps() {
  const data = await loadModel();
  return {
    props: {
      model: data.model,
      store: data.store,
      economics: data.economics
    }
  };
}

export default function UnitEconomicsPage({ model, store, economics }: any) {
  const orders = Math.max(model.monthlyOrders, 0);
  const contributionProfit = model.monthlyRevenue - model.foodCostTotal - model.packagingTotal - model.variableCosts;
  const rows = [
    ["Average check", rub(store.avgCheck)],
    ["Food cost / order", rub(safeDiv(model.foodCostTotal, orders))],
    ["Packaging cost / order", rub(safeDiv(model.packagingTotal, orders))],
    ["Aggregator commission / order", rub(safeDiv(model.aggregatorCommissionCost, orders))],
    ["Payment acquiring / order", rub(safeDiv(model.acquiringCost, orders))],
    ["Delivery cost / order", rub(safeDiv(model.deliveryLogisticsCost, orders))],
    ["Contribution margin / order", rub(safeDiv(contributionProfit, orders))],
    ["Contribution margin %", percent(safeDiv(contributionProfit, model.monthlyRevenue))]
  ];
  const skuRows = economics
    .filter((row: any) => row.salePrice > 0)
    .sort((a: any, b: any) => b.contributionMarginPercent - a.contributionMarginPercent);

  return (
    <Shell>
      <div className="pageHeader">
        <div>
          <h1>Unit Economics</h1>
          <p>Read-only unit economics на один заказ и на SKU. Ввод находится в Store Model, SKU, Recipes и Packaging.</p>
        </div>
      </div>
      <div className="metrics">
        {rows.map(([label, value]) => <Metric key={label} title={label} value={value} />)}
      </div>
      <section className="band">
        <div className="sectionHead">
          <h2>SKU contribution</h2>
          <span>{num(skuRows.length, 0)} SKU with price</span>
        </div>
        <div className="tableScroll">
          <table className="skuTable">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Price</th>
                <th>Food cost</th>
                <th>Packaging</th>
                <th>Aggregator</th>
                <th>Acquiring</th>
                <th>Delivery</th>
                <th>Contribution</th>
                <th>Contribution %</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {skuRows.map((row: any) => (
                <tr key={row.productId}>
                  <td><strong>{row.name}</strong></td>
                  <td>{rub(row.salePrice)}</td>
                  <td>{rub(row.ingredientCost)}</td>
                  <td>{rub(row.packagingCost)}</td>
                  <td>{rub(row.aggregatorCommissionPerItem)}</td>
                  <td>{rub(row.acquiringCost)}</td>
                  <td>{rub(row.deliveryLogisticsPerItem)}</td>
                  <td className={row.contributionMargin < 0 ? "negative" : "positive"}>{rub(row.contributionMargin)}</td>
                  <td className={row.contributionMarginPercent < 0 ? "negative" : "positive"}>{percent(row.contributionMarginPercent)}</td>
                  <td><span className={`status ${String(row.status).replace(/\s+/g, "-")}`}>{row.status}</span></td>
                </tr>
              ))}
              {!skuRows.length && <tr><td colSpan={10}>SKU еще не заполнены.</td></tr>}
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
