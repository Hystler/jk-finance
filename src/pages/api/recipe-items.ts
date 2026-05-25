import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/db";
import { normalizeRecipeUnit, validateUnitCompatibility } from "@/lib/recipe-cost";

const text = (value: unknown) => String(value ?? "").trim();
const num = (value: unknown) => {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
};
const nullableNum = (value: unknown) => {
  const raw = text(value);
  if (!raw) return null;
  const parsed = Number(raw.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const productId = text(req.body.productId);
  const ingredientId = text(req.body.ingredientId);
  if (!productId || !ingredientId) return res.status(400).json({ error: "productId and ingredientId are required" });
  const quantity = num(req.body.quantity);
  const wastePercent = nullableNum(req.body.yieldLossPercent) ?? 0;
  const recipeUnit = normalizeRecipeUnit(req.body.unit);
  if (quantity <= 0) return res.status(400).json({ error: "Quantity must be greater than 0" });
  if (wastePercent < 0) return res.status(400).json({ error: "Waste % must be 0 or greater" });
  if (!recipeUnit) return res.status(400).json({ error: "Unit must be one of: kg, g, liter, ml, piece" });
  const [product, ingredient] = await Promise.all([
    prisma.product.findUnique({ where: { id: productId } }),
    prisma.ingredient.findUnique({ where: { id: ingredientId } })
  ]);
  if (!product) return res.status(404).json({ error: "SKU not found" });
  if (!ingredient) return res.status(404).json({ error: "Ingredient not found" });
  const compatibility = validateUnitCompatibility(ingredient.purchaseUnit, recipeUnit);
  if (!compatibility.ok) return res.status(400).json({ error: compatibility.message });

  const item = await prisma.recipeItem.create({
    data: {
      productId,
      ingredientId,
      ingredientName: ingredient.name,
      quantity,
      unit: recipeUnit,
      yieldLossPercent: wastePercent,
      totalIngredientCost: null,
      comment: text(req.body.comment) || null,
      source: "MANUAL"
    }
  });
  return res.status(201).json({ item });
}
