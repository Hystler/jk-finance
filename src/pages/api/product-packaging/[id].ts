import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/db";

const text = (value: unknown) => String(value ?? "").trim();
const num = (value: unknown) => {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = String(req.query.id ?? "");
  if (!id) return res.status(400).json({ error: "Missing id" });

  if (req.method === "PATCH" || req.method === "PUT") {
    const link = await prisma.productPackaging.update({
      where: { id },
      data: {
        packagingId: text(req.body.packagingId) || undefined,
        units: Math.max(0, num(req.body.units) || 1),
        comment: text(req.body.comment) || null
      }
    });
    return res.json({ link });
  }

  if (req.method === "DELETE") {
    await prisma.productPackaging.delete({ where: { id } });
    return res.json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
