import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/db";

const text = (value: unknown) => String(value ?? "").trim();
const num = (value: unknown) => {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
};
const bool = (value: unknown, fallback = true) => {
  if (typeof value === "boolean") return value;
  const raw = text(value).toLowerCase();
  if (!raw) return fallback;
  return ["true", "1", "yes", "on", "да"].includes(raw);
};
const source = (value: unknown) => {
  const raw = text(value);
  return ["IMPORTED_MENU", "IMPORTED_SIMPLE", "USER_INPUT", "MANUAL", "ASSUMPTION"].includes(raw) ? raw : "MANUAL";
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = String(req.query.id ?? "");
  if (!id) return res.status(400).json({ error: "Missing id" });

  if (req.method === "PATCH" || req.method === "PUT") {
    const product = await prisma.product.update({
      where: { id },
      data: {
        category: text(req.body.category) || "Без категории",
        name: text(req.body.name) || "Без названия",
        description: text(req.body.description) || null,
        salePrice: Math.max(0, num(req.body.salePrice)),
        imageUrl: text(req.body.imageUrl) || null,
        productUrl: text(req.body.productUrl) || null,
        isActive: bool(req.body.isActive, true),
        source: source(req.body.source)
      }
    });
    return res.json({ product });
  }

  if (req.method === "DELETE") {
    await prisma.product.delete({ where: { id } });
    return res.json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
