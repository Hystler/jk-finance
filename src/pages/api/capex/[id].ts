import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/db";

const n = (v: unknown) => {
  const value = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(value) ? value : 0;
};
const nn = (v: unknown) => {
  const raw = String(v ?? "").trim();
  if (!raw) return null;
  const value = Number(raw.replace(",", "."));
  return Number.isFinite(value) ? Math.round(value) : null;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = String(req.query.id ?? "");
  if (!id) return res.status(400).json({ error: "Missing id" });

  if (req.method === "DELETE") {
    await prisma.capexItem.delete({ where: { id } });
    return res.json({ ok: true });
  }

  if (req.method === "PUT") {
    const item = await prisma.capexItem.update({
      where: { id },
      data: {
        category: String(req.body.category ?? "").trim(),
        amount: n(req.body.amount),
        usefulLifeMonths: nn(req.body.usefulLifeMonths),
        supplierComment: String(req.body.supplierComment ?? "").trim(),
        required: req.body.required === "true" || req.body.required === true,
        paidBeforeOpening: req.body.paidBeforeOpening === "true" || req.body.paidBeforeOpening === true,
        source: "ASSUMPTION"
      }
    });
    return res.json({ item });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
