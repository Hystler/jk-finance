import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/db";

const n = (v: unknown) => {
  const value = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(value) ? value : 0;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  await prisma.opexItem.create({
    data: {
      category: String(req.body.category ?? "").trim(),
      amount: n(req.body.amount),
      behavior: req.body.behavior === "VARIABLE" ? "VARIABLE" : "FIXED",
      driver: ["LINKED_TO_REVENUE", "LINKED_TO_ORDERS", "LINKED_TO_ITEMS"].includes(String(req.body.driver)) ? req.body.driver : "FIXED",
      comment: String(req.body.comment ?? "").trim(),
      source: "ASSUMPTION"
    }
  });
  res.redirect(303, "/opex");
}
