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
  return ["MANUAL", "IMPORTED", "IMPORTED_SIMPLE", "USER_INPUT", "ASSUMPTION"].includes(raw) ? raw : "MANUAL";
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const ingredients = await prisma.ingredient.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] });
    return res.json({ ingredients });
  }

  if (req.method === "POST") {
    const name = text(req.body.name);
    if (!name) return res.status(400).json({ error: "Name is required" });
    const ingredient = await prisma.ingredient.upsert({
      where: { name },
      update: {
        category: text(req.body.category) || null,
        supplier: text(req.body.supplier) || null,
        purchasePrice: Math.max(0, num(req.body.purchasePrice)),
        purchaseUnit: unit(req.body.purchaseUnit),
        edibleYieldPercent: nullableNum(req.body.edibleYieldPercent),
        storageLossPercent: nullableNum(req.body.storageLossPercent),
        comment: text(req.body.comment) || null,
        source: source(req.body.source)
      },
      create: {
        name,
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
    return res.status(201).json({ ingredient });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
