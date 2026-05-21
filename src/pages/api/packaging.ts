import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/db";

const text = (value: unknown) => String(value ?? "").trim();
const num = (value: unknown) => {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
};
const source = (value: unknown) => {
  const raw = text(value);
  return ["MANUAL", "IMPORTED", "ASSUMPTION"].includes(raw) ? raw : "MANUAL";
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const packaging = await prisma.packaging.findMany({ orderBy: { name: "asc" } });
    return res.json({ packaging });
  }

  if (req.method === "POST") {
    const name = text(req.body.name);
    if (!name) return res.status(400).json({ error: "Name is required" });
    const packaging = await prisma.packaging.create({
      data: {
        name,
        costPerUnit: Math.max(0, num(req.body.costPerUnit)),
        supplier: text(req.body.supplier) || null,
        comment: text(req.body.comment) || null,
        source: source(req.body.source)
      }
    });
    return res.status(201).json({ packaging });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
