import type { GetServerSideProps } from "next";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Edit3, Plus, Trash2 } from "lucide-react";
import { Shell } from "@/pages/index";
import { calculateRecipeItemCost } from "@/calculations/financial";
import { loadModel } from "@/lib/model";
import { percent, rub } from "@/lib/format";
import { statusClass } from "@/pages/menu";

export const getServerSideProps: GetServerSideProps = async ({ params }) => {
  const data = await loadModel();
  const id = String(params?.id ?? "");
  const product = data.productsRaw.find((item) => item.id === id);
  const modelProduct = data.products.find((item) => item.id === id);
  const economics = data.economics.find((item) => item.productId === id);
  if (!product || !economics || !modelProduct) return { notFound: true };
  return {
    props: {
      product: JSON.parse(JSON.stringify(product)),
      modelProduct: JSON.parse(JSON.stringify(modelProduct)),
      economics,
      ingredients: JSON.parse(JSON.stringify(data.ingredientsRaw)),
      packaging: JSON.parse(JSON.stringify(data.packagingRaw))
    }
  };
};

export default function SkuDetail({ product, modelProduct, economics, ingredients, packaging }: any) {
  const [skuEditor, setSkuEditor] = useState<any | null>(null);
  const [recipeEditor, setRecipeEditor] = useState<any | null>(null);
  const [packEditor, setPackEditor] = useState<any | null>(null);
  const [ingredientSearch, setIngredientSearch] = useState("");
  const [inlineIngredient, setInlineIngredient] = useState(false);
  const warnings = economics.warnings ?? [];
  const filteredIngredients = useMemo(() => {
    const q = ingredientSearch.toLowerCase().trim();
    if (!q) return ingredients;
    return ingredients.filter((item: any) => [item.name, item.category, item.supplier].some((v) => String(v ?? "").toLowerCase().includes(q)));
  }, [ingredientSearch, ingredients]);

  const deleteSku = async () => {
    if (!confirm(`Удалить SKU "${product.name}"?`)) return;
    const response = await fetch(`/api/products/${product.id}`, { method: "DELETE" });
    if (!response.ok) return alert("Не удалось удалить SKU");
    window.location.href = "/menu";
  };
  const saveSku = async () => {
    const response = await fetch(`/api/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(skuEditor)
    });
    if (!response.ok) return alert("Не удалось сохранить SKU");
    window.location.reload();
  };
  const saveRecipe = async () => {
    let ingredientId = recipeEditor.ingredientId;
    if (inlineIngredient) {
      const response = await fetch("/api/ingredients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(recipeEditor.newIngredient)
      });
      const payload = await response.json();
      if (!response.ok) return alert(payload.error ?? "Не удалось создать ингредиент");
      ingredientId = payload.ingredient.id;
    }
    const url = recipeEditor.id ? `/api/recipe-items/${recipeEditor.id}` : "/api/recipe-items";
    const response = await fetch(url, {
      method: recipeEditor.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...recipeEditor, productId: product.id, ingredientId })
    });
    if (!response.ok) return alert("Не удалось сохранить рецептуру");
    window.location.reload();
  };
  const deleteRecipe = async (id: string) => {
    if (!confirm("Удалить ингредиент из рецептуры?")) return;
    const response = await fetch(`/api/recipe-items/${id}`, { method: "DELETE" });
    if (!response.ok) return alert("Не удалось удалить строку рецептуры");
    window.location.reload();
  };
  const savePackaging = async () => {
    const url = packEditor.id ? `/api/product-packaging/${packEditor.id}` : "/api/product-packaging";
    const response = await fetch(url, {
      method: packEditor.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...packEditor, productId: product.id })
    });
    if (!response.ok) return alert("Не удалось сохранить упаковку");
    window.location.reload();
  };
  const deletePackaging = async (id: string) => {
    if (!confirm("Удалить упаковку из SKU?")) return;
    const response = await fetch(`/api/product-packaging/${id}`, { method: "DELETE" });
    if (!response.ok) return alert("Не удалось удалить упаковку");
    window.location.reload();
  };

  return (
    <Shell>
      <div className="pageHeader">
        <div>
          <h1>{product.name}</h1>
          <p>{product.category} · {rub(product.salePrice)} · source: {product.source} · <Link href="/menu">назад к SKU</Link></p>
          <div className="badgeRow"><span className={`status ${statusClass(economics.status)}`}>{translateStatus(economics.status)}</span>{!product.isActive && <span className="pill warningPill">выключен</span>}</div>
        </div>
        <div className="actions">
          <button onClick={() => setSkuEditor(product)}><Edit3 size={16} /> Редактировать</button>
          <button className="danger" onClick={deleteSku}><Trash2 size={16} /> Удалить</button>
        </div>
      </div>

      <div className="metrics">
        <Metric title="Price" value={rub(economics.salePrice)} />
        <Metric title="Ingredient Cost" value={rub(economics.ingredientCost)} />
        <Metric title="Packaging" value={rub(economics.packagingCost)} />
        <Metric title="Gross Profit" value={rub(economics.grossProfit)} />
        <Metric title="Contribution" value={rub(economics.contributionMargin)} />
        <Metric title="EBITDA/item" value={rub(economics.ebitdaPerItem)} />
        <Metric title="EBITDA Margin" value={percent(economics.ebitdaMarginPercent)} />
        <Metric title="Total Cost/item" value={rub(economics.totalCostPerItem)} />
      </div>

      <div className="twoCol">
        <section className="band">
          <h2>Карточка</h2>
          <p>{product.description || "Описание не заполнено."}</p>
          {product.productUrl && <p><a href={product.productUrl} target="_blank">URL карточки</a></p>}
          {product.imageUrl && <img src={product.imageUrl} alt={product.name} className="productImage" />}
        </section>

        <section className="band warningPanel">
          <h2>Warnings</h2>
          <div className="checks">
            {warnings.map((warning: string) => <div className="check warning" key={warning}>{warning}</div>)}
            {!warnings.length && <div className="check info">Критичных предупреждений по SKU нет.</div>}
          </div>
        </section>
      </div>

      <section className="band">
        <div className="sectionHead">
          <h2>Рецептура</h2>
          <button className="primary" onClick={() => setRecipeEditor({ ingredientId: ingredients[0]?.id ?? "", quantity: 0, unit: "g", yieldLossPercent: 0, comment: "", newIngredient: defaultIngredient() })}><Plus size={16} /> Добавить ингредиент</button>
        </div>
        <div className="tableScroll">
          <table className="skuTable">
            <thead>
              <tr>
                <th className="stickyCol">Ингредиент</th>
                <th>Количество</th>
                <th>Unit</th>
                <th>Purchase price</th>
                <th>Purchase unit</th>
                <th>Cost in portion</th>
                <th>Comment</th>
                <th className="stickyAction">Actions</th>
              </tr>
            </thead>
            <tbody>
              {modelProduct.recipes.map((item: any) => {
                const totalCost = calculateRecipeItemCost(item);
                return (
                  <tr key={item.id}>
                    <td className="stickyCol"><strong>{item.ingredientName}</strong></td>
                    <td>{item.quantity ?? item.netWeightGrams ?? item.grossWeightGrams ?? 0}</td>
                    <td>{item.unit ?? "g"}</td>
                    <td>{rub(item.ingredient?.purchasePrice ?? item.unitPurchasePrice ?? 0)}</td>
                    <td>{item.ingredient?.purchaseUnit ?? item.unitMeasure ?? "kg"}</td>
                    <td><strong>{rub(totalCost)}</strong><div><span className="pill">{recipeCostMode(item)}</span></div></td>
                    <td>{item.comment || "—"}</td>
                    <td className="stickyAction">
                      <div className="iconActions">
                        <button className="iconButton" onClick={() => setRecipeEditor({ ...item, ingredientId: item.ingredientId ?? "", newIngredient: defaultIngredient() })}><Edit3 size={15} /></button>
                        <button className="iconButton dangerText" onClick={() => deleteRecipe(item.id)}><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!modelProduct.recipes.length && <tr><td colSpan={8}>Нет рецептуры. Добавьте ингредиенты вручную, чтобы убрать статус “Нет рецептуры”.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="summaryGrid recipeTotals">
          <div><strong>{rub(economics.ingredientCost)}</strong><span>Total ingredient cost</span></div>
          <div><strong>{rub(economics.packagingCost)}</strong><span>Packaging</span></div>
          <div><strong>{rub(economics.grossProfit)}</strong><span>Gross profit</span></div>
          <div><strong>{percent(economics.grossMarginPercent)}</strong><span>Gross margin</span></div>
        </div>
      </section>

      <section className="band">
        <div className="sectionHead">
          <h2>Упаковка</h2>
          <button className="primary" onClick={() => setPackEditor({ packagingId: packaging[0]?.id ?? "", units: 1, comment: "" })}><Plus size={16} /> Добавить упаковку</button>
        </div>
        <div className="tableScroll">
          <table className="skuTable">
            <thead><tr><th className="stickyCol">Упаковка</th><th>Количество</th><th>Цена за шт</th><th>Стоимость</th><th>Комментарий</th><th className="stickyAction">Actions</th></tr></thead>
            <tbody>
              {product.packagingLinks.map((link: any) => (
                <tr key={link.id}>
                  <td className="stickyCol"><strong>{link.packaging.name}</strong></td>
                  <td>{link.units}</td>
                  <td>{rub(link.packaging.costPerUnit)}</td>
                  <td>{rub(link.packaging.costPerUnit * link.units)}</td>
                  <td>{link.comment || link.packaging.comment || "—"}</td>
                  <td className="stickyAction">
                    <div className="iconActions">
                      <button className="iconButton" onClick={() => setPackEditor({ id: link.id, packagingId: link.packagingId, units: link.units, comment: link.comment ?? "" })}><Edit3 size={15} /></button>
                      <button className="iconButton dangerText" onClick={() => deletePackaging(link.id)}><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {!product.packagingLinks.length && <tr><td colSpan={6}>Нет упаковки. Добавьте упаковку, чтобы убрать предупреждение.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="band">
        <h2>Calculation breakdown</h2>
        <div className="breakdown">
          <Row label="Price" value={rub(economics.salePrice)} strong />
          <Row label="- Ingredient cost" value={rub(economics.ingredientCost)} />
          <Row label="- Packaging" value={rub(economics.packagingCost)} />
          <Row label="- Commissions" value={rub(economics.deliveryCommission + economics.acquiringCost)} />
          <Row label="- Taxes" value={rub(economics.taxPerItem)} />
          <Row label="- Marketing" value={rub(economics.marketingCostPerItem)} />
          <Row label="- Delivery logistics" value={rub(economics.deliveryLogisticsCost)} />
          <Row label="- Fixed allocation" value={rub(economics.allocatedFixedCostPerItem)} />
          <Row label="- Depreciation" value={rub(economics.depreciationPerItem)} />
          <Row label="= EBITDA/item" value={`${rub(economics.ebitdaPerItem)} / ${percent(economics.ebitdaMarginPercent)}`} strong />
        </div>
      </section>

      {skuEditor && (
        <Editor title="Редактировать SKU" onClose={() => setSkuEditor(null)} onSave={saveSku}>
          <label>Название<input value={skuEditor.name} onChange={(e) => setSkuEditor({ ...skuEditor, name: e.target.value })} /></label>
          <label>Категория<input value={skuEditor.category} onChange={(e) => setSkuEditor({ ...skuEditor, category: e.target.value })} /></label>
          <label>Цена, ₽<input type="number" min={0} step={10} value={skuEditor.salePrice} onChange={(e) => setSkuEditor({ ...skuEditor, salePrice: Number(e.target.value) })} /></label>
          <label>Source<select value={skuEditor.source} onChange={(e) => setSkuEditor({ ...skuEditor, source: e.target.value })}><option>MANUAL</option><option>USER_INPUT</option><option>IMPORTED_MENU</option><option>IMPORTED_SIMPLE</option><option>ASSUMPTION</option></select></label>
          <label className="wide">Описание<textarea value={skuEditor.description ?? ""} onChange={(e) => setSkuEditor({ ...skuEditor, description: e.target.value })} /></label>
          <label>Image URL<input value={skuEditor.imageUrl ?? ""} onChange={(e) => setSkuEditor({ ...skuEditor, imageUrl: e.target.value })} /></label>
          <label>Product URL<input value={skuEditor.productUrl ?? ""} onChange={(e) => setSkuEditor({ ...skuEditor, productUrl: e.target.value })} /></label>
          <label className="checkLine"><input type="checkbox" checked={skuEditor.isActive} onChange={(e) => setSkuEditor({ ...skuEditor, isActive: e.target.checked })} /> Активен</label>
        </Editor>
      )}

      {recipeEditor && (
        <Editor title={recipeEditor.id ? "Редактировать рецептуру" : "Добавить ингредиент в SKU"} onClose={() => { setRecipeEditor(null); setInlineIngredient(false); }} onSave={saveRecipe}>
          {!inlineIngredient ? (
            <>
              <label className="wide">Поиск ингредиента<input value={ingredientSearch} onChange={(e) => setIngredientSearch(e.target.value)} placeholder="говядина, сыр, булочка..." /></label>
              <label className="wide">Ингредиент<select value={recipeEditor.ingredientId} onChange={(e) => setRecipeEditor({ ...recipeEditor, ingredientId: e.target.value })}>{filteredIngredients.map((item: any) => <option key={item.id} value={item.id}>{item.name} · {rub(item.purchasePrice)} / {item.purchaseUnit}</option>)}</select></label>
              <button type="button" onClick={() => setInlineIngredient(true)}>Создать ингредиент</button>
            </>
          ) : (
            <>
              <label>Новый ингредиент<input value={recipeEditor.newIngredient.name} onChange={(e) => setRecipeEditor({ ...recipeEditor, newIngredient: { ...recipeEditor.newIngredient, name: e.target.value } })} /></label>
              <label>Категория<input value={recipeEditor.newIngredient.category} onChange={(e) => setRecipeEditor({ ...recipeEditor, newIngredient: { ...recipeEditor.newIngredient, category: e.target.value } })} /></label>
              <label>Цена закупки, ₽<input type="number" min={0} step={10} value={recipeEditor.newIngredient.purchasePrice} onChange={(e) => setRecipeEditor({ ...recipeEditor, newIngredient: { ...recipeEditor.newIngredient, purchasePrice: Number(e.target.value) } })} /></label>
              <label>Единица<select value={recipeEditor.newIngredient.purchaseUnit} onChange={(e) => setRecipeEditor({ ...recipeEditor, newIngredient: { ...recipeEditor.newIngredient, purchaseUnit: e.target.value } })}><option>kg</option><option>g</option><option>liter</option><option>ml</option><option>piece</option></select></label>
              <button type="button" onClick={() => setInlineIngredient(false)}>Выбрать из справочника</button>
            </>
          )}
          <label>Количество<input type="number" min={0} step={1} value={recipeEditor.quantity ?? 0} onChange={(e) => setRecipeEditor({ ...recipeEditor, quantity: Number(e.target.value) })} /></label>
          <label>Единица<select value={recipeEditor.unit ?? "g"} onChange={(e) => setRecipeEditor({ ...recipeEditor, unit: e.target.value })}><option>g</option><option>kg</option><option>ml</option><option>liter</option><option>piece</option></select></label>
          <label>Yield loss, %<input type="number" min={0} max={100} step={1} value={recipeEditor.yieldLossPercent ?? 0} onChange={(e) => setRecipeEditor({ ...recipeEditor, yieldLossPercent: Number(e.target.value) })} /></label>
          <label className="wide">Комментарий<textarea value={recipeEditor.comment ?? ""} onChange={(e) => setRecipeEditor({ ...recipeEditor, comment: e.target.value })} /></label>
        </Editor>
      )}

      {packEditor && (
        <Editor title={packEditor.id ? "Редактировать упаковку SKU" : "Добавить упаковку к SKU"} onClose={() => setPackEditor(null)} onSave={savePackaging}>
          <label className="wide">Упаковка<select value={packEditor.packagingId} onChange={(e) => setPackEditor({ ...packEditor, packagingId: e.target.value })}>{packaging.map((item: any) => <option key={item.id} value={item.id}>{item.name} · {rub(item.costPerUnit)}</option>)}</select></label>
          <label>Количество<input type="number" min={0} step={1} value={packEditor.units ?? 1} onChange={(e) => setPackEditor({ ...packEditor, units: Number(e.target.value) })} /></label>
          <label className="wide">Комментарий<textarea value={packEditor.comment ?? ""} onChange={(e) => setPackEditor({ ...packEditor, comment: e.target.value })} /></label>
          {!packaging.length && <p className="muted wide">Сначала создайте упаковку на странице Ingredients & Packaging.</p>}
        </Editor>
      )}
    </Shell>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  return <div className="metric"><span>{title}</span><strong>{value}</strong></div>;
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return <div className={strong ? "breakdownRow strong" : "breakdownRow"}><span>{label}</span><b>{value}</b></div>;
}

function translateStatus(status: string) {
  const labels: Record<string, string> = {
    good: "Готово",
    warning: "Требуется проверка",
    bad: "Ошибка данных",
    "missing recipe": "Нет рецептуры",
    "missing packaging": "Нет упаковки",
    "negative contribution": "Отрицательная маржа",
    "negative EBITDA": "Отрицательная EBITDA",
    "high food cost": "Высокий Food Cost",
    "low margin": "Низкая маржа"
  };
  return labels[status] ?? status;
}

function Editor({ title, children, onClose, onSave }: any) {
  return (
    <div className="modalBackdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="sectionHead"><h2>{title}</h2><button onClick={onClose}>Закрыть</button></div>
        <div className="gridForm">{children}</div>
        <div className="rowActions"><button onClick={onClose}>Отмена</button><button className="primary" onClick={onSave}>Сохранить</button></div>
      </div>
    </div>
  );
}

function defaultIngredient() {
  return { name: "", category: "", supplier: "", purchasePrice: 0, purchaseUnit: "kg", edibleYieldPercent: 100, storageLossPercent: 0, comment: "", source: "MANUAL" };
}

function recipeCostMode(item: any) {
  return item.source === "USER_PORTION_COST" || item.totalIngredientCost != null ? "manual" : "calculated";
}
