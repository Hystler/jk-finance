import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/db";

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
const unit = (value: unknown) => {
  const raw = text(value);
  return ["g", "ml", "piece"].includes(raw) ? raw : "g";
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const productId = text(req.body.productId);
  const ingredientId = text(req.body.ingredientId);
  if (!productId || !ingredientId) return res.status(400).json({ error: "productId and ingredientId are required" });
  const ingredient = await prisma.ingredient.findUnique({ where: { id: ingredientId } });
  if (!ingredient) return res.status(404).json({ error: "Ingredient not found" });

  const item = await prisma.recipeItem.create({
    data: {
      productId,
      ingredientId,
      ingredientName: ingredient.name,
      quantity: Math.max(0, num(req.body.quantity)),
      unit: unit(req.body.unit),
      yieldLossPercent: nullableNum(req.body.yieldLossPercent),
      comment: text(req.body.comment) || null,
      source: "MANUAL"
    }
  });
  return res.status(201).json({ item });
}
