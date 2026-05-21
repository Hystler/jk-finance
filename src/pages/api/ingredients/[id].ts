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
  return ["kg", "g", "liter", "ml", "piece"].includes(raw) ? raw : "kg";
};
const source = (value: unknown) => {
  const raw = text(value);
  return ["MANUAL", "IMPORTED", "ASSUMPTION"].includes(raw) ? raw : "MANUAL";
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = String(req.query.id ?? "");
  if (!id) return res.status(400).json({ error: "Missing id" });

  if (req.method === "PATCH" || req.method === "PUT") {
    const ingredient = await prisma.ingredient.update({
      where: { id },
      data: {
        name: text(req.body.name) || "Без названия",
        category: text(req.body.category) || null,
        supplier: text(req.body.supplier) || null,
        purchasePrice: Math.max(0, num(req.body.purchasePrice)),
        purchaseUnit: unit(req.body.purchaseUnit),
        edibleYieldPercent: nullableNum(req.body.edibleYieldPercent),
        storageLossPercent: nullableNum(req.body.storageLossPercent),
        comment: text(req.body.comment) || null,
        source: source(req.body.source)
      }
    });
    return res.json({ ingredient });
  }

  if (req.method === "DELETE") {
    await prisma.recipeItem.updateMany({ where: { ingredientId: id }, data: { ingredientId: null } });
    await prisma.ingredient.delete({ where: { id } });
    return res.json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
