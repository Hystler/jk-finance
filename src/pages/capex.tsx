import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { Shell } from "@/pages/index";
import { loadModel } from "@/lib/model";
import { rub } from "@/lib/format";

export async function getServerSideProps() {
  const data = await loadModel();
  return { props: { rows: JSON.parse(JSON.stringify(data.capexRaw)), model: data.model } };
}

export default function CapexPage({ rows: initialRows }: any) {
  const [rows, setRows] = useState<any[]>(initialRows);
  const totals = useMemo(() => {
    const initialInvestment = rows.filter((row) => row.paidBeforeOpening !== false).reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const monthlyDepreciation = rows.reduce((sum, row) => {
      const life = Number(row.usefulLifeMonths || 0);
      return life > 0 ? sum + Number(row.amount || 0) / life : sum;
    }, 0);
    return { initialInvestment, monthlyDepreciation };
  }, [rows]);

  async function remove(id: string) {
    if (!confirm("Удалить статью расхода?")) return;
    const res = await fetch(`/api/capex/${id}`, { method: "DELETE" });
    if (res.ok) setRows((current) => current.filter((row) => row.id !== id));
  }

  async function update(id: string, form: HTMLFormElement) {
    const payload = Object.fromEntries(new FormData(form));
    const res = await fetch(`/api/capex/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      const body = await res.json();
      setRows((current) => current.map((row) => (row.id === id ? body.item : row)));
    }
  }

  return (
    <Shell>
      <div className="pageHeader"><div><h1>CAPEX</h1><p>Расходы открытия и сроки амортизации. Пустой срок полезного использования попадает в checks.</p></div></div>
      <form className="band gridForm" method="post" action="/api/capex">
        <Input name="category" label="Статья" unit="" help="Например: кухонное оборудование" />
        <Input name="amount" label="Сумма" unit="₽" help="Сумма CAPEX" />
        <Input name="usefulLifeMonths" label="Срок амортизации" unit="мес" help="Например: 36" />
        <Input name="supplierComment" label="Поставщик / комментарий" unit="" help="Поставщик или комментарий" />
        <label>Обязательность<select className="badgeSelect" name="required" defaultValue="true"><option value="true">Обязательный</option><option value="false">Необязательный</option></select></label>
        <label>Оплата<select className="badgeSelect" name="paidBeforeOpening" defaultValue="true"><option value="true">До открытия</option><option value="false">После открытия</option></select></label>
        <button className="primary" type="submit">Добавить CAPEX</button>
      </form>
      <section className="band">
        <h2>Инвестиции открытия: {rub(totals.initialInvestment)} · Амортизация / мес: {rub(totals.monthlyDepreciation)}</h2>
        <table>
          <thead><tr><th>Статья</th><th>Сумма</th><th>Амортизация</th><th>Комментарий</th><th>Обязательность</th><th>Оплата</th><th>Действия</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td colSpan={7}>
                  <form className="rowEditor" onSubmit={(event) => { event.preventDefault(); update(row.id, event.currentTarget); }}>
                    <input name="category" defaultValue={row.category} aria-label="Статья" />
                    <input name="amount" defaultValue={row.amount} type="number" min="0" step="10000" aria-label="Сумма" />
                    <input name="usefulLifeMonths" defaultValue={row.usefulLifeMonths ?? ""} type="number" min="1" step="1" aria-label="Срок амортизации" />
                    <input name="supplierComment" defaultValue={row.supplierComment ?? ""} aria-label="Комментарий" />
                    <select className="badgeSelect" name="required" defaultValue={String(row.required)}><option value="true">Обязательный</option><option value="false">Необязательный</option></select>
                    <select className="badgeSelect" name="paidBeforeOpening" defaultValue={String(row.paidBeforeOpening)}><option value="true">До открытия</option><option value="false">После открытия</option></select>
                    <div className="rowActions">
                      <button type="submit">Сохранить</button>
                      <button type="button" className="danger" onClick={() => remove(row.id)}><Trash2 size={15} /> Удалить</button>
                    </div>
                  </form>
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={7}>CAPEX пуст. Импортируйте шаблон или добавьте строки вручную.</td></tr>}
          </tbody>
        </table>
      </section>
    </Shell>
  );
}

function Input({ label, name, unit, help }: { label: string; name: string; unit: string; help: string }) {
  const isAmount = name === "amount";
  const isLife = name === "usefulLifeMonths";
  return (
    <label>{label}{unit ? `, ${unit}` : ""}
      <input name={name} placeholder={help} title={help} type={isAmount || isLife ? "number" : "text"} min={isAmount ? 0 : isLife ? 1 : undefined} step={isAmount ? 10000 : isLife ? 1 : undefined} />
    </label>
  );
}
