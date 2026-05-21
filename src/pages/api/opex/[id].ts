import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/db";

const n = (v: unknown) => {
  const value = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(value) ? value : 0;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = String(req.query.id ?? "");
  if (!id) return res.status(400).json({ error: "Missing id" });

  if (req.method === "DELETE") {
    await prisma.opexItem.delete({ where: { id } });
    return res.json({ ok: true });
  }

  if (req.method === "PUT") {
    const item = await prisma.opexItem.update({
      where: { id },
      data: {
        category: String(req.body.category ?? "").trim(),
        amount: n(req.body.amount),
        behavior: req.body.behavior === "VARIABLE" ? "VARIABLE" : "FIXED",
        driver: ["LINKED_TO_REVENUE", "LINKED_TO_ORDERS", "LINKED_TO_ITEMS"].includes(String(req.body.driver)) ? req.body.driver : "FIXED",
        comment: String(req.body.comment ?? "").trim(),
        source: "ASSUMPTION"
      }
    });
    return res.json({ item });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
