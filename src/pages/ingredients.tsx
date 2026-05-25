import { useMemo, useState } from "react";
import { Edit3, PackagePlus, Plus, Search, Trash2 } from "lucide-react";
import { Shell } from "@/pages/index";
import { loadModel } from "@/lib/model";
import { rub } from "@/lib/format";

const ingredientBlank = {
  id: "",
  name: "",
  category: "",
  supplier: "",
  purchasePrice: 0,
  purchaseUnit: "kg",
  edibleYieldPercent: 100,
  storageLossPercent: 0,
  comment: "",
  source: "MANUAL"
};

const packagingBlank = {
  id: "",
  name: "",
  supplier: "",
  costPerUnit: 0,
  comment: "",
  source: "MANUAL"
};

export async function getServerSideProps() {
  const data = await loadModel();
  return {
    props: {
      ingredients: JSON.parse(JSON.stringify(data.ingredientsRaw)),
      packaging: JSON.parse(JSON.stringify(data.packagingRaw))
    }
  };
}

export default function IngredientsPage({ ingredients, packaging }: any) {
  const [query, setQuery] = useState("");
  const [ingredientEditor, setIngredientEditor] = useState<any | null>(null);
  const [packagingEditor, setPackagingEditor] = useState<any | null>(null);
  const visibleIngredients = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return ingredients;
    return ingredients.filter((item: any) => [item.name, item.category, item.supplier].some((v) => String(v ?? "").toLowerCase().includes(q)));
  }, [ingredients, query]);

  const saveIngredient = async () => {
    if (!ingredientEditor.name.trim()) return alert("Укажите название ингредиента");
    const url = ingredientEditor.id ? `/api/ingredients/${ingredientEditor.id}` : "/api/ingredients";
    const response = await fetch(url, {
      method: ingredientEditor.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ingredientEditor)
    });
    if (!response.ok) return alert("Не удалось сохранить ингредиент");
    window.location.reload();
  };
  const savePackaging = async () => {
    if (!packagingEditor.name.trim()) return alert("Укажите название упаковки");
    const url = packagingEditor.id ? `/api/packaging/${packagingEditor.id}` : "/api/packaging";
    const response = await fetch(url, {
      method: packagingEditor.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(packagingEditor)
    });
    if (!response.ok) return alert("Не удалось сохранить упаковку");
    window.location.reload();
  };
  const deleteIngredient = async (id: string, name: string) => {
    if (!confirm(`Удалить ингредиент "${name}"? В рецептурах останется текстовое название без привязки к справочнику.`)) return;
    const response = await fetch(`/api/ingredients/${id}`, { method: "DELETE" });
    if (!response.ok) return alert("Не удалось удалить ингредиент");
    window.location.reload();
  };
  const deletePackaging = async (id: string, name: string) => {
    if (!confirm(`Удалить упаковку "${name}"? Привязки к SKU тоже будут удалены.`)) return;
    const response = await fetch(`/api/packaging/${id}`, { method: "DELETE" });
    if (!response.ok) return alert("Не удалось удалить упаковку");
    window.location.reload();
  };

  return (
    <Shell>
      <div className="pageHeader">
        <div>
          <h1>Ingredients & Packaging</h1>
          <p>Справочники закупочных цен, yield/loss и упаковки. Эти данные питают рецептуры SKU и unit-economics.</p>
        </div>
        <div className="actions">
          <button className="primary" onClick={() => setIngredientEditor(ingredientBlank)}><Plus size={16} /> Ингредиент</button>
          <button onClick={() => setPackagingEditor(packagingBlank)}><PackagePlus size={16} /> Упаковка</button>
        </div>
      </div>

      <section className="band">
        <div className="sectionHead">
          <h2>Ингредиенты</h2>
          <label className="searchBox"><Search size={15} /><input placeholder="Поиск по названию, категории, поставщику" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
        </div>
        <div className="tableScroll">
          <table className="skuTable">
            <thead>
              <tr>
                <th className="stickyCol">Название</th>
                <th>Категория</th>
                <th>Поставщик</th>
                <th>Закупка</th>
                <th>Единица</th>
                <th>Cost base unit</th>
                <th>Yield</th>
                <th>Source</th>
                <th className="stickyAction">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleIngredients.map((item: any) => (
                <tr key={item.id}>
                  <td className="stickyCol"><strong>{item.name}</strong><div className="muted">{item.comment}</div></td>
                  <td>{item.category || "—"}</td>
                  <td>{item.supplier || "—"}</td>
                  <td>{rub(item.purchasePrice)}</td>
                  <td>{item.purchaseUnit}</td>
                  <td>{rub(baseUnitCost(item))} / {baseUnit(item.purchaseUnit)}</td>
                  <td>{item.edibleYieldPercent ?? 100}% / loss {item.storageLossPercent ?? 0}%</td>
                  <td><span className="pill">{item.source}</span></td>
                  <td className="stickyAction">
                    <div className="iconActions">
                      <button className="iconButton" onClick={() => setIngredientEditor({ ...ingredientBlank, ...item })}><Edit3 size={15} /></button>
                      <button className="iconButton dangerText" onClick={() => deleteIngredient(item.id, item.name)}><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {!visibleIngredients.length && <tr><td colSpan={9}>Ингредиентов пока нет. Добавьте вручную или импортируйте шаблон.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="band">
        <div className="sectionHead">
          <h2>Упаковка</h2>
          <button onClick={() => setPackagingEditor(packagingBlank)}><Plus size={16} /> Добавить упаковку</button>
        </div>
        <div className="tableScroll">
          <table className="skuTable">
            <thead>
              <tr><th className="stickyCol">Название</th><th>Стоимость</th><th>Поставщик</th><th>Комментарий</th><th>Source</th><th className="stickyAction">Actions</th></tr>
            </thead>
            <tbody>
              {packaging.map((item: any) => (
                <tr key={item.id}>
                  <td className="stickyCol"><strong>{item.name}</strong></td>
                  <td>{rub(item.costPerUnit)}</td>
                  <td>{item.supplier || "—"}</td>
                  <td>{item.comment || "—"}</td>
                  <td><span className="pill">{item.source}</span></td>
                  <td className="stickyAction">
                    <div className="iconActions">
                      <button className="iconButton" onClick={() => setPackagingEditor({ ...packagingBlank, ...item })}><Edit3 size={15} /></button>
                      <button className="iconButton dangerText" onClick={() => deletePackaging(item.id, item.name)}><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {!packaging.length && <tr><td colSpan={6}>Упаковки пока нет.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {ingredientEditor && (
        <EditorModal title={ingredientEditor.id ? "Редактировать ингредиент" : "Добавить ингредиент"} onClose={() => setIngredientEditor(null)} onSave={saveIngredient}>
          <label>Название<input value={ingredientEditor.name} onChange={(e) => setIngredientEditor({ ...ingredientEditor, name: e.target.value })} /></label>
          <label>Категория<input value={ingredientEditor.category ?? ""} onChange={(e) => setIngredientEditor({ ...ingredientEditor, category: e.target.value })} /></label>
          <label>Поставщик<input value={ingredientEditor.supplier ?? ""} onChange={(e) => setIngredientEditor({ ...ingredientEditor, supplier: e.target.value })} /></label>
          <label>Закупочная цена, ₽<input type="number" min={0} step={10} value={ingredientEditor.purchasePrice} onChange={(e) => setIngredientEditor({ ...ingredientEditor, purchasePrice: Number(e.target.value) })} /></label>
          <label>Единица закупки<select value={ingredientEditor.purchaseUnit} onChange={(e) => setIngredientEditor({ ...ingredientEditor, purchaseUnit: e.target.value })}><option>kg</option><option>g</option><option>liter</option><option>ml</option><option>piece</option></select></label>
          <label>Edible yield, %<input type="number" min={0} max={100} step={1} value={ingredientEditor.edibleYieldPercent ?? 100} onChange={(e) => setIngredientEditor({ ...ingredientEditor, edibleYieldPercent: Number(e.target.value) })} /></label>
          <label>Storage loss, %<input type="number" min={0} max={100} step={1} value={ingredientEditor.storageLossPercent ?? 0} onChange={(e) => setIngredientEditor({ ...ingredientEditor, storageLossPercent: Number(e.target.value) })} /></label>
          <label>Source<select value={ingredientEditor.source} onChange={(e) => setIngredientEditor({ ...ingredientEditor, source: e.target.value })}><option>MANUAL</option><option>USER_INPUT</option><option>IMPORTED</option><option>IMPORTED_SIMPLE</option><option>ASSUMPTION</option></select></label>
          <label className="wide">Комментарий<textarea value={ingredientEditor.comment ?? ""} onChange={(e) => setIngredientEditor({ ...ingredientEditor, comment: e.target.value })} /></label>
        </EditorModal>
      )}

      {packagingEditor && (
        <EditorModal title={packagingEditor.id ? "Редактировать упаковку" : "Добавить упаковку"} onClose={() => setPackagingEditor(null)} onSave={savePackaging}>
          <label>Название<input value={packagingEditor.name} onChange={(e) => setPackagingEditor({ ...packagingEditor, name: e.target.value })} /></label>
          <label>Стоимость за штуку, ₽<input type="number" min={0} step={1} value={packagingEditor.costPerUnit} onChange={(e) => setPackagingEditor({ ...packagingEditor, costPerUnit: Number(e.target.value) })} /></label>
          <label>Поставщик<input value={packagingEditor.supplier ?? ""} onChange={(e) => setPackagingEditor({ ...packagingEditor, supplier: e.target.value })} /></label>
          <label>Source<select value={packagingEditor.source} onChange={(e) => setPackagingEditor({ ...packagingEditor, source: e.target.value })}><option>MANUAL</option><option>IMPORTED</option><option>ASSUMPTION</option></select></label>
          <label className="wide">Комментарий<textarea value={packagingEditor.comment ?? ""} onChange={(e) => setPackagingEditor({ ...packagingEditor, comment: e.target.value })} /></label>
        </EditorModal>
      )}
    </Shell>
  );
}

function EditorModal({ title, children, onClose, onSave }: any) {
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

function baseUnitCost(item: any) {
  if (item.purchaseUnit === "kg" || item.purchaseUnit === "liter") return item.purchasePrice / 1000;
  return item.purchasePrice;
}

function baseUnit(unit: string) {
  if (unit === "kg" || unit === "g") return "g";
  if (unit === "liter" || unit === "ml") return "ml";
  return "piece";
}
