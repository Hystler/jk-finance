import Link from "next/link";
import { useState } from "react";
import { Edit3, Plus, Trash2, Upload } from "lucide-react";
import { Shell } from "@/pages/index";
import { loadModel } from "@/lib/model";
import { percent, rub } from "@/lib/format";

type ViewMode = "basic" | "unit" | "full";

const emptyProduct = {
  id: "",
  category: "",
  name: "",
  description: "",
  salePrice: 0,
  imageUrl: "",
  productUrl: "",
  isActive: true,
  source: "MANUAL"
};

export async function getServerSideProps() {
  const data = await loadModel();
  return {
    props: {
      economics: data.economics,
      products: JSON.parse(JSON.stringify(data.productsRaw)),
      categories: Array.from(new Set(data.productsRaw.map((item) => item.category))).sort()
    }
  };
}

export default function MenuPage({ economics, products, categories }: any) {
  const [mode, setMode] = useState<ViewMode>("basic");
  const [editor, setEditor] = useState<any | null>(null);
  const [created, setCreated] = useState<any | null>(null);

  const openNew = () => {
    setCreated(null);
    setEditor({ ...emptyProduct, category: categories[0] ?? "" });
  };
  const openEdit = (id: string) => {
    const product = products.find((item: any) => item.id === id);
    if (product) setEditor({ ...emptyProduct, ...product });
  };
  const saveProduct = async () => {
    if (!editor?.name?.trim()) return alert("Укажите название SKU");
    const url = editor.id ? `/api/products/${editor.id}` : "/api/products";
    const method = editor.id ? "PATCH" : "POST";
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editor)
    });
    const payload = await response.json();
    if (!response.ok) return alert(payload.error ?? "Не удалось сохранить SKU");
    if (!editor.id) setCreated(payload.product);
    else window.location.reload();
  };
  const deleteProduct = async (id: string, name: string) => {
    if (!confirm(`Удалить SKU "${name}"? Рецептура и упаковка тоже будут удалены.`)) return;
    const response = await fetch(`/api/products/${id}`, { method: "DELETE" });
    if (!response.ok) return alert("Не удалось удалить SKU");
    window.location.reload();
  };
  const patchPrice = async (row: any, value: string) => {
    const salePrice = Number(value.replace(",", "."));
    if (!Number.isFinite(salePrice) || salePrice < 0 || salePrice === row.salePrice) return;
    const product = products.find((item: any) => item.id === row.productId);
    const response = await fetch(`/api/products/${row.productId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...product, salePrice })
    });
    if (!response.ok) return alert("Не удалось изменить цену");
    window.location.reload();
  };

  return (
    <Shell>
      <div className="pageHeader">
        <div>
          <h1>SKU constructor</h1>
          <p>Ручное управление меню, ценами, статусами и unit-economics. Себестоимость считается из рецептур и упаковки в карточке SKU.</p>
        </div>
        <div className="actions">
          <button className="primary" onClick={openNew}><Plus size={16} /> Добавить SKU</button>
          <Link className="button" href="/import"><Upload size={16} /> Импорт</Link>
        </div>
      </div>

      <section className="band">
        <div className="sectionHead">
          <h2>SKU table</h2>
          <div className="segmented">
            <button className={mode === "basic" ? "active" : ""} onClick={() => setMode("basic")}>Basic</button>
            <button className={mode === "unit" ? "active" : ""} onClick={() => setMode("unit")}>Unit economics</button>
            <button className={mode === "full" ? "active" : ""} onClick={() => setMode("full")}>Full finance</button>
          </div>
        </div>
        <div className="tableScroll">
          <table className="skuTable">
            <thead>
              <tr>
                <th>Category</th>
                <th className="stickyCol">SKU</th>
                <th>Price, ₽</th>
                {(mode === "basic" || mode === "unit" || mode === "full") && <th>Ingredient Cost</th>}
                {(mode === "full") && <th>Ingredient %</th>}
                {(mode === "basic" || mode === "unit" || mode === "full") && <th>Packaging</th>}
                {(mode === "unit" || mode === "full") && <th>Variable Cost</th>}
                {mode === "full" && <th>Taxes/item</th>}
                {mode === "full" && <th>Delivery/commission</th>}
                {mode === "full" && <th>Marketing/item</th>}
                {mode === "full" && <th>Depreciation/item</th>}
                {mode === "full" && <th>Fixed Allocation</th>}
                {mode === "full" && <th>Total Cost/item</th>}
                {(mode === "basic" || mode === "full") && <th>Gross Profit</th>}
                {(mode === "basic" || mode === "full") && <th>Gross Margin</th>}
                {(mode === "unit" || mode === "full") && <th>Contribution</th>}
                {mode === "full" && <th>Contribution %</th>}
                {(mode === "unit" || mode === "full") && <th>EBITDA/item</th>}
                {(mode === "unit" || mode === "full") && <th>EBITDA %</th>}
                <th>Status</th>
                <th className="stickyAction">Actions</th>
              </tr>
            </thead>
            <tbody>
              {economics.map((row: any) => (
                <tr key={row.productId} className={!products.find((p: any) => p.id === row.productId)?.isActive ? "inactiveRow" : ""}>
                  <td>{row.category}</td>
                  <td className="stickyCol"><Link className="skuLink" href={`/sku/${row.productId}`}>{row.name}</Link></td>
                  <td>
                    <input
                      className="priceInput"
                      type="number"
                      min={0}
                      step={10}
                      defaultValue={Math.round(row.salePrice)}
                      onBlur={(event) => patchPrice(row, event.currentTarget.value)}
                      aria-label={`Цена ${row.name}`}
                    />
                  </td>
                  {(mode === "basic" || mode === "unit" || mode === "full") && <MoneyCell value={row.ingredientCost} />}
                  {mode === "full" && <td>{percent(row.salePrice ? row.ingredientCost / row.salePrice : 0)}</td>}
                  {(mode === "basic" || mode === "unit" || mode === "full") && <MoneyCell value={row.packagingCost} />}
                  {(mode === "unit" || mode === "full") && <MoneyCell value={row.totalVariableCost} />}
                  {mode === "full" && <MoneyCell value={row.taxPerItem} />}
                  {mode === "full" && <MoneyCell value={row.deliveryCommission + row.deliveryLogisticsCost} />}
                  {mode === "full" && <MoneyCell value={row.marketingCostPerItem} />}
                  {mode === "full" && <MoneyCell value={row.depreciationPerItem} />}
                  {mode === "full" && <MoneyCell value={row.allocatedFixedCostPerItem} />}
                  {mode === "full" && <MoneyCell value={row.totalCostPerItem} />}
                  {(mode === "basic" || mode === "full") && <MoneyCell value={row.grossProfit} />}
                  {(mode === "basic" || mode === "full") && <td className={row.grossMarginPercent < 0 ? "negative" : "positive"}>{percent(row.grossMarginPercent)}</td>}
                  {(mode === "unit" || mode === "full") && <MoneyCell value={row.contributionMargin} />}
                  {mode === "full" && <td className={row.contributionMarginPercent < 0 ? "negative" : "positive"}>{percent(row.contributionMarginPercent)}</td>}
                  {(mode === "unit" || mode === "full") && <MoneyCell value={row.ebitdaPerItem} />}
                  {(mode === "unit" || mode === "full") && <td className={row.ebitdaMarginPercent < 0 ? "negative" : "positive"}>{percent(row.ebitdaMarginPercent)}</td>}
                  <td>
                    <span className={`status ${statusClass(row.status)}`} title={row.warnings?.join("\n")}>{translateStatus(row.status)}</span>
                  </td>
                  <td className="stickyAction">
                    <div className="iconActions">
                      <Link className="iconButton" href={`/sku/${row.productId}`} title="Карточка SKU">↗</Link>
                      <button className="iconButton" onClick={() => openEdit(row.productId)} title="Редактировать"><Edit3 size={15} /></button>
                      <button className="iconButton dangerText" onClick={() => deleteProduct(row.productId, row.name)} title="Удалить"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {!products.length && <tr><td colSpan={22}>Меню пустое. Добавьте SKU вручную или импортируйте меню.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {editor && (
        <div className="modalBackdrop" role="dialog" aria-modal="true">
          <div className="modal">
            <div className="sectionHead">
              <h2>{editor.id ? "Редактировать SKU" : "Добавить SKU"}</h2>
              <button onClick={() => { setEditor(null); setCreated(null); }}>Закрыть</button>
            </div>
            {!created ? (
              <div className="gridForm">
                <label>Название<input value={editor.name} onChange={(e) => setEditor({ ...editor, name: e.target.value })} /></label>
                <label>Категория<input list="categories" value={editor.category} onChange={(e) => setEditor({ ...editor, category: e.target.value })} /></label>
                <datalist id="categories">{categories.map((item: string) => <option key={item} value={item} />)}</datalist>
                <label>Цена, ₽<input type="number" min={0} step={10} value={editor.salePrice} onChange={(e) => setEditor({ ...editor, salePrice: Number(e.target.value) })} /></label>
                <label>Source<select value={editor.source} onChange={(e) => setEditor({ ...editor, source: e.target.value })}><option>MANUAL</option><option>IMPORTED_MENU</option><option>ASSUMPTION</option></select></label>
                <label className="wide">Описание<textarea value={editor.description ?? ""} onChange={(e) => setEditor({ ...editor, description: e.target.value })} /></label>
                <label>Image URL<input value={editor.imageUrl ?? ""} onChange={(e) => setEditor({ ...editor, imageUrl: e.target.value })} /></label>
                <label>Product URL<input value={editor.productUrl ?? ""} onChange={(e) => setEditor({ ...editor, productUrl: e.target.value })} /></label>
                <label className="checkLine"><input type="checkbox" checked={editor.isActive} onChange={(e) => setEditor({ ...editor, isActive: e.target.checked })} /> Активен</label>
                <div className="rowActions wide">
                  <button onClick={() => setEditor(null)}>Отмена</button>
                  <button className="primary" onClick={saveProduct}>Сохранить</button>
                </div>
              </div>
            ) : (
              <div className="successPanel">
                <h3>SKU создан</h3>
                <p>Теперь можно заполнить рецептуру и упаковку, чтобы Unit Economics стала реальной.</p>
                <div className="actions">
                  <Link className="button primary" href={`/sku/${created.id}`}>Добавить рецептуру</Link>
                  <Link className="button" href={`/sku/${created.id}`}>Добавить упаковку</Link>
                  <Link className="button" href={`/sku/${created.id}`}>Посмотреть unit-economics</Link>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Shell>
  );
}

function MoneyCell({ value }: { value: number }) {
  return <td className={`moneyCell ${value < 0 ? "negative" : value > 0 ? "positive" : ""}`}>{rub(value)}</td>;
}

export function statusClass(status: string) {
  return status.replace(/\s+/g, "-");
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
