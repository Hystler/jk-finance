import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Shell } from "@/pages/index";
import { loadModel } from "@/lib/model";
import { calculateFoodCostPercent, calculateRecipeItemCostDetails, calculateSkuRecipeTotal } from "@/lib/recipe-cost";
import { percent, rub } from "@/lib/format";

type RecipeFilter = "all" | "with" | "without";

export async function getServerSideProps() {
  const data = await loadModel();
  const rows = data.products.flatMap((product) => {
    const skuRecipeTotal = calculateSkuRecipeTotal(product);
    const skuFoodCost = calculateFoodCostPercent(skuRecipeTotal, product.salePrice);
    return (product.recipes ?? []).map((recipe) => {
      const cost = calculateRecipeItemCostDetails(recipe);
      return {
        ...recipe,
        skuId: product.id,
        skuName: product.name,
        skuCategory: product.category,
        salePrice: product.salePrice,
        costPerPortion: cost.costPerPortion,
        finalIngredientCost: cost.finalIngredientCost,
        foodCostPercent: calculateFoodCostPercent(cost.finalIngredientCost, product.salePrice),
        skuRecipeTotal,
        skuFoodCost
      };
    });
  });
  const products = data.products.map((product) => ({
    id: product.id,
    name: product.name,
    category: product.category,
    salePrice: product.salePrice,
    recipeRows: product.recipes?.length ?? 0,
    recipeTotal: calculateSkuRecipeTotal(product),
    foodCostPercent: calculateFoodCostPercent(calculateSkuRecipeTotal(product), product.salePrice)
  }));
  return { props: { rows: JSON.parse(JSON.stringify(rows)), products: JSON.parse(JSON.stringify(products)) } };
}

export default function RecipesPage({ rows, products }: any) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [filter, setFilter] = useState<RecipeFilter>("all");
  const categories = useMemo<string[]>(() => {
    const values = products.map((item: any) => String(item.category ?? "")).filter((value: string) => value.length > 0);
    return Array.from(new Set<string>(values)).sort();
  }, [products]);
  const missingProducts = useMemo(() => products.filter((product: any) => product.recipeRows === 0), [products]);
  const visibleRows = useMemo(() => {
    const q = query.toLowerCase().trim();
    return rows.filter((row: any) => {
      if (filter === "without") return false;
      if (category !== "all" && row.skuCategory !== category) return false;
      if (!q) return true;
      return [row.skuName, row.ingredientName, row.skuCategory].some((value) => String(value ?? "").toLowerCase().includes(q));
    });
  }, [category, filter, query, rows]);
  const visibleMissingProducts = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (filter === "with") return [];
    return missingProducts.filter((product: any) => {
      if (category !== "all" && product.category !== category) return false;
      if (!q) return true;
      return [product.name, product.category].some((value) => String(value ?? "").toLowerCase().includes(q));
    });
  }, [category, filter, missingProducts, query]);
  const groupedRows = groupRowsBySku(visibleRows);
  const totalRecipeCost = rows.reduce((sum: number, row: any) => sum + row.finalIngredientCost, 0);

  return (
    <Shell>
      <div className="pageHeader">
        <div>
          <h1>Recipes</h1>
          <p>Справочник рецептур: реальные строки состава SKU, стоимость порции, waste и food cost по каждой позиции меню.</p>
        </div>
      </div>
      <div className="metrics">
        <Metric title="Recipe rows" value={String(rows.length)} />
        <Metric title="SKU without recipes" value={String(missingProducts.length)} />
        <Metric title="Total recipe cost" value={rub(totalRecipeCost)} />
      </div>

      <section className="band">
        <div className="tableToolbar">
          <label className="searchBox"><Search size={15} /><input placeholder="Search by SKU / ingredient" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
          <div className="actions">
            <label>Category<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">All categories</option>{categories.map((item: string) => <option value={item} key={item}>{item}</option>)}</select></label>
            <div className="segmented">
              <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>All</button>
              <button className={filter === "with" ? "active" : ""} onClick={() => setFilter("with")}>With recipes</button>
              <button className={filter === "without" ? "active" : ""} onClick={() => setFilter("without")}>Without recipes</button>
            </div>
          </div>
        </div>

        {filter !== "without" && visibleRows.length > 0 && (
          <div className="tableScroll">
            <table className="skuTable">
              <thead>
                <tr>
                  <th className="stickyCol">SKU</th>
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
                {groupedRows.flatMap((group: any) => [
                  ...group.rows.map((row: any) => (
                    <tr key={row.id}>
                      <td className="stickyCol"><Link className="skuLink" href={`/sku/${row.skuId}`}>{row.skuName}</Link><div className="muted">{row.skuCategory}</div></td>
                      <td>{row.ingredientName}</td>
                      <td>{row.quantity ?? row.netWeightGrams ?? row.grossWeightGrams ?? 0}</td>
                      <td>{row.unit ?? "g"}</td>
                      <td>{rub(row.costPerPortion)}</td>
                      <td>{row.yieldLossPercent ?? 0}%</td>
                      <td><strong>{rub(row.finalIngredientCost)}</strong></td>
                      <td>{row.foodCostPercent == null ? "—" : percent(row.foodCostPercent)}</td>
                    </tr>
                  )),
                  <tr className="subtotalRow" key={`${group.skuId}-subtotal`}>
                    <td className="stickyCol"><strong>{group.skuName} subtotal</strong></td>
                    <td colSpan={5}>{group.rows.length} ingredients</td>
                    <td><strong>{rub(group.recipeTotal)}</strong></td>
                    <td>{group.foodCostPercent == null ? "—" : percent(group.foodCostPercent)}</td>
                  </tr>
                ])}
              </tbody>
            </table>
          </div>
        )}

        {filter !== "with" && visibleMissingProducts.length > 0 && (
          <div className="tableScroll missingRecipeTable">
            <table>
              <thead><tr><th>SKU without recipe</th><th>Category</th><th>Price</th><th>Action</th></tr></thead>
              <tbody>
                {visibleMissingProducts.map((product: any) => (
                  <tr key={product.id}>
                    <td><Link className="skuLink" href={`/sku/${product.id}`}>{product.name}</Link></td>
                    <td>{product.category}</td>
                    <td>{rub(product.salePrice)}</td>
                    <td><Link className="button" href={`/sku/${product.id}`}>Go to SKU</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!visibleRows.length && !visibleMissingProducts.length && (
          <div className="emptyState">
            <div>
              <strong>Рецептуры пока не заполнены.</strong>
              <p>Откройте SKU и добавьте ингредиенты.</p>
              <Link className="button primary" href="/menu">Go to SKU</Link>
            </div>
          </div>
        )}
      </section>
    </Shell>
  );
}

function groupRowsBySku(rows: any[]) {
  const groups = new Map<string, any>();
  for (const row of rows) {
    const group = groups.get(row.skuId) ?? {
      skuId: row.skuId,
      skuName: row.skuName,
      recipeTotal: row.skuRecipeTotal,
      foodCostPercent: row.skuFoodCost,
      rows: []
    };
    group.rows.push(row);
    groups.set(row.skuId, group);
  }
  return Array.from(groups.values());
}

function Metric({ title, value }: { title: string; value: string }) {
  return <div className="metric"><span>{title}</span><strong>{value}</strong></div>;
}
