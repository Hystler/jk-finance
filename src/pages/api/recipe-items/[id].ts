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
  const id = String(req.query.id ?? "");
  if (!id) return res.status(400).json({ error: "Missing id" });

  if (req.method === "PATCH" || req.method === "PUT") {
    const ingredientId = text(req.body.ingredientId);
    const quantity = num(req.body.quantity);
    const wastePercent = nullableNum(req.body.yieldLossPercent) ?? 0;
    const recipeUnit = normalizeRecipeUnit(req.body.unit);
    if (!ingredientId) return res.status(400).json({ error: "Ingredient is required" });
    if (quantity <= 0) return res.status(400).json({ error: "Quantity must be greater than 0" });
    if (wastePercent < 0) return res.status(400).json({ error: "Waste % must be 0 or greater" });
    if (!recipeUnit) return res.status(400).json({ error: "Unit must be one of: kg, g, liter, ml, piece" });
    const ingredient = await prisma.ingredient.findUnique({ where: { id: ingredientId } });
    if (!ingredient) return res.status(404).json({ error: "Ingredient not found" });
    const compatibility = validateUnitCompatibility(ingredient.purchaseUnit, recipeUnit);
    if (!compatibility.ok) return res.status(400).json({ error: compatibility.message });
    const item = await prisma.recipeItem.update({
      where: { id },
      data: {
        ingredientId,
        ingredientName: ingredient.name,
        quantity,
        unit: recipeUnit,
        yieldLossPercent: wastePercent,
        totalIngredientCost: null,
        comment: text(req.body.comment) || null
      }
    });
    return res.json({ item });
  }

  if (req.method === "DELETE") {
    await prisma.recipeItem.delete({ where: { id } });
    return res.json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
