import type { NextApiRequest, NextApiResponse } from "next";
import { parseFormattedNumber } from "@/lib/format";
import { prisma } from "@/lib/db";

const n = (v: unknown) => {
  const value = parseFormattedNumber(v);
  return Number.isFinite(value) ? value : 0;
};
const bounded = (v: unknown, min: number, max: number) => Math.min(max, Math.max(min, n(v)));

type FranchiseData = {
  lumpSumFee: number;
  royaltyType: string;
  royaltyRate: number;
  fixedMonthlyRoyalty: number;
  marketingFeeRate: number;
  supplyChainMarkup: number;
  trainingFee: number;
  openingSupportFee: number;
  monthlySupportCostPerFranchisee: number;
  franchisorFixedTeamCosts: number;
  openingInventory: number;
  launchMarketing: number;
  rentDeposit: number;
  contingencyAmount: number;
  contingencyPercent: number;
  loanAmount: number;
  loanPaymentsMonthly: number;
  ownerWithdrawalsMonthly: number;
  numberOfFranchisees: number;
  monthlyFixedFees: number;
  franchiseWorkingDaysPerMonth: number;
  franchiseAvgOrdersPerDay: number;
  franchiseAvgItemsPerOrder: number;
  franchiseAvgCheck: number;
  franchiseDeliverySharePercent: number;
  franchiseAggregatorSharePercent: number;
  franchiseAcquiringRatePercent: number;
  franchiseAggregatorCommissionPercent: number;
  franchiseLogisticsPerOrder: number;
  franchiseMarketingPerSku: number;
  franchiseRevenueTaxRatePercent: number;
  franchiseProfitTaxRatePercent: number;
  franchiseVatRatePercent: number;
  franchiseOtherTaxesPerMonth: number;
  franchiseLoanPaymentsPerMonth: number;
  franchiseOwnerWithdrawalsPerMonth: number;
  franchiseRent: number;
  franchisePayroll: number;
  franchiseUtilities: number;
  franchiseSoftware: number;
  franchiseAccounting: number;
  franchiseRepairs: number;
  franchiseOtherFixedOpex: number;
  forecastMonths: number;
  revenueTrendType: string;
  monthlyGrowthRatePercent: number;
  monthlyDeclineRatePercent: number;
  rampUpMonths: number;
  rampUpStartPercent: number;
  seasonalityEnabled: boolean;
  franchiseInputsCopiedFromStore: boolean;
  source: "ASSUMPTION";
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  const existing = await prisma.franchiseSettings.findFirst();
  const copyFromStore = req.body.action === "copy_store";
  const [store, tax, opex] = copyFromStore
    ? await Promise.all([
      prisma.storeInput.findFirst(),
      prisma.taxSettings.findFirst(),
      prisma.opexItem.findMany()
    ])
    : [null, null, [] as Array<{ category: string; amount: number }>];
  const copiedOpex = splitOpex(opex);
  const data: FranchiseData = {
    lumpSumFee: n(req.body.lumpSumFee),
    royaltyType: String(req.body.royaltyType ?? "percent_of_revenue"),
    royaltyRate: bounded(req.body.royaltyRate, 0, 100),
    fixedMonthlyRoyalty: n(req.body.fixedMonthlyRoyalty),
    marketingFeeRate: bounded(req.body.marketingFeeRate, 0, 100),
    supplyChainMarkup: bounded(req.body.supplyChainMarkup, 0, 100),
    trainingFee: n(req.body.trainingFee),
    openingSupportFee: n(req.body.openingSupportFee),
    monthlySupportCostPerFranchisee: n(req.body.monthlySupportCostPerFranchisee),
    franchisorFixedTeamCosts: n(req.body.franchisorFixedTeamCosts),
    openingInventory: n(req.body.openingInventory),
    launchMarketing: n(req.body.launchMarketing),
    rentDeposit: n(req.body.rentDeposit),
    contingencyAmount: n(req.body.contingencyAmount),
    contingencyPercent: bounded(req.body.contingencyPercent, 0, 100),
    loanAmount: n(req.body.loanAmount),
    loanPaymentsMonthly: n(req.body.loanPaymentsMonthly),
    ownerWithdrawalsMonthly: n(req.body.ownerWithdrawalsMonthly),
    numberOfFranchisees: Math.max(1, Math.round(n(req.body.numberOfFranchisees) || 1)),
    monthlyFixedFees: n(req.body.monthlyFixedFees),
    franchiseWorkingDaysPerMonth: copyFromStore ? store?.workingDaysPerMonth ?? 0 : Math.round(bounded(req.body.franchiseWorkingDaysPerMonth, 0, 31)),
    franchiseAvgOrdersPerDay: copyFromStore ? store?.avgOrdersPerDay ?? 0 : Math.max(0, n(req.body.franchiseAvgOrdersPerDay)),
    franchiseAvgItemsPerOrder: copyFromStore ? store?.avgItemsPerOrder ?? 0 : Math.max(0, n(req.body.franchiseAvgItemsPerOrder)),
    franchiseAvgCheck: copyFromStore ? store?.avgCheck ?? 0 : Math.max(0, n(req.body.franchiseAvgCheck)),
    franchiseDeliverySharePercent: copyFromStore ? store?.deliveryShare ?? 0 : bounded(req.body.franchiseDeliverySharePercent, 0, 100),
    franchiseAggregatorSharePercent: copyFromStore ? store?.aggregatorShare ?? 0 : bounded(req.body.franchiseAggregatorSharePercent, 0, 100),
    franchiseAcquiringRatePercent: copyFromStore ? store?.acquiringRate ?? 0 : bounded(req.body.franchiseAcquiringRatePercent, 0, 100),
    franchiseAggregatorCommissionPercent: copyFromStore ? store?.aggregatorCommissionRate ?? 0 : bounded(req.body.franchiseAggregatorCommissionPercent, 0, 100),
    franchiseLogisticsPerOrder: copyFromStore ? store?.deliveryLogisticsCostPerOrder ?? 0 : Math.max(0, n(req.body.franchiseLogisticsPerOrder)),
    franchiseMarketingPerSku: copyFromStore ? store?.marketingCostPerItem ?? 0 : Math.max(0, n(req.body.franchiseMarketingPerSku)),
    franchiseRevenueTaxRatePercent: copyFromStore ? tax?.revenueTaxRate ?? 0 : bounded(req.body.franchiseRevenueTaxRatePercent, 0, 100),
    franchiseProfitTaxRatePercent: copyFromStore ? tax?.profitTaxRate ?? 0 : bounded(req.body.franchiseProfitTaxRatePercent, 0, 100),
    franchiseVatRatePercent: copyFromStore ? tax?.vatRate ?? 0 : bounded(req.body.franchiseVatRatePercent, 0, 100),
    franchiseOtherTaxesPerMonth: copyFromStore ? tax?.otherTaxes ?? 0 : Math.max(0, n(req.body.franchiseOtherTaxesPerMonth)),
    franchiseLoanPaymentsPerMonth: copyFromStore ? store?.loanPaymentsMonthly ?? 0 : Math.max(0, n(req.body.franchiseLoanPaymentsPerMonth ?? req.body.loanPaymentsMonthly)),
    franchiseOwnerWithdrawalsPerMonth: copyFromStore ? store?.ownerWithdrawalsMonthly ?? 0 : Math.max(0, n(req.body.franchiseOwnerWithdrawalsPerMonth ?? req.body.ownerWithdrawalsMonthly)),
    franchiseRent: copyFromStore ? copiedOpex.rent : Math.max(0, n(req.body.franchiseRent)),
    franchisePayroll: copyFromStore ? copiedOpex.payroll : Math.max(0, n(req.body.franchisePayroll)),
    franchiseUtilities: copyFromStore ? copiedOpex.utilities : Math.max(0, n(req.body.franchiseUtilities)),
    franchiseSoftware: copyFromStore ? copiedOpex.software : Math.max(0, n(req.body.franchiseSoftware)),
    franchiseAccounting: copyFromStore ? copiedOpex.accounting : Math.max(0, n(req.body.franchiseAccounting)),
    franchiseRepairs: copyFromStore ? copiedOpex.repairs : Math.max(0, n(req.body.franchiseRepairs)),
    franchiseOtherFixedOpex: copyFromStore ? copiedOpex.otherFixedOpex : Math.max(0, n(req.body.franchiseOtherFixedOpex)),
    forecastMonths: Math.max(1, Math.min(60, Math.round(n(req.body.forecastMonths) || 24))),
    revenueTrendType: normalizeTrendType(req.body.revenueTrendType),
    monthlyGrowthRatePercent: bounded(req.body.monthlyGrowthRatePercent, 0, 100),
    monthlyDeclineRatePercent: bounded(req.body.monthlyDeclineRatePercent, 0, 100),
    rampUpMonths: Math.max(1, Math.min(60, Math.round(n(req.body.rampUpMonths) || 6))),
    rampUpStartPercent: bounded(req.body.rampUpStartPercent, 0, 100),
    seasonalityEnabled: req.body.seasonalityEnabled === true || req.body.seasonalityEnabled === "true" || req.body.seasonalityEnabled === "on",
    franchiseInputsCopiedFromStore: copyFromStore,
    source: "ASSUMPTION" as const
  };
  if (existing) await prisma.franchiseSettings.update({ where: { id: existing.id }, data });
  else await prisma.franchiseSettings.create({ data });
  res.redirect(303, "/franchise");
}

function normalizeTrendType(value: unknown) {
  const trend = String(value ?? "flat");
  return ["flat", "growth", "decline", "ramp_up", "custom"].includes(trend) ? trend : "flat";
}

function splitOpex(opex: Array<{ category: string; amount: number }>) {
  const fixed = opex.map((item) => ({ category: item.category, amount: item.amount }));
  const sum = (pattern: RegExp) => fixed.filter((item) => pattern.test(item.category)).reduce((acc, item) => acc + n(item.amount), 0);
  const rent = sum(/rent|аренд/i);
  const payroll = sum(/payroll|фот|зарп|salary|staff|персонал/i);
  const utilities = sum(/utilities|utility|коммун|электр|вода|свет/i);
  const software = sum(/software|софт|it|crm|pos|касс/i);
  const accounting = sum(/account|бух|юрист|legal/i);
  const repairs = sum(/repair|ремонт|maintenance|обслуж/i);
  const named = rent + payroll + utilities + software + accounting + repairs;
  const total = fixed.reduce((acc, item) => acc + n(item.amount), 0);
  return {
    rent,
    payroll,
    utilities,
    software,
    accounting,
    repairs,
    otherFixedOpex: Math.max(0, total - named)
  };
}
