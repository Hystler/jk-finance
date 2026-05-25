import { useState } from "react";
import { Download, Upload } from "lucide-react";
import * as XLSX from "xlsx";
import { Shell } from "@/pages/index";
import { parseCsvRows } from "@/imports/csv";

type ImportKind = "menu" | "ingredients" | "recipes";

type ImportIssue = {
  row_number: number;
  field: string;
  message: string;
  raw_value?: string;
};

type ImportSummary = {
  createdSku?: number;
  updatedSku?: number;
  createdIngredients?: number;
  createdIngredientsOnTheFly?: number;
  updatedIngredients?: number;
  addedRecipeRows?: number;
  createdRecipeRows?: number;
  updatedRecipeRows?: number;
  skippedRows?: number;
  mergedRows?: number;
  duplicateMatches?: number;
  calculatedRecipeRows?: number;
  manualRecipeRows?: number;
  detectedEncoding?: string | null;
  encodingIssueDetected?: boolean;
  criticalWarnings?: string[];
  errors?: ImportIssue[];
  warnings?: ImportIssue[];
};

type ResultState = {
  kind: ImportKind;
  title: string;
  summary?: ImportSummary;
  message?: string;
  failed?: boolean;
};

const importCards: Array<{
  kind: ImportKind;
  title: string;
  template: string;
  description: string;
  helper: string;
}> = [
  {
    kind: "menu",
    title: "Menu",
    template: "menu_simple_template.csv",
    description: "Позиции меню: название, категория, цена, описание",
    helper: "Загрузите позиции меню"
  },
  {
    kind: "ingredients",
    title: "Ingredients",
    template: "ingredients_simple_template.csv",
    description: "Справочник ингредиентов: название, цена закупки, единица",
    helper: "Загрузите справочник ингредиентов с закупочными ценами"
  },
  {
    kind: "recipes",
    title: "Recipes",
    template: "recipes_simple_template.csv",
    description: "Рецептуры: позиция меню собирается из заранее добавленных ингредиентов",
    helper: "Свяжите позиции меню с ингредиентами и количеством в порции"
  }
];

const exportCards = [
  { kind: "menu", title: "Export Menu", description: "Меню в формате sku_name, category, sale_price, description" },
  { kind: "ingredients", title: "Export Ingredients", description: "Ингредиенты в формате ingredient_name, category, purchase_price, purchase_unit" },
  { kind: "recipes", title: "Export Recipes", description: "Рецептуры в формате sku_name, ingredient_name, quantity, unit, purchase price" }
] as const;

