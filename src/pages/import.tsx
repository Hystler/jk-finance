import { useState } from "react";
import * as XLSX from "xlsx";
import { Shell } from "@/pages/index";

const importKinds = [
  ["menu", "Import menu"],
  ["ingredients", "Import ingredients"],
  ["recipes", "Import recipes"],
  ["capex", "Import CAPEX"],
  ["opex", "Import OPEX"],
  ["tax", "Import tax assumptions"]
] as const;

const templates = [
  "menu_template.csv",
  "ingredients_template.csv",
  "recipes_template.csv",
  "capex_template.csv",
  "opex_template.csv",
  "tax_settings_template.csv"
];

const exports = [
  ["Export full model", "/api/export/full", "Ready"],
  ["Export investor report", "", "Prepared"],
  ["Export SKU economics", "", "Prepared"],
  ["Export audit report", "", "Prepared"]
] as const;

export default function ImportPage() {
  const [message, setMessage] = useState("");

  async function upload(kind: string, file?: File) {
    if (!file) return;
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });
    const res = await fetch(`/api/import/${kind}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows })
    });
    const body = await res.json();
    setMessage(res.ok ? `Импортировано: ${body.count}` : body.error);
  }

  return (
    <Shell>
      <div className="pageHeader">
        <div>
          <h1>Import CSV/XLSX</h1>
          <p>Загрузите меню, рецептуры, ингредиенты, CAPEX, OPEX и налоги. Все импортируемые финансовые поля остаются редактируемыми assumptions, если не пришли из публичного меню.</p>
        </div>
      </div>
      <section className="band">
        <div className="sectionHead"><h2>Import structure</h2><span>CSV/XLSX upload into existing data directories</span></div>
        <div className="gridForm">
          {importKinds.map(([kind, label]) => (
            <label key={kind}>{label}<input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => upload(kind, e.target.files?.[0])} /></label>
          ))}
        </div>
        {message && <p><strong>{message}</strong></p>}
      </section>
      <section className="band">
        <div className="sectionHead"><h2>Export structure</h2><span>Full XLSX is active; investor/SKU/audit exports are reserved endpoints for the next iteration.</span></div>
        <table>
          <tbody>
            {exports.map(([label, href, status]) => (
              <tr key={label}>
                <td>{href ? <a className="subtleLink" href={href}>{label}</a> : label}</td>
                <td><span className={status === "Ready" ? "status good" : "pill"}>{status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="band">
        <h2>CSV templates</h2>
        <table><tbody>{templates.map((name) => <tr key={name}><td>{name}</td><td><a href={`/templates/${name}`}>download</a></td></tr>)}</tbody></table>
      </section>
    </Shell>
  );
}
