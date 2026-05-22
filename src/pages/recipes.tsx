import Link from "next/link";
import { Shell } from "@/pages/index";
import { calculateRecipeItemCost } from "@/calculations/financial";
import { loadModel } from "@/lib/model";
import { percent, rub } from "@/lib/format";

export async function getServerSideProps() {
  const data = await loadModel();
  const rows = data.products.flatMap((product) =>
    (product.recipes ?? []).map((recipe) => ({
      ...recipe,
      skuId: product.id,
      skuName: product.name,
      skuCategory: product.category,
      salePrice: product.salePrice,
      costPerPortion: calculateRecipeItemCost(recipe)
    }))
  );
  return { props: { rows: JSON.parse(JSON.stringify(rows)), products: data.products.length } };
}

export default function RecipesPage({ rows, products }: any) {
  const missingRecipeCount = Math.max(0, products - new Set(rows.map((row: any) => row.skuId)).size);
  return (
    <Shell>
      <div className="pageHeader">
        <div>
          <h1>Recipes</h1>
          <p>Справочник рецептур: SKU, ingredient, quantity per portion, unit, waste и final ingredient cost. Редактирование строки доступно из карточки SKU.</p>
        </div>
      </div>
      <div className="metrics">
        <Metric title="Recipe rows" value={String(rows.length)} />
        <Metric title="SKU without recipes" value={String(missingRecipeCount)} />
        <Metric title="Total recipe cost" value={rub(rows.reduce((sum: number, row: any) => sum + row.costPerPortion, 0))} />
      </div>
      <section className="band">
        <div className="tableScroll">
          <table className="skuTable">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Ingredient</th>
                <th>Quantity per portion</th>
                <th>Unit</th>
                <th>Cost per portion</th>
                <th>Waste %</th>
                <th>Final ingredient cost</th>
                <th>Food cost % of SKU</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row: any) => (
                <tr key={row.id}>
                  <td><Link className="skuLink" href={`/sku/${row.skuId}`}>{row.skuName}</Link></td>
                  <td>{row.ingredientName}</td>
                  <td>{row.quantity ?? row.netWeightGrams ?? row.grossWeightGrams ?? 0}</td>
                  <td>{row.unit ?? "g"}</td>
                  <td>{rub(row.costPerUnit ?? row.ingredient?.purchasePrice ?? 0)}</td>
                  <td>{row.yieldLossPercent ?? 0}%</td>
                  <td><strong>{rub(row.costPerPortion)}</strong></td>
                  <td>{percent(row.salePrice ? row.costPerPortion / row.salePrice : 0)}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={8}>Рецептуры пока не заполнены. Откройте SKU и добавьте ингредиенты.</td></tr>}
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