export default function ImportPage() {
  const [result, setResult] = useState<ResultState | null>(null);
  const [uploadingKind, setUploadingKind] = useState<ImportKind | null>(null);

  async function upload(kind: ImportKind, title: string, file?: File) {
    if (!file) return;
    setUploadingKind(kind);
    try {
      const parsed = await parseFile(file);
      const res = await fetch(`/api/import/${kind}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: parsed.rows,
          metadata: {
            detectedEncoding: parsed.detectedEncoding,
            encodingIssueDetected: parsed.encodingIssueDetected
          }
        })
      });
      const body = await res.json();
      if (!res.ok) {
        setResult({ kind, title, failed: true, message: body.error ?? "Import failed" });
        return;
      }
      setResult({ kind, title, summary: body.summary ?? {} });
    } catch (error) {
      setResult({ kind, title, failed: true, message: error instanceof Error ? error.message : "Import failed" });
    } finally {
      setUploadingKind(null);
    }
  }

  return (
    <Shell>
      <div className="pageHeader">
        <div>
          <h1>Import / Export</h1>
          <p>Сначала импортируйте меню, затем ингредиенты, затем рецептуры. Пользовательский workflow работает по названиям SKU и ингредиентов, без product_id и технических полей.</p>
        </div>
      </div>

      <section className="band">
        <div className="sectionHead">
          <h2>Import</h2>
          <span>Сначала импортируйте меню, затем ингредиенты, затем рецептуры</span>
        </div>
        <div className="importGrid">
          {importCards.map((card) => (
            <div className="importBox" key={card.kind}>
              <h3>{card.title}</h3>
              <p>{card.description}</p>
              <p className="muted">{card.helper}</p>
              <div className="actions">
                <a className="button" href={`/templates/${card.template}`}><Download size={16} /> Скачать шаблон</a>
                <label className="button primary">
                  <Upload size={16} /> {uploadingKind === card.kind ? "Загрузка..." : "Загрузить файл"}
                  <input
                    hidden
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={(event) => {
                      upload(card.kind, card.title, event.target.files?.[0]);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
      </section>

      {result && <ImportResult result={result} />}

      <section className="band">
        <div className="sectionHead">
          <h2>Export</h2>
          <span>Выгрузка в том же простом формате, который можно отредактировать и загрузить обратно</span>
        </div>
        <div className="importGrid">
          {exportCards.map((card) => (
            <div className="importBox" key={card.kind}>
              <h3>{card.title}</h3>
              <p>{card.description}</p>
              <div className="actions">
                <a className="button primary" href={`/api/export/${card.kind}`}><Download size={16} /> CSV</a>
                <a className="button" href={`/api/export/${card.kind}?format=xlsx`}><Download size={16} /> XLSX</a>
              </div>
            </div>
          ))}
        </div>
      </section>
    </Shell>
  );
}

async function parseFile(file: File) {
  const buffer = await file.arrayBuffer();
  const isCsv = file.name.toLowerCase().endsWith(".csv") || file.type.includes("csv");
  if (isCsv) return parseCsvRows(buffer);

  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error("Файл пустой или не содержит таблицу.");
  return {
    rows: XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" }),
    detectedEncoding: "xlsx",
    encodingIssueDetected: false
  };
}

function ImportResult({ result }: { result: ResultState }) {
  const summary = result.summary ?? {};
  const errors = summary.errors ?? [];
  const warnings = summary.warnings ?? [];
  return (
    <section className={`band ${result.failed || errors.length || warnings.length || summary.criticalWarnings?.length ? "warningPanel" : "successPanelSoft"}`}>
      <div className="sectionHead">
        <h2>Last import result</h2>
        <span>{result.title}</span>
      </div>
      {result.message ? <p><strong>{result.message}</strong></p> : <SummaryMetrics kind={result.kind} summary={summary} />}
      <SummaryDetails summary={summary} />
      {[...errors, ...warnings].length > 0 && (
        <div className="tableScroll">
          <table>
            <thead><tr><th>Row number</th><th>Field</th><th>Message</th></tr></thead>
            <tbody>
              {[...errors, ...warnings].map((error, index) => (
                <tr key={`${error.row_number}-${error.field}-${index}`}>
                  <td>{error.row_number}</td>
                  <td>{error.field}</td>
                  <td>{error.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function SummaryMetrics({ kind, summary }: { kind: ImportKind; summary: ImportSummary }) {
  if (kind === "menu") {
    return (
      <div className="summaryGrid">
        <SummaryMetric label="Created SKU" value={summary.createdSku ?? 0} />
        <SummaryMetric label="Updated SKU" value={summary.updatedSku ?? 0} />
        <SummaryMetric label="Skipped" value={summary.skippedRows ?? 0} />
        <SummaryMetric label="Merged" value={summary.mergedRows ?? 0} />
        <SummaryMetric label="Errors" value={summary.errors?.length ?? 0} />
      </div>
    );
  }

  if (kind === "ingredients") {
    return (
      <div className="summaryGrid">
        <SummaryMetric label="Created ingredients" value={summary.createdIngredients ?? 0} />
        <SummaryMetric label="Updated ingredients" value={summary.updatedIngredients ?? 0} />
        <SummaryMetric label="Skipped" value={summary.skippedRows ?? 0} />
        <SummaryMetric label="Merged" value={summary.mergedRows ?? 0} />
        <SummaryMetric label="Errors" value={summary.errors?.length ?? 0} />
      </div>
    );
  }

  return (
    <div className="summaryGrid">
      <SummaryMetric label="Created recipe rows" value={summary.createdRecipeRows ?? summary.addedRecipeRows ?? 0} />
      <SummaryMetric label="Updated recipe rows" value={summary.updatedRecipeRows ?? 0} />
      <SummaryMetric label="Created ingredients" value={summary.createdIngredientsOnTheFly ?? 0} />
      <SummaryMetric label="Calculated rows" value={summary.calculatedRecipeRows ?? 0} />
      <SummaryMetric label="Manual rows" value={summary.manualRecipeRows ?? 0} />
      <SummaryMetric label="Skipped" value={summary.skippedRows ?? 0} />
      <SummaryMetric label="Errors" value={summary.errors?.length ?? 0} />
    </div>
  );
}

function SummaryDetails({ summary }: { summary: ImportSummary }) {
  const details = [
    summary.detectedEncoding ? `Detected encoding: ${summary.detectedEncoding}` : null,
    summary.duplicateMatches ? `Duplicate matches: ${summary.duplicateMatches}` : null,
    summary.encodingIssueDetected ? "Encoding issue detected" : null,
    ...(summary.criticalWarnings ?? [])
  ].filter(Boolean);
  if (!details.length) return null;
  return <div className="badgeRow">{details.map((detail) => <span className="status warning" key={detail}>{detail}</span>)}</div>;
}

function SummaryMetric({ label, value }: { label: string; value: number }) {
  return <div><strong>{value}</strong><span>{label}</span></div>;
}
