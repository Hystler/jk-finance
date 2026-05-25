import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/db";
import {
  buildSimpleWorkbook,
  toCsv,
  toSimpleIngredientRows,
  toSimpleMenuRows,
  toSimpleRecipeRows,
  type SimpleExportKind
} from "@/exports/simple";

const exportKinds: SimpleExportKind[] = ["menu", "ingredients", "recipes"];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const kind = String(req.query.kind ?? "");
  if (!isSimpleExportKind(kind)) return res.status(400).json({ error: "Unknown export kind" });

  const format = String(req.query.format ?? "csv").toLowerCase();
  const rows = await loadRows(kind);

  if (format === "xlsx") {
    const buffer = buildSimpleWorkbook(kind, rows);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=jk-finance-${kind}.xlsx`);
    return res.send(buffer);
  }

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename=jk-finance-${kind}.csv`);
  return res.send(`\uFEFF${toCsv(kind, rows)}`);
}

function isSimpleExportKind(kind: string): kind is SimpleExportKind {
  return exportKinds.includes(kind as SimpleExportKind);
}

async function loadRows(kind: SimpleExportKind) {
  if (kind === "menu") {
    const products = await prisma.product.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] });
    return toSimpleMenuRows(products as unknown as Array<Record<string, unknown>>);
  }

  if (kind === "ingredients") {
    const ingredients = await prisma.ingredient.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] });
    return toSimpleIngredientRows(ingredients as unknown as Array<Record<string, unknown>>);
  }

  const recipes = await prisma.recipeItem.findMany({
    include: { ingredient: true, product: true },
    orderBy: [{ product: { category: "asc" } }, { product: { name: "asc" } }, { ingredientName: "asc" }]
  });
  return toSimpleRecipeRows(recipes.map((item) => ({
    productName: item.product.name,
    ingredientName: item.ingredientName,
    quantity: item.quantity,
    unit: item.unit,
    purchasePrice: item.ingredient?.purchasePrice ?? item.unitPurchasePrice,
    purchaseUnit: item.ingredient?.purchaseUnit ?? item.unitMeasure,
    totalIngredientCost: item.totalIngredientCost,
    source: item.source
  })));
}
