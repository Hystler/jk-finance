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
  return Number.isFinite(value) ? value : null;
};
const bounded = (v: unknown, min: number, max: number) => Math.min(max, Math.max(min, n(v)));

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  const existing = await prisma.storeInput.findFirst();
  const data = {
    workingDaysPerMonth: Math.round(bounded(req.body.workingDaysPerMonth, 1, 31)),
    avgOrdersPerDay: Math.max(0, n(req.body.avgOrdersPerDay)),
    avgItemsPerOrder: Math.max(0, n(req.body.avgItemsPerOrder)),
    avgCheck: Math.max(0, n(req.body.avgCheck)),
    deliveryShare: bounded(req.body.deliveryShare, 0, 100),
    aggregatorShare: bounded(req.body.aggregatorShare, 0, 100),
    acquiringRate: bounded(req.body.acquiringRate, 0, 100),
    aggregatorCommissionRate: bounded(req.body.aggregatorCommissionRate, 0, 100),
    deliveryLogisticsCostPerOrder: Math.max(0, n(req.body.deliveryLogisticsCostPerOrder)),
    marketingCostPerItem: Math.max(0, n(req.body.marketingCostPerItem)),
    loanPaymentsMonthly: Math.max(0, n(req.body.loanPaymentsMonthly)),
    ownerWithdrawalsMonthly: Math.max(0, n(req.body.ownerWithdrawalsMonthly)),
    source: "ASSUMPTION" as const
  };
  if (existing) await prisma.storeInput.update({ where: { id: existing.id }, data });
  else await prisma.storeInput.create({ data });

  const tax = await prisma.taxSettings.findFirst();
  const taxData = {
    revenueTaxRate: nn(req.body.revenueTaxRate) == null ? null : bounded(req.body.revenueTaxRate, 0, 100),
    profitTaxRate: nn(req.body.profitTaxRate) == null ? null : bounded(req.body.profitTaxRate, 0, 100),
    vatRate: nn(req.body.vatRate) == null ? null : bounded(req.body.vatRate, 0, 100),
    otherTaxes: Math.max(0, n(req.body.otherTaxes)),
    source: "ASSUMPTION" as const
  };
  if (tax) await prisma.taxSettings.update({ where: { id: tax.id }, data: taxData });
  else await prisma.taxSettings.create({ data: taxData });
  res.redirect(303, "/store");
}
