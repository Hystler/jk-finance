import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/db";

const text = (value: unknown) => String(value ?? "").trim();
const num = (value: unknown) => {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const productId = text(req.body.productId);
  const packagingId = text(req.body.packagingId);
  if (!productId || !packagingId) return res.status(400).json({ error: "productId and packagingId are required" });
  const link = await prisma.productPackaging.create({
    data: {
      productId,
      packagingId,
      units: Math.max(0, num(req.body.units) || 1),
      comment: text(req.body.comment) || null
    }
  });
  return res.status(201).json({ link });
}
