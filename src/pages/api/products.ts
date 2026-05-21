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
  return ["IMPORTED_MENU", "MANUAL", "ASSUMPTION"].includes(raw) ? raw : "MANUAL";
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const products = await prisma.product.findMany({
      orderBy: [{ category: "asc" }, { name: "asc" }],
      include: { recipes: true, packagingLinks: { include: { packaging: true } } }
    });
    return res.json({ products });
  }

  if (req.method === "POST") {
    const name = text(req.body.name);
    if (!name) return res.status(400).json({ error: "Name is required" });
    const product = await prisma.product.create({
      data: {
        category: text(req.body.category) || "Без категории",
        name,
        description: text(req.body.description) || null,
        salePrice: Math.max(0, num(req.body.salePrice)),
        imageUrl: text(req.body.imageUrl) || null,
        productUrl: text(req.body.productUrl) || null,
        isActive: bool(req.body.isActive, true),
        source: source(req.body.source)
      }
    });
    return res.status(201).json({ product });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
