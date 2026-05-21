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
  const id = String(req.query.id ?? "");
  if (!id) return res.status(400).json({ error: "Missing id" });

  if (req.method === "PATCH" || req.method === "PUT") {
    const packaging = await prisma.packaging.update({
      where: { id },
      data: {
        name: text(req.body.name) || "Без названия",
        costPerUnit: Math.max(0, num(req.body.costPerUnit)),
        supplier: text(req.body.supplier) || null,
        comment: text(req.body.comment) || null,
        source: source(req.body.source)
      }
    });
    return res.json({ packaging });
  }

  if (req.method === "DELETE") {
    await prisma.packaging.delete({ where: { id } });
    return res.json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
