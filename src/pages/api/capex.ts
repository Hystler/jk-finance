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
  if (req.method !== "POST") return res.status(405).end();
  await prisma.capexItem.create({
    data: {
      category: String(req.body.category ?? "").trim(),
      amount: n(req.body.amount),
      usefulLifeMonths: nn(req.body.usefulLifeMonths),
      supplierComment: String(req.body.supplierComment ?? "").trim(),
      required: req.body.required === "true",
      paidBeforeOpening: req.body.paidBeforeOpening === "true",
      source: "ASSUMPTION"
    }
  });
  res.redirect(303, "/capex");
}
