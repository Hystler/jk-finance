import * as XLSX from "xlsx";

export type SimpleExportKind = "menu" | "ingredients" | "recipes";

export const SIMPLE_EXPORT_COLUMNS: Record<SimpleExportKind, string[]> = {
  menu: ["sku_name", "category", "sale_price", "description"],
  ingredients: ["ingredient_name", "category", "purchase_price", "purchase_unit"],
  recipes: ["sku_name", "ingredient_name", "quantity", "unit", "purchase_price", "purchase_unit", "cost_in_portion"]
};

export function toSimpleMenuRows(products: Array<Record<string, unknown>>) {
  return products.map((row) => ({
    sku_name: pick(row, "name", "sku_name"),
    category: pick(row, "category"),
    sale_price: pick(row, "salePrice", "sale_price", "price"),
    description: pick(row, "description")
  }));
}

export function toSimpleIngredientRows(ingredients: Array<Record<string, unknown>>) {
  return ingredients.map((row) => ({
    ingredient_name: pick(row, "name", "ingredientName", "ingredient_name"),
    category: pick(row, "category"),
    purchase_price: pick(row, "purchasePrice", "purchase_price"),
    purchase_unit: pick(row, "purchaseUnit", "purchase_unit")
  }));
}

export function toSimpleRecipeRows(recipes: Array<Record<string, unknown>>) {
  return recipes.map((row) => {
    const source = String(pick(row, "source") ?? "");
    const manualCost = source === "USER_PORTION_COST"
      ? pick(row, "costInPortion", "cost_in_portion", "final_ingredient_cost", "totalIngredientCost", "total_ingredient_cost")
      : "";
    return {
      sku_name: pick(row, "sku_name", "productName", "product_name"),
      ingredient_name: pick(row, "ingredient_name", "ingredientName"),
      quantity: pick(row, "quantity_per_portion", "quantity"),
      unit: pick(row, "unit"),
      purchase_price: pick(row, "purchasePrice", "purchase_price", "unitPurchasePrice", "unit_purchase_price"),
      purchase_unit: pick(row, "purchaseUnit", "purchase_unit", "unitMeasure", "unit_measure"),
      cost_in_portion: manualCost ?? ""
    };
  });
}

export function buildSimpleWorkbook(kind: SimpleExportKind, rows: Array<Record<string, unknown>>) {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(rows, { header: SIMPLE_EXPORT_COLUMNS[kind] });
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName(kind));
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

export function toCsv(kind: SimpleExportKind, rows: Array<Record<string, unknown>>) {
  const columns = SIMPLE_EXPORT_COLUMNS[kind];
  const lines = [
    columns.join(","),
    ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(","))
  ];
  return `${lines.join("\n")}\n`;
}

export function sheetName(kind: SimpleExportKind) {
  if (kind === "menu") return "Simple Menu";
  if (kind === "ingredients") return "Simple Ingredients";
  return "Simple Recipes";
}

function pick(row: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null) return row[key];
  }
  return "";
}

function csvCell(value: unknown) {
  const raw = String(value ?? "");
  if (!/[",\n\r]/.test(raw)) return raw;
  return `"${raw.replace(/"/g, '""')}"`;
}
