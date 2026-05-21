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
  const id = String(req.query.id ?? "");
  if (!id) return res.status(400).json({ error: "Missing id" });

  if (req.method === "PATCH" || req.method === "PUT") {
    const ingredientId = text(req.body.ingredientId);
    const ingredient = ingredientId ? await prisma.ingredient.findUnique({ where: { id: ingredientId } }) : null;
    const item = await prisma.recipeItem.update({
      where: { id },
      data: {
        ingredientId: ingredientId || undefined,
        ingredientName: ingredient?.name ?? (text(req.body.ingredientName) || undefined),
        quantity: Math.max(0, num(req.body.quantity)),
        unit: unit(req.body.unit),
        yieldLossPercent: nullableNum(req.body.yieldLossPercent),
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
