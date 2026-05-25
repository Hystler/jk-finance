import { useState } from "react";
import { Download, Upload } from "lucide-react";
import * as XLSX from "xlsx";
import { Shell } from "@/pages/index";

type ImportSummary = {
  createdSku: number;
  updatedSku: number;
  createdIngredients: number;
  updatedIngredients: number;
  addedRecipeRows: number;
  updatedRecipeRows?: number;
  errors: Array<{ row_number: number; type: string; message: string; raw_value: string }>;
  warnings: Array<{ row_number: number; type: string; message: string; raw_value: string }>;
};

const emptySummary: ImportSummary = {
  createdSku: 0,
  updatedSku: 0,
  createdIngredients: 0,
  updatedIngredients: 0,
  addedRecipeRows: 0,
  updatedRecipeRows: 0,
  errors: [],
  warnings: []
};

const simpleImports = [
  { kind: "menu_simple", template: "menu_simple_template.csv", title: "1. Импортируйте меню", upload: "Загрузить menu_simple_template" },
  { kind: "ingredients_simple", template: "ingredients_simple_template.csv", title: "2. Импортируйте ингредиенты", upload: "Загрузить ingredients_simple_template" },
  { kind: "recipes_simple", template: "recipes_simple_template.csv", title: "3. Импортируйте рецептуры", upload: "Загрузить recipes_simple_template" }
] as const;

const advancedImports = [
  ["menu", "menu_template.csv", "Advanced menu"],
  ["ingredients", "ingredients_template.csv", "Advanced ingredients"],
  ["recipes", "recipes_template.csv", "Advanced recipes"],
  ["capex", "capex_template.csv", "CAPEX"],
  ["opex", "opex_template.csv", "OPEX"],
  ["tax", "tax_settings_template.csv", "Tax assumptions"]
] as const;

const exportLinks = [
  ["Export full model", "/api/export/full", "Ready"],
  ["Export investor report", "", "Prepared"],
  ["Export SKU economics", "", "Prepared"],
  ["Export audit report", "", "Prepared"]
] as const;

export default function ImportPage() {
  const [result, setResult] = useState<{ title: string; summary?: ImportSummary; message?: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  async function upload(kind: string, title: string, file?: File) {
    if (!file) return;
    setIsUploading(true);
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });
      const res = await fetch(`/api/import/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows })
      });
      const body = await res.json();
      if (!res.ok) {
        setResult({ title, message: body.error ?? "Import failed" });
        return;
      }
      setResult({
        title,
        summary: body.summary ? { ...emptySummary, ...body.summary } : undefined,
        message: body.summary ? undefined : `Импортировано строк: ${body.count ?? rows.length}`
      });
    } catch (error) {
      setResult({ title, message: error instanceof Error ? error.message : "Import failed" });
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <Shell>
      <div className="pageHeader">
        <div>
          <h1>Import CSV/XLSX</h1>
          <p>Операционный импорт теперь начинается с простых шаблонов: сначала меню, затем ингредиенты с закупочными ценами, затем рецептуры по названиям SKU и ингредиентов. Product ID и технические поля остаются только в Advanced import.</p>
        </div>
      </div>

      <section className="band">
        <div className="sectionHead">
          <h2>Simple import — recommended</h2>
          <span>Для ежедневного заполнения меню, закупок и рецептур</span>
        </div>
        <div className="importGrid">
          {simpleImports.map((item) => (
            <div className="importBox" key={item.kind}>
              <h3>{item.title}</h3>
              <p className="muted">CSV/XLSX с понятными колонками без product_id и технических параметров.</p>
              <div className="actions">
                <a className="button" href={`/templates/${item.template}`}><Download size={16} /> Скачать {item.template}</a>
                <label className="button primary">
                  <Upload size={16} /> {item.upload}
                  <input hidden type="file" accept=".csv,.xlsx,.xls" onChange={(event) => upload(item.kind, item.title, event.target.files?.[0])} />
                </label>
              </div>
            </div>
          ))}
        </div>
      </section>

      {result && (
        <section className="band">
          <div className="sectionHead">
            <h2>Import summary</h2>
            <span>{result.title}</span>
          </div>
          {result.message && <p><strong>{result.message}</strong></p>}
          {result.summary && <Summary summary={result.summary} />}
        </section>
      )}

      <section className="band">
        <div className="sectionHead">
          <h2>Advanced import — for technical users</h2>
          <span>Старые шаблоны с id, tax, yield/loss и техническими полями</span>
        </div>
        <div className="tableScroll">
          <table>
            <tbody>
              {advancedImports.map(([kind, template, label]) => (
                <tr key={kind}>
                  <td>{label}</td>
                  <td><a className="subtleLink" href={`/templates/${template}`}>Скачать {template}</a></td>
                  <td>
                    <label className="button">
                      <Upload size={16} /> Загрузить
                      <input hidden type="file" accept=".csv,.xlsx,.xls" onChange={(event) => upload(kind, label, event.target.files?.[0])} />
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="band">
        <div className="sectionHead"><h2>Export structure</h2><span>Full XLSX includes Simple Menu, Simple Ingredients and Simple Recipes sheets.</span></div>
        <table>
          <tbody>
            {exportLinks.map(([label, href, status]) => (
              <tr key={label}>
                <td>{href ? <a className="subtleLink" href={href}>{label}</a> : label}</td>
                <td><span className={status === "Ready" ? "status good" : "pill"}>{status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {isUploading && <p className="muted">Импорт выполняется...</p>}
    </Shell>
  );
}

function Summary({ summary }: { summary: ImportSummary }) {
  const issues = [...summary.errors, ...summary.warnings];
  return (
    <>
      <div className="summaryGrid">
        <SummaryMetric label="создано SKU" value={summary.createdSku} />
        <SummaryMetric label="обновлено SKU" value={summary.updatedSku} />
        <SummaryMetric label="создано ингредиентов" value={summary.createdIngredients} />
        <SummaryMetric label="обновлено ингредиентов" value={summary.updatedIngredients} />
        <SummaryMetric label="добавлено recipe rows" value={summary.addedRecipeRows} />
        <SummaryMetric label="обновлено recipe rows" value={summary.updatedRecipeRows ?? 0} />
        <SummaryMetric label="ошибок" value={summary.errors.length} />
        <SummaryMetric label="warning" value={summary.warnings.length} />
      </div>
      {issues.length > 0 && (
        <div className="tableScroll">
          <table>
            <thead><tr><th>row_number</th><th>type</th><th>message</th><th>raw_value</th></tr></thead>
            <tbody>
              {issues.map((issue, index) => (
                <tr key={`${issue.row_number}-${issue.type}-${index}`}>
                  <td>{issue.row_number}</td>
                  <td>{issue.type}</td>
                  <td>{issue.message}</td>
                  <td>{issue.raw_value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function SummaryMetric({ label, value }: { label: string; value: number }) {
  return <div><strong>{value}</strong><span>{label}</span></div>;
}
