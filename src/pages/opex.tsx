import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { Shell } from "@/pages/index";
import { loadModel } from "@/lib/model";
import { rub } from "@/lib/format";

export async function getServerSideProps() {
  const data = await loadModel();
  return { props: { rows: JSON.parse(JSON.stringify(data.opexRaw)) } };
}

export default function OpexPage({ rows: initialRows }: any) {
  const [rows, setRows] = useState<any[]>(initialRows);
  const fixedCosts = useMemo(() => rows.filter((row) => row.behavior === "FIXED").reduce((sum, row) => sum + Number(row.amount || 0), 0), [rows]);

  async function remove(id: string) {
    if (!confirm("Удалить статью расхода?")) return;
    const res = await fetch(`/api/opex/${id}`, { method: "DELETE" });
    if (res.ok) setRows((current) => current.filter((row) => row.id !== id));
  }

  async function update(id: string, form: HTMLFormElement) {
    const payload = Object.fromEntries(new FormData(form));
    const res = await fetch(`/api/opex/${id}`, {
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
      <div className="pageHeader"><div><h1>OPEX</h1><p>Ежемесячные расходы: Fixed или Variable, с драйвером Revenue, Orders, Items или Fixed.</p></div></div>
      <form className="band gridForm" method="post" action="/api/opex">
        <Input name="category" label="Статья" help="Например: аренда, ФОТ, коммунальные" />
        <Input name="amount" label="Сумма или ставка" help="₽ / мес, ₽ / заказ, ₽ / SKU или % для LINKED_TO_REVENUE" />
        <label>Behavior<select name="behavior" defaultValue="FIXED"><option>FIXED</option><option>VARIABLE</option></select></label>
        <label>Driver<select name="driver" defaultValue="FIXED"><option>FIXED</option><option>LINKED_TO_REVENUE</option><option>LINKED_TO_ORDERS</option><option>LINKED_TO_ITEMS</option></select></label>
        <label className="wide">Comment<input name="comment" placeholder="Комментарий" /></label>
        <button className="primary" type="submit">Добавить OPEX</button>
      </form>
      <section className="band">
        <h2>Fixed costs: {rub(fixedCosts)}</h2>
        <table>
          <thead><tr><th>Статья</th><th>Сумма/ставка</th><th>Behavior</th><th>Driver</th><th>Comment</th><th>Действия</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td colSpan={6}>
                  <form className="rowEditor opexEditor" onSubmit={(event) => { event.preventDefault(); update(row.id, event.currentTarget); }}>
                    <input name="category" defaultValue={row.category} aria-label="Статья" />
                    <input name="amount" defaultValue={row.amount} type="number" min="0" step={row.driver === "LINKED_TO_REVENUE" ? "1" : "1000"} aria-label="Сумма" />
                    <select name="behavior" defaultValue={row.behavior}><option>FIXED</option><option>VARIABLE</option></select>
                    <select name="driver" defaultValue={row.driver}><option>FIXED</option><option>LINKED_TO_REVENUE</option><option>LINKED_TO_ORDERS</option><option>LINKED_TO_ITEMS</option></select>
                    <input name="comment" defaultValue={row.comment ?? ""} aria-label="Комментарий" />
                    <div className="rowActions">
                      <button type="submit">Сохранить</button>
                      <button type="button" className="danger" onClick={() => remove(row.id)}><Trash2 size={15} /> Удалить</button>
                    </div>
                  </form>
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={6}>OPEX пуст. Импортируйте шаблон или добавьте строки вручную.</td></tr>}
          </tbody>
        </table>
      </section>
    </Shell>
  );
}

function Input({ label, name, help }: { label: string; name: string; help: string }) {
  return <label>{label}<input name={name} placeholder={help} title={help} type={name === "amount" ? "number" : "text"} min={name === "amount" ? 0 : undefined} step={name === "amount" ? 1000 : undefined} /></label>;
}
