import type { NextApiRequest, NextApiResponse } from "next";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import {
  importSimpleIngredients,
  importSimpleMenu,
  importSimpleRecipes,
  isSimpleImportKind,
  normalizeSimpleImportKind,
  type SimpleImportDb
} from "@/imports/simple";
import { createEmptySimpleSummary, normalizeSimpleUnit, parseRequiredNumber } from "@/imports/simple";
import { validateUnitCompatibility } from "@/lib/recipe-cost";

const text = (value: unknown) => String(value ?? "").trim();
const num = (value: unknown) => {
  const n = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const nullableNum = (value: unknown) => {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const n = Number(raw.replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
const bool = (value: unknown, fallback = true) => {
  const raw = String(value ?? "").toLowerCase().trim();
  if (!raw) return fallback;
  return ["true", "yes", "1", "да"].includes(raw);
};
const stableId = (prefix: string, value: string) => `${prefix}-${createHash("sha1").update(value).digest("hex").slice(0, 16)}`;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const kind = String(req.query.kind);
  const rows = Array.isArray(req.body.rows) ? req.body.rows : [];

  try {
    if (isSimpleImportKind(kind)) {
      const simpleKind = normalizeSimpleImportKind(kind);
      const db = simpleImportDb();
      const summary =
        simpleKind === "menu_simple" ? await importSimpleMenu(rows, db) :
        simpleKind === "ingredients_simple" ? await importSimpleIngredients(rows, db) :
        await importSimpleRecipes(rows, db);
      const count =
        summary.createdSku +
        summary.updatedSku +
        summary.createdIngredients +
        summary.updatedIngredients +
        summary.addedRecipeRows +
        summary.updatedRecipeRows;
      return res.json({ count, summary });
    }

    if (kind === "menu") {
      let count = 0;
      for (const row of rows) {
        const name = text(row.name ?? row.Name ?? row["название"] ?? row["Название"]);
        if (!name) continue;
        const category = text(row.category ?? row["категория"]) || "Uncategorized";
        const productUrl = text(row.product_url ?? row.productUrl) || null;
        const id = text(row.id) || stableId("menu", productUrl ?? `${category}:${name}`);
        const data = {
          category,
          name,
          description: text(row.description ?? row["описание"]),
          salePrice: num(row.sale_price ?? row.salePrice ?? row.price ?? row["цена"]),
          imageUrl: text(row.image_url ?? row.imageUrl),
          productUrl,
          source: text(row.source) === "IMPORTED_MENU" ? "IMPORTED_MENU" : "MANUAL"
        };
        await prisma.product.upsert({
          where: productUrl ? { productUrl } : { category_name: { category, name } },
          update: data,
          create: { id, ...data }
        });
        count += 1;
      }
      return res.json({ count });
    }

    if (kind === "ingredients") {
      let count = 0;
      for (const row of rows) {
        const name = text(row.name ?? row.ingredient_name ?? row["ингредиент"]);
        if (!name) continue;
        await prisma.ingredient.upsert({
          where: { name },
          update: {
            supplier: text(row.supplier),
            purchasePrice: num(row.purchase_price ?? row.purchasePrice),
            purchaseUnit: text(row.purchase_unit ?? row.purchaseUnit) || "kg",
            edibleYieldPercent: nullableNum(row.edible_yield_percent ?? row.edibleYieldPercent),
            storageLossPercent: nullableNum(row.storage_loss_percent ?? row.storageLossPercent),
            category: text(row.category),
            comment: text(row.comment),
            source: "MANUAL"
          },
          create: {
            name,
            supplier: text(row.supplier),
            purchasePrice: num(row.purchase_price ?? row.purchasePrice),
            purchaseUnit: text(row.purchase_unit ?? row.purchaseUnit) || "kg",
            edibleYieldPercent: nullableNum(row.edible_yield_percent ?? row.edibleYieldPercent),
            storageLossPercent: nullableNum(row.storage_loss_percent ?? row.storageLossPercent),
            category: text(row.category),
            comment: text(row.comment),
            source: "MANUAL"
          }
        });
        count += 1;
      }
      return res.json({ count });
    }

    if (kind === "recipes") {
      const summary = createEmptySimpleSummary();
      for (const [index, row] of rows.entries()) {
        const rowNumber = index + 2;
        const productId = text(row.sku_id ?? row.product_id ?? row.productId);
        const productName = text(row.sku_name ?? row.product_name ?? row.productName ?? row.name);
        const ingredientId = text(row.ingredient_id ?? row.ingredientId);
        const ingredientName = text(row.ingredient_name ?? row.ingredientName);
        const quantity = parseRequiredNumber(row.quantity_per_portion ?? row.quantity ?? row.net_weight_grams ?? row.netWeightGrams ?? row.gross_weight_grams ?? row.grossWeightGrams);
        const recipeUnit = normalizeSimpleUnit(row.unit);
        const wastePercent = nullableNum(row.waste_percent ?? row.yield_loss_percent ?? row.yieldLossPercent) ?? 0;
        const finalCost = nullableNum(row.final_ingredient_cost ?? row.total_ingredient_cost ?? row.totalIngredientCost);

        const product = productId
          ? await prisma.product.findUnique({ where: { id: productId } })
          : productName
            ? await prisma.product.findFirst({ where: { name: productName } })
            : null;
        if (!product) {
          summary.errors.push({ row_number: rowNumber, type: "recipes", message: `SKU не найден: ${productName || productId || "empty"}`, raw_value: productName || productId });
          continue;
        }
        const ingredient = ingredientId
          ? await prisma.ingredient.findUnique({ where: { id: ingredientId } })
          : ingredientName
            ? await prisma.ingredient.findUnique({ where: { name: ingredientName } })
            : null;
        if (!ingredient) {
          summary.errors.push({ row_number: rowNumber, type: "recipes", message: `Ingredient не найден: ${ingredientName || ingredientId || "empty"}`, raw_value: ingredientName || ingredientId });
          continue;
        }
        if (quantity == null || quantity <= 0) {
          summary.errors.push({ row_number: rowNumber, type: "recipes", message: "quantity_per_portion должен быть > 0.", raw_value: String(row.quantity_per_portion ?? row.quantity ?? "") });
          continue;
        }
        if (!recipeUnit) {
          summary.errors.push({ row_number: rowNumber, type: "recipes", message: "Unit должен быть одним из: kg, g, liter, ml, piece.", raw_value: text(row.unit) });
          continue;
        }
        if (wastePercent < 0) {
          summary.errors.push({ row_number: rowNumber, type: "recipes", message: "waste_percent должен быть >= 0.", raw_value: String(row.waste_percent ?? row.yield_loss_percent ?? "") });
          continue;
        }
        const compatibility = validateUnitCompatibility(ingredient.purchaseUnit, recipeUnit);
        if (!compatibility.ok) {
          summary.errors.push({ row_number: rowNumber, type: "recipes", message: compatibility.message ?? "Несовместимые единицы.", raw_value: `${ingredient.purchaseUnit} -> ${recipeUnit}` });
          continue;
        }

        const data = {
          productId: product.id,
          ingredientId: ingredient.id,
          ingredientName: ingredient.name,
          quantity,
          unit: recipeUnit,
          grossWeightGrams: null,
          netWeightGrams: null,
          yieldLossPercent: wastePercent,
          unitPurchasePrice: null,
          unitMeasure: ingredient.purchaseUnit,
          costPerUnit: null,
          totalIngredientCost: finalCost,
          comment: text(row.comment) || null,
          source: finalCost != null ? "USER_PORTION_COST" : "MANUAL"
        };
        const existing = await prisma.recipeItem.findFirst({ where: { productId: product.id, ingredientId: ingredient.id } });
        if (existing) {
          await prisma.recipeItem.update({ where: { id: existing.id }, data });
          summary.updatedRecipeRows += 1;
        } else {
          await prisma.recipeItem.create({ data });
          summary.addedRecipeRows += 1;
        }
      }
      return res.json({ count: summary.addedRecipeRows + summary.updatedRecipeRows, summary });
    }

    if (kind === "capex") {
      const created = await prisma.capexItem.createMany({
        data: rows.map((row: any) => ({
          category: text(row.category ?? row["статья"]),
          amount: num(row.amount ?? row["сумма"]),
          usefulLifeMonths: nullableNum(row.useful_life_months ?? row.usefulLifeMonths),
          supplierComment: text(row.supplier_comment ?? row.supplierComment ?? row.comment),
          required: bool(row.required, true),
          paidBeforeOpening: bool(row.paid_before_opening ?? row.paidBeforeOpening, true),
          source: "ASSUMPTION" as const
        })).filter((row: any) => row.category)
      });
      return res.json({ count: created.count });
    }

    if (kind === "opex") {
      const created = await prisma.opexItem.createMany({
        data: rows.map((row: any) => ({
          category: text(row.category ?? row["статья"]),
          amount: num(row.amount ?? row["сумма"]),
          behavior: text(row.behavior).toUpperCase() === "VARIABLE" ? "VARIABLE" as const : "FIXED" as const,
          driver: ["LINKED_TO_REVENUE", "LINKED_TO_ORDERS", "LINKED_TO_ITEMS"].includes(text(row.driver).toUpperCase()) ? text(row.driver).toUpperCase() as any : "FIXED" as const,
          comment: text(row.comment),
          source: "ASSUMPTION" as const
        })).filter((row: any) => row.category)
      });
      return res.json({ count: created.count });
    }

    if (kind === "tax") {
      const row = rows[0] ?? {};
      const existing = await prisma.taxSettings.findFirst();
      const data = {
        taxSystem: text(row.tax_system ?? row.taxSystem),
        revenueTaxRate: nullableNum(row.revenue_tax_rate ?? row.revenueTaxRate),
        profitTaxRate: nullableNum(row.profit_tax_rate ?? row.profitTaxRate),
        payrollTaxRate: nullableNum(row.payroll_tax_rate ?? row.payrollTaxRate),
        vatRate: nullableNum(row.vat_rate ?? row.vatRate),
        otherTaxes: num(row.other_taxes ?? row.otherTaxes),
        source: "ASSUMPTION" as const
      };
      if (existing) await prisma.taxSettings.update({ where: { id: existing.id }, data });
      else await prisma.taxSettings.create({ data });
      return res.json({ count: 1 });
    }

    return res.status(400).json({ error: "Unknown import kind" });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : "Import failed" });
  }
}

function simpleImportDb(): SimpleImportDb {
  return {
    findProductByNameCategory: (name, category) =>
      prisma.product.findUnique({ where: { category_name: { category, name } } }),
    findProductByName: (name) =>
      prisma.product.findFirst({ where: { name }, orderBy: { createdAt: "asc" } }),
    createProduct: (data) =>
      prisma.product.create({ data }),
    updateProduct: (id, data) =>
      prisma.product.update({ where: { id }, data }),
    findIngredientByName: (name) =>
      prisma.ingredient.findUnique({ where: { name } }),
    createIngredient: (data) =>
      prisma.ingredient.create({ data }),
    updateIngredient: (id, data) =>
      prisma.ingredient.update({ where: { id }, data }),
    findRecipeItem: (productId, ingredientId, ingredientName) =>
      prisma.recipeItem.findFirst({
        where: {
          productId,
          OR: [
            ingredientId ? { ingredientId } : undefined,
            { ingredientName }
          ].filter(Boolean) as any
        }
      }),
    createRecipeItem: (data) =>
      prisma.recipeItem.create({ data }),
    updateRecipeItem: (id, data) =>
      prisma.recipeItem.update({ where: { id }, data })
  };
}
