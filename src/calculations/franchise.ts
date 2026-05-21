import {
  calculateInitialInvestment,
  calculateIngredientCost,
  calculatePackagingCost,
  money,
  pct,
  percentDecimal,
  safeDiv
} from "@/calculations/financial";
import type {
  CapexInput,
  FranchiseSettingsInput,
  OpexInput,
  ProductInput,
  RevenueTrendType,
  RoyaltyType,
  StoreInputs,
  StoreModelResult,
  TaxInputs
} from "@/models/financial";

type RowKind = "revenue" | "cost" | "subtotal" | "total" | "margin";
type ValueFormat = "money" | "percent" | "number" | "month";

export type FranchisePnlRow = {
  key: string;
  label: string;
  value: number;
  margin?: number | null;
  kind: RowKind;
};

export type FranchiseCashflowRow = {
  month: number;
  label: string;
  revenue: number;
  orders: number;
  items: number;
  foodCost: number;
  packagingCost: number;
  grossProfit: number;
  variableCosts: number;
  fixedCosts: number;
  ebitdaBeforeFees: number;
  royalty: number;
  marketingFee: number;
  supplyChainMarkup: number;
  ebitdaAfterFees: number;
  revenueTax: number;
  profitTax: number;
  otherTaxes: number;
  taxes: number;
  loanPayments: number;
  ownerWithdrawals: number;
  netOperatingCashflow: number;
  openingInvestment: number;
  cumulativeCashflow: number;
  grossMargin: number;
  contributionMargin: number;
  ebitdaMarginBeforeFees: number;
  ebitdaMarginAfterFees: number;
  netCashflowMargin: number;
};

export type FranchiseCheck = {
  severity: "warning" | "critical";
  code: string;
  message: string;
};

export type FranchiseScenarioName = "Downside" | "Base" | "Upside";

export type FranchiseScenarioMetric = {
  metric: string;
  format: ValueFormat;
  Downside: number | null;
  Base: number | null;
  Upside: number | null;
};

export type FranchiseSensitivityRow = {
  factor: string;
  change: string;
  ebitdaImpact: number;
  paybackImpact: number | null;
  netCashflowImpact: number;
};

export type FranchiseFinancialModel = {
  franchise: FranchiseSettingsInput;
  status: "good" | "warning" | "critical";
  missingDataWarning: string | null;
  missingDataWarnings: string[];
  franchisee: {
    revenue: number;
    revenueMonth1: number;
    revenueMonth12: number;
    foodCost: number;
    packagingCost: number;
    grossProfit: number;
    variableCosts: {
      acquiring: number;
      deliveryCommission: number;
      deliveryLogistics: number;
      marketingVariable: number;
      otherVariable: number;
      total: number;
    };
    fixedCosts: {
      rent: number;
      payroll: number;
      utilities: number;
      software: number;
      accounting: number;
      repairs: number;
      otherFixedOpex: number;
      total: number;
    };
    contributionProfit: number;
    ebitdaBeforeFranchiseFees: number;
    ebitdaAfterFranchiseFees: number;
    ebitdaAfterFeesMonth12: number;
    royalty: number;
    marketingFee: number;
    supplyChainMarkupCost: number;
    taxPaid: number;
    loanPayments: number;
    ownerWithdrawals: number;
    netOperatingCashflow: number;
    netCashflowMonth12: number;
    capexInvestment: number;
    contingency: number;
    openingInvestment: number;
    openingInvestmentBreakdown: Array<{ name: string; value: number }>;
    monthlyForecast: FranchiseCashflowRow[];
    cumulativeCashflow24: FranchiseCashflowRow[];
    cumulativeCashflow36: FranchiseCashflowRow[];
    paybackMonth: number | null;
    paybackMonth24: number | null;
    annualROI: number | null;
    annualROIPercent: number | null;
    grossMargin: number;
    contributionMargin: number;
    ebitdaMarginBeforeFees: number;
    ebitdaMarginAfterFees: number;
    ebitdaMarginAfterFeesMonth12: number;
    netCashflowMargin: number;
    breakEvenRevenue: number | null;
    breakEvenOrders: number | null;
    breakEvenOrdersPerDay: number | null;
    pnlRows: FranchisePnlRow[];
    pnlRowsMonth1: FranchisePnlRow[];
    pnlRowsMonth12: FranchisePnlRow[];
    marginRows: Array<{ name: string; value: number }>;
    pnlStructure: Array<{ name: string; value: number }>;
  };
  franchisor: {
    lumpSumFee: number;
    royalty: number;
    marketingFee: number;
    supplyChainMarkupRevenue: number;
    trainingFee: number;
    openingSupportFee: number;
    monthlyFixedFees: number;
    monthlyRevenue: number;
    oneTimeRevenue: number;
    supportCostPerFranchisee: number;
    allocatedFixedTeamCosts: number;
    ebitda: number;
    totalMonthlyRevenue: number;
    totalMonthlyEBITDA: number;
    ebitdaMargin: number;
    revenueStructure: Array<{ name: string; value: number }>;
  };
  scenarios: {
    models: Record<FranchiseScenarioName, FranchiseCase>;
    rows: FranchiseScenarioMetric[];
  };
  sensitivity: FranchiseSensitivityRow[];
  checks: FranchiseCheck[];
  breakers: string[];
};

export type FranchiseCase = {
  revenue: number;
  ebitdaAfterFranchiseFees: number;
  ebitdaMarginAfterFees: number;
  netOperatingCashflow: number;
  paybackMonth: number | null;
  annualROI: number | null;
  breakEvenOrdersPerDay: number | null;
};

type ScenarioAdjustment = {
  revenueMultiplier?: number;
  avgCheckMultiplier?: number;
  ordersMultiplier?: number;
  foodCostPercentDelta?: number;
  rentMultiplier?: number;
  payrollMultiplier?: number;
  capexMultiplier?: number;
  royaltyRateDelta?: number;
  marketingFeeRateDelta?: number;
  deliveryCommissionMultiplier?: number;
  logisticsMultiplier?: number;
};

const defaultFranchiseSettings: FranchiseSettingsInput = {
  lumpSumFee: 0,
  royaltyType: "percent_of_revenue",
  royaltyRate: 0,
  fixedMonthlyRoyalty: 0,
  marketingFeeRate: 0,
  supplyChainMarkup: 0,
  trainingFee: 0,
  openingSupportFee: 0,
  monthlySupportCostPerFranchisee: 0,
  franchisorFixedTeamCosts: 0,
  openingInventory: 0,
  launchMarketing: 0,
  rentDeposit: 0,
  contingencyAmount: 0,
  contingencyPercent: 0,
  loanAmount: 0,
  loanPaymentsMonthly: 0,
  ownerWithdrawalsMonthly: 0,
  numberOfFranchisees: 1,
  monthlyFixedFees: 0,
  franchiseWorkingDaysPerMonth: 0,
  franchiseAvgOrdersPerDay: 0,
  franchiseAvgItemsPerOrder: 0,
  franchiseAvgCheck: 0,
  franchiseDeliverySharePercent: 0,
  franchiseAggregatorSharePercent: 0,
  franchiseAcquiringRatePercent: 0,
  franchiseAggregatorCommissionPercent: 0,
  franchiseLogisticsPerOrder: 0,
  franchiseMarketingPerSku: 0,
  franchiseRevenueTaxRatePercent: 0,
  franchiseProfitTaxRatePercent: 0,
  franchiseVatRatePercent: 0,
  franchiseOtherTaxesPerMonth: 0,
  franchiseLoanPaymentsPerMonth: 0,
  franchiseOwnerWithdrawalsPerMonth: 0,
  franchiseRent: 0,
  franchisePayroll: 0,
  franchiseUtilities: 0,
  franchiseSoftware: 0,
  franchiseAccounting: 0,
  franchiseRepairs: 0,
  franchiseOtherFixedOpex: 0,
  forecastMonths: 24,
  revenueTrendType: "flat",
  monthlyGrowthRatePercent: 0,
  monthlyDeclineRatePercent: 0,
  rampUpMonths: 6,
  rampUpStartPercent: 60,
  seasonalityEnabled: false,
  franchiseInputsCopiedFromStore: false
};

const royaltyTypes: RoyaltyType[] = ["percent_of_revenue", "fixed_monthly", "hybrid"];
const trendTypes: RevenueTrendType[] = ["flat", "growth", "decline", "ramp_up", "custom"];
const seasonalityFactors = [0.9, 0.95, 1, 1, 1.05, 1.1, 1.1, 1.05, 1, 1, 1.05, 1.15];

export function normalizeFranchiseSettings(input?: Partial<FranchiseSettingsInput> | null): FranchiseSettingsInput {
  const rawType = String(input?.royaltyType ?? defaultFranchiseSettings.royaltyType);
  const royaltyType = royaltyTypes.includes(rawType as RoyaltyType) ? rawType as RoyaltyType : defaultFranchiseSettings.royaltyType;
  const rawTrend = String(input?.revenueTrendType ?? defaultFranchiseSettings.revenueTrendType);
  const revenueTrendType = trendTypes.includes(rawTrend as RevenueTrendType) ? rawTrend as RevenueTrendType : "flat";

  return {
    royaltyType,
    lumpSumFee: money(input?.lumpSumFee),
    royaltyRate: pct(input?.royaltyRate),
    fixedMonthlyRoyalty: money(input?.fixedMonthlyRoyalty),
    marketingFeeRate: pct(input?.marketingFeeRate),
    supplyChainMarkup: pct(input?.supplyChainMarkup),
    trainingFee: money(input?.trainingFee),
    openingSupportFee: money(input?.openingSupportFee),
    monthlySupportCostPerFranchisee: money(input?.monthlySupportCostPerFranchisee),
    franchisorFixedTeamCosts: money(input?.franchisorFixedTeamCosts),
    openingInventory: money(input?.openingInventory),
    launchMarketing: money(input?.launchMarketing),
    rentDeposit: money(input?.rentDeposit),
    contingencyAmount: money(input?.contingencyAmount),
    contingencyPercent: pct(input?.contingencyPercent),
    loanAmount: money(input?.loanAmount),
    loanPaymentsMonthly: money(input?.loanPaymentsMonthly),
    ownerWithdrawalsMonthly: money(input?.ownerWithdrawalsMonthly),
    numberOfFranchisees: Math.max(1, Math.round(money(input?.numberOfFranchisees) || 1)),
    monthlyFixedFees: money(input?.monthlyFixedFees),
    franchiseWorkingDaysPerMonth: Math.max(0, Math.round(money(input?.franchiseWorkingDaysPerMonth))),
    franchiseAvgOrdersPerDay: money(input?.franchiseAvgOrdersPerDay),
    franchiseAvgItemsPerOrder: money(input?.franchiseAvgItemsPerOrder),
    franchiseAvgCheck: money(input?.franchiseAvgCheck),
    franchiseDeliverySharePercent: pct(input?.franchiseDeliverySharePercent),
    franchiseAggregatorSharePercent: pct(input?.franchiseAggregatorSharePercent),
    franchiseAcquiringRatePercent: pct(input?.franchiseAcquiringRatePercent),
    franchiseAggregatorCommissionPercent: pct(input?.franchiseAggregatorCommissionPercent),
    franchiseLogisticsPerOrder: money(input?.franchiseLogisticsPerOrder),
    franchiseMarketingPerSku: money(input?.franchiseMarketingPerSku),
    franchiseRevenueTaxRatePercent: pct(input?.franchiseRevenueTaxRatePercent),
    franchiseProfitTaxRatePercent: pct(input?.franchiseProfitTaxRatePercent),
    franchiseVatRatePercent: pct(input?.franchiseVatRatePercent),
    franchiseOtherTaxesPerMonth: money(input?.franchiseOtherTaxesPerMonth),
    franchiseLoanPaymentsPerMonth: money(input?.franchiseLoanPaymentsPerMonth ?? input?.loanPaymentsMonthly),
    franchiseOwnerWithdrawalsPerMonth: money(input?.franchiseOwnerWithdrawalsPerMonth ?? input?.ownerWithdrawalsMonthly),
    franchiseRent: money(input?.franchiseRent),
    franchisePayroll: money(input?.franchisePayroll),
    franchiseUtilities: money(input?.franchiseUtilities),
    franchiseSoftware: money(input?.franchiseSoftware),
    franchiseAccounting: money(input?.franchiseAccounting),
    franchiseRepairs: money(input?.franchiseRepairs),
    franchiseOtherFixedOpex: money(input?.franchiseOtherFixedOpex),
    forecastMonths: Math.max(1, Math.round(money(input?.forecastMonths) || defaultFranchiseSettings.forecastMonths)),
    revenueTrendType,
    monthlyGrowthRatePercent: pct(input?.monthlyGrowthRatePercent),
    monthlyDeclineRatePercent: pct(input?.monthlyDeclineRatePercent),
    rampUpMonths: Math.max(1, Math.round(money(input?.rampUpMonths) || defaultFranchiseSettings.rampUpMonths)),
    rampUpStartPercent: pct(input?.rampUpStartPercent ?? defaultFranchiseSettings.rampUpStartPercent),
    seasonalityEnabled: Boolean(input?.seasonalityEnabled),
    franchiseInputsCopiedFromStore: Boolean(input?.franchiseInputsCopiedFromStore)
  };
}

export function calculateFranchiseBaseRevenue(franchiseInput?: Partial<FranchiseSettingsInput> | null): number {
  const franchise = normalizeFranchiseSettings(franchiseInput);
  return franchise.franchiseWorkingDaysPerMonth * franchise.franchiseAvgOrdersPerDay * franchise.franchiseAvgCheck;
}

export function calculateFranchiseRevenueForMonth(
  franchiseInput: Partial<FranchiseSettingsInput> | null | undefined,
  month: number
): number {
  const franchise = normalizeFranchiseSettings(franchiseInput);
  const baseRevenue = calculateFranchiseBaseRevenue(franchise);
  const safeMonth = Math.max(1, Math.round(month));
  let revenue = baseRevenue;

  if (franchise.revenueTrendType === "growth") {
    revenue = baseRevenue * Math.pow(1 + percentDecimal(franchise.monthlyGrowthRatePercent), safeMonth - 1);
  } else if (franchise.revenueTrendType === "decline") {
    revenue = baseRevenue * Math.pow(Math.max(0, 1 - percentDecimal(franchise.monthlyDeclineRatePercent)), safeMonth - 1);
  } else if (franchise.revenueTrendType === "ramp_up") {
    const start = percentDecimal(franchise.rampUpStartPercent);
    const rampMonths = Math.max(1, franchise.rampUpMonths);
    const rampFactor = rampMonths <= 1
      ? 1
      : Math.min(1, start + ((1 - start) * (safeMonth - 1)) / (rampMonths - 1));
    revenue = baseRevenue * rampFactor;
  }

  if (franchise.seasonalityEnabled) {
    revenue *= seasonalityFactors[(safeMonth - 1) % seasonalityFactors.length];
  }

  return revenue;
}

export function calculateRoyalty(revenue: number, franchiseInput?: Partial<FranchiseSettingsInput> | null): number {
  const franchise = normalizeFranchiseSettings(franchiseInput);
  if (franchise.royaltyType === "fixed_monthly") return franchise.fixedMonthlyRoyalty;
  if (franchise.royaltyType === "hybrid") return revenue * percentDecimal(franchise.royaltyRate) + franchise.fixedMonthlyRoyalty;
  return revenue * percentDecimal(franchise.royaltyRate);
}

export function calculateMarketingFee(revenue: number, franchiseInput?: Partial<FranchiseSettingsInput> | null): number {
  return revenue * percentDecimal(normalizeFranchiseSettings(franchiseInput).marketingFeeRate);
}

export function calculateOpeningInvestment(
  capex: CapexInput[],
  franchiseInput?: Partial<FranchiseSettingsInput> | null
) {
  const franchise = normalizeFranchiseSettings(franchiseInput);
  const capexInvestment = calculateInitialInvestment(capex);
  const contingency = franchise.contingencyAmount > 0 ? franchise.contingencyAmount : capexInvestment * percentDecimal(franchise.contingencyPercent);
  const breakdown = [
    { name: "Initial CAPEX", value: capexInvestment },
    { name: "Lump sum", value: franchise.lumpSumFee },
    { name: "Training fee", value: franchise.trainingFee },
    { name: "Opening support fee", value: franchise.openingSupportFee },
    { name: "Opening inventory", value: franchise.openingInventory },
    { name: "Launch marketing", value: franchise.launchMarketing },
    { name: "Rent deposit", value: franchise.rentDeposit },
    { name: "Contingency", value: contingency }
  ];
  return {
    capexInvestment,
    contingency,
    openingInvestment: breakdown.reduce((sum, item) => sum + item.value, 0),
    breakdown
  };
}

export function calculateFranchiseFinancialModel(input: {
  products: ProductInput[];
  store: StoreInputs;
  opex: OpexInput[];
  capex: CapexInput[];
  tax: TaxInputs;
  model: StoreModelResult;
  franchise?: Partial<FranchiseSettingsInput> | null;
}): FranchiseFinancialModel {
  const franchise = normalizeFranchiseSettings(input.franchise);
  const base = buildDetailedCase(input.products, input.capex, franchise);
  const scenarios = buildScenarios(input.products, input.capex, franchise, base);
  const sensitivity = buildSensitivity(input.products, input.capex, franchise, base);
  const checks = buildFranchiseChecks(base, input.products, input.capex);
  const breakers = buildBreakers(base, input.products);
  const missingDataWarnings = buildMissingDataWarnings(input.products, input.capex, franchise);
  const status = checks.some((check) => check.severity === "critical")
    ? "critical"
    : checks.length || missingDataWarnings.length
      ? "warning"
      : "good";

  return {
    franchise,
    status,
    missingDataWarning: missingDataWarnings.length
      ? "Для точного расчета заполните franchise inputs, Franchise OPEX, CAPEX и SKU себестоимость."
      : null,
    missingDataWarnings,
    franchisee: base.franchisee,
    franchisor: base.franchisor,
    scenarios,
    sensitivity,
    checks,
    breakers
  };
}

function buildDetailedCase(
  products: ProductInput[],
  capex: CapexInput[],
  franchise: FranchiseSettingsInput,
  adjustment: ScenarioAdjustment = {}
) {
  const adjustedFranchise = applyFranchiseAdjustment(franchise, adjustment);
  const openingInvestmentResult = calculateOpeningInvestment(applyCapexAdjustment(capex, adjustment), adjustedFranchise);
  const fixedBreakdown = fixedCostBreakdown(adjustedFranchise);
  const rows36 = buildFranchiseCashflowRows(36, products, adjustedFranchise, openingInvestmentResult.openingInvestment, adjustment);
  const rows24 = rows36.filter((row) => row.month <= 24);
  const monthlyForecast = rows36.filter((row) => row.month > 0 && row.month <= adjustedFranchise.forecastMonths);
  const month1 = rows36.find((row) => row.month === 1) ?? emptyMonth(1);
  const month12 = rows36.find((row) => row.month === 12) ?? monthlyForecast[monthlyForecast.length - 1] ?? month1;
  const paybackMonth24 = rows24.find((row) => row.month > 0 && row.cumulativeCashflow >= 0)?.month ?? null;
  const paybackMonth = rows36.find((row) => row.month > 0 && row.cumulativeCashflow >= 0)?.month ?? null;
  const yearOneNetCashflow = rows36
    .filter((row) => row.month >= 1 && row.month <= 12)
    .reduce((sum, row) => sum + row.netOperatingCashflow, 0);
  const annualROI = openingInvestmentResult.openingInvestment > 0
    ? yearOneNetCashflow / openingInvestmentResult.openingInvestment
    : null;
  const fixedRoyalty = adjustedFranchise.royaltyType === "fixed_monthly" || adjustedFranchise.royaltyType === "hybrid"
    ? adjustedFranchise.fixedMonthlyRoyalty
    : 0;
  const variableRoyalty = Math.max(0, month12.royalty - fixedRoyalty);
  const variableCostRatioAfterFees = safeDiv(
    month12.foodCost + month12.packagingCost + month12.variableCosts + variableRoyalty + month12.marketingFee + month12.supplyChainMarkup,
    month12.revenue
  );
  const breakEvenRevenue = 1 - variableCostRatioAfterFees > 0
    ? (fixedBreakdown.total + fixedRoyalty) / (1 - variableCostRatioAfterFees)
    : null;
  const breakEvenOrders = breakEvenRevenue != null && adjustedFranchise.franchiseAvgCheck > 0
    ? breakEvenRevenue / adjustedFranchise.franchiseAvgCheck
    : null;
  const breakEvenOrdersPerDay = breakEvenOrders != null && adjustedFranchise.franchiseWorkingDaysPerMonth > 0
    ? breakEvenOrders / adjustedFranchise.franchiseWorkingDaysPerMonth
    : null;
  const pnlRowsMonth1 = buildPnlRows(month1);
  const pnlRowsMonth12 = buildPnlRows(month12);
  const franchisor = buildFranchisorModel(adjustedFranchise, month12.royalty, month12.marketingFee, month12.supplyChainMarkup);
  const franchisee = {
    revenue: month12.revenue,
    revenueMonth1: month1.revenue,
    revenueMonth12: month12.revenue,
    foodCost: month12.foodCost,
    packagingCost: month12.packagingCost,
    grossProfit: month12.grossProfit,
    variableCosts: variableCostBreakdown(month12, adjustedFranchise),
    fixedCosts: fixedBreakdown,
    contributionProfit: month12.grossProfit - month12.variableCosts,
    ebitdaBeforeFranchiseFees: month12.ebitdaBeforeFees,
    ebitdaAfterFranchiseFees: month12.ebitdaAfterFees,
    ebitdaAfterFeesMonth12: month12.ebitdaAfterFees,
    royalty: month12.royalty,
    marketingFee: month12.marketingFee,
    supplyChainMarkupCost: month12.supplyChainMarkup,
    taxPaid: month12.taxes,
    loanPayments: month12.loanPayments,
    ownerWithdrawals: month12.ownerWithdrawals,
    netOperatingCashflow: month12.netOperatingCashflow,
    netCashflowMonth12: month12.netOperatingCashflow,
    capexInvestment: openingInvestmentResult.capexInvestment,
    contingency: openingInvestmentResult.contingency,
    openingInvestment: openingInvestmentResult.openingInvestment,
    openingInvestmentBreakdown: openingInvestmentResult.breakdown,
    monthlyForecast,
    cumulativeCashflow24: rows24,
    cumulativeCashflow36: rows36,
    paybackMonth,
    paybackMonth24,
    annualROI,
    annualROIPercent: annualROI == null ? null : annualROI * 100,
    grossMargin: month12.grossMargin,
    contributionMargin: month12.contributionMargin,
    ebitdaMarginBeforeFees: month12.ebitdaMarginBeforeFees,
    ebitdaMarginAfterFees: month12.ebitdaMarginAfterFees,
    ebitdaMarginAfterFeesMonth12: month12.ebitdaMarginAfterFees,
    netCashflowMargin: month12.netCashflowMargin,
    breakEvenRevenue,
    breakEvenOrders,
    breakEvenOrdersPerDay,
    pnlRows: pnlRowsMonth12,
    pnlRowsMonth1,
    pnlRowsMonth12,
    marginRows: [
      { name: "Gross margin", value: month12.grossMargin },
      { name: "Contribution margin", value: month12.contributionMargin },
      { name: "EBITDA before fees", value: month12.ebitdaMarginBeforeFees },
      { name: "EBITDA after fees", value: month12.ebitdaMarginAfterFees },
      { name: "Net cashflow", value: month12.netCashflowMargin }
    ],
    pnlStructure: [
      { name: "Revenue", value: month12.revenue },
      { name: "COGS", value: -(month12.foodCost + month12.packagingCost) },
      { name: "Variable costs", value: -month12.variableCosts },
      { name: "Fixed costs", value: -month12.fixedCosts },
      { name: "Royalty", value: -month12.royalty },
      { name: "Marketing fee", value: -month12.marketingFee },
      { name: "Taxes", value: -month12.taxes },
      { name: "Net cashflow", value: month12.netOperatingCashflow }
    ]
  };

  return {
    products,
    capex,
    franchise: adjustedFranchise,
    franchisee,
    franchisor
  };
}

function calculateFranchiseCase(
  products: ProductInput[],
  capex: CapexInput[],
  franchise: FranchiseSettingsInput,
  adjustment: ScenarioAdjustment
): FranchiseCase {
  const detail = buildDetailedCase(products, capex, franchise, adjustment);
  return {
    revenue: detail.franchisee.revenue,
    ebitdaAfterFranchiseFees: detail.franchisee.ebitdaAfterFranchiseFees,
    ebitdaMarginAfterFees: detail.franchisee.ebitdaMarginAfterFees,
    netOperatingCashflow: detail.franchisee.netOperatingCashflow,
    paybackMonth: detail.franchisee.paybackMonth,
    annualROI: detail.franchisee.annualROI,
    breakEvenOrdersPerDay: detail.franchisee.breakEvenOrdersPerDay
  };
}

function buildScenarios(
  products: ProductInput[],
  capex: CapexInput[],
  franchise: FranchiseSettingsInput,
  base: ReturnType<typeof buildDetailedCase>
) {
  const models: Record<FranchiseScenarioName, FranchiseCase> = {
    Downside: calculateFranchiseCase(products, capex, franchise, {
      revenueMultiplier: 0.8,
      foodCostPercentDelta: 0.05,
      rentMultiplier: 1.1,
      payrollMultiplier: 1.1,
      capexMultiplier: 1.1
    }),
    Base: {
      revenue: base.franchisee.revenue,
      ebitdaAfterFranchiseFees: base.franchisee.ebitdaAfterFranchiseFees,
      ebitdaMarginAfterFees: base.franchisee.ebitdaMarginAfterFees,
      netOperatingCashflow: base.franchisee.netOperatingCashflow,
      paybackMonth: base.franchisee.paybackMonth,
      annualROI: base.franchisee.annualROI,
      breakEvenOrdersPerDay: base.franchisee.breakEvenOrdersPerDay
    },
    Upside: calculateFranchiseCase(products, capex, franchise, {
      revenueMultiplier: 1.2,
      avgCheckMultiplier: 1.1,
      ordersMultiplier: 1.1,
      foodCostPercentDelta: -0.03
    })
  };

  const rows: FranchiseScenarioMetric[] = [
    metricRow("Revenue", "money", models, (item) => item.revenue),
    metricRow("EBITDA after fees", "money", models, (item) => item.ebitdaAfterFranchiseFees),
    metricRow("EBITDA margin", "percent", models, (item) => item.ebitdaMarginAfterFees),
    metricRow("Net cashflow", "money", models, (item) => item.netOperatingCashflow),
    metricRow("Payback month", "month", models, (item) => item.paybackMonth),
    metricRow("ROI", "percent", models, (item) => item.annualROI),
    metricRow("Break-even orders/day", "number", models, (item) => item.breakEvenOrdersPerDay)
  ];
  return { models, rows };
}

function metricRow(
  metric: string,
  format: ValueFormat,
  models: Record<FranchiseScenarioName, FranchiseCase>,
  pick: (item: FranchiseCase) => number | null
): FranchiseScenarioMetric {
  return {
    metric,
    format,
    Downside: pick(models.Downside),
    Base: pick(models.Base),
    Upside: pick(models.Upside)
  };
}

function buildSensitivity(
  products: ProductInput[],
  capex: CapexInput[],
  franchise: FranchiseSettingsInput,
  base: ReturnType<typeof buildDetailedCase>
): FranchiseSensitivityRow[] {
  const tests: Array<{ factor: string; change: string; adjustment: ScenarioAdjustment }> = [
    { factor: "revenue", change: "+10%", adjustment: { revenueMultiplier: 1.1 } },
    { factor: "orders/day", change: "+10%", adjustment: { ordersMultiplier: 1.1 } },
    { factor: "avg check", change: "+10%", adjustment: { avgCheckMultiplier: 1.1 } },
    { factor: "food cost", change: "+5 p.p.", adjustment: { foodCostPercentDelta: 0.05 } },
    { factor: "rent", change: "+10%", adjustment: { rentMultiplier: 1.1 } },
    { factor: "royalty", change: "+1 p.p.", adjustment: { royaltyRateDelta: 1 } },
    { factor: "CAPEX", change: "+10%", adjustment: { capexMultiplier: 1.1 } }
  ];

  return tests
    .map((test) => {
      const next = calculateFranchiseCase(products, capex, franchise, test.adjustment);
      return {
        factor: test.factor,
        change: test.change,
        ebitdaImpact: next.ebitdaAfterFranchiseFees - base.franchisee.ebitdaAfterFranchiseFees,
        paybackImpact: paybackImpact(next.paybackMonth, base.franchisee.paybackMonth),
        netCashflowImpact: next.netOperatingCashflow - base.franchisee.netOperatingCashflow
      };
    })
    .sort((a, b) => Math.abs(b.ebitdaImpact) - Math.abs(a.ebitdaImpact));
}

function paybackImpact(next: number | null, base: number | null) {
  if (next == null && base == null) return null;
  if (next == null && base != null) return 37 - base;
  if (next != null && base == null) return next - 37;
  return Number(next) - Number(base);
}

function buildFranchiseChecks(
  base: ReturnType<typeof buildDetailedCase>,
  products: ProductInput[],
  capex: CapexInput[]
): FranchiseCheck[] {
  const checks: FranchiseCheck[] = [];
  const f = base.franchisee;
  const franchise = base.franchise;
  const month12 = f.cumulativeCashflow36.find((row) => row.month === 12) ?? f.cumulativeCashflow36.find((row) => row.month === 1);
  const feeRatio = safeDiv(f.royalty + f.marketingFee, f.revenue);

  if (franchise.franchiseAvgCheck <= 0) checks.push({ severity: "critical", code: "FRANCHISE_AVG_CHECK_ZERO", message: "franchiseAvgCheck <= 0" });
  if (franchise.franchiseAvgOrdersPerDay <= 0) checks.push({ severity: "critical", code: "FRANCHISE_ORDERS_ZERO", message: "franchiseAvgOrdersPerDay <= 0" });
  if (franchise.franchiseAvgItemsPerOrder <= 0) checks.push({ severity: "critical", code: "FRANCHISE_ITEMS_ZERO", message: "franchiseAvgItemsPerOrder <= 0" });
  if (f.openingInvestment <= 0) checks.push({ severity: "critical", code: "OPENING_INVESTMENT_ZERO", message: "openingInvestment <= 0" });
  if (f.paybackMonth == null || f.paybackMonth > 36) checks.push({ severity: "critical", code: "PAYBACK_OVER_36", message: "Payback не достигается за 36 месяцев" });
  if ((month12?.ebitdaAfterFees ?? 0) < 0) checks.push({ severity: "critical", code: "NEGATIVE_FRANCHISEE_EBITDA", message: "EBITDA after fees < 0 в month 12" });
  if ((month12?.netOperatingCashflow ?? 0) < 0) checks.push({ severity: "critical", code: "NEGATIVE_MONTH_12_CF", message: "Net cashflow < 0 в month 12" });
  if (feeRatio > 0.15) checks.push({ severity: "critical", code: "FRANCHISE_FEES_OVER_15", message: "Royalty + marketing fee > 15%" });
  if (franchise.monthlyGrowthRatePercent > 10) checks.push({ severity: "warning", code: "GROWTH_OVER_10", message: "Trend growth > 10% в месяц" });
  if (franchise.monthlyDeclineRatePercent > 10) checks.push({ severity: "warning", code: "DECLINE_OVER_10", message: "Trend decline > 10% в месяц" });
  if (franchise.rampUpStartPercent < 40) checks.push({ severity: "warning", code: "RAMP_START_BELOW_40", message: "rampUpStartPercent < 40%" });
  if (f.paybackMonth != null && f.paybackMonth > 24) checks.push({ severity: "warning", code: "PAYBACK_OVER_24", message: "Payback > 24 месяцев" });
  if (f.annualROI != null && f.annualROI < 0.3) checks.push({ severity: "warning", code: "ROI_BELOW_30", message: "Annual ROI < 30%" });
  if (f.revenueMonth12 < f.revenueMonth1) checks.push({ severity: "warning", code: "REVENUE_12_BELOW_1", message: "Revenue month 12 ниже month 1" });
  if (franchise.franchiseInputsCopiedFromStore) checks.push({ severity: "warning", code: "COPIED_STORE_VALUES", message: "Franchise model uses copied Store Model values: проверьте, подходят ли эти данные для новой точки" });
  if (f.fixedCosts.total <= 0) checks.push({ severity: "warning", code: "FRANCHISE_OPEX_MISSING", message: "Missing franchise OPEX" });
  if (!capex.length || f.capexInvestment <= 0) checks.push({ severity: "warning", code: "FRANCHISE_CAPEX_MISSING", message: "Missing franchise CAPEX / opening investment" });
  if (products.length && f.foodCost === 0) checks.push({ severity: "warning", code: "SKU_COST_MISSING", message: "SKU себестоимость отсутствует" });
  return checks;
}

function buildBreakers(base: ReturnType<typeof buildDetailedCase>, products: ProductInput[]) {
  const f = base.franchisee;
  const reasons: string[] = [];
  const rentRatio = safeDiv(f.fixedCosts.rent, f.revenue);
  const payrollRatio = safeDiv(f.fixedCosts.payroll, f.revenue);
  const feeRatio = safeDiv(f.royalty + f.marketingFee + f.supplyChainMarkupCost, f.revenue);
  const foodCostRatio = safeDiv(f.foodCost, f.revenue);
  if (f.openingInvestment > Math.max(f.netOperatingCashflow * 24, 0)) reasons.push("высокий CAPEX / opening investment");
  if (rentRatio > 0.12) reasons.push("высокая аренда");
  if (payrollRatio > 0.25) reasons.push("высокий ФОТ");
  if (feeRatio > 0.15) reasons.push("высокая комиссия франшизы");
  if (f.revenue <= 0 || f.ebitdaAfterFranchiseFees < 0) reasons.push("низкая выручка");
  if (products.length && f.foodCost === 0) reasons.push("не заполнена себестоимость SKU");
  if (foodCostRatio > 0.35) reasons.push("высокий food cost");
  if (f.paybackMonth == null || f.paybackMonth > 24) reasons.push("долгий payback");
  if (f.fixedCosts.total <= 0) reasons.push("не заполнен Franchise OPEX");
  return [...new Set(reasons)].slice(0, 8);
}

function buildMissingDataWarnings(
  products: ProductInput[],
  capex: CapexInput[],
  franchise: FranchiseSettingsInput
) {
  const warnings: string[] = [];
  if (franchise.franchiseAvgCheck <= 0 || franchise.franchiseAvgOrdersPerDay <= 0 || franchise.franchiseAvgItemsPerOrder <= 0) {
    warnings.push("Franchisee Store Inputs не заполнены.");
  }
  if (!capex.length) warnings.push("CAPEX не заполнен или равен 0.");
  if (fixedCostBreakdown(franchise).total <= 0) warnings.push("Franchise OPEX не заполнен.");
  if (products.length && averageProductCosts(products).foodCostPerItem <= 0) warnings.push("SKU себестоимость отсутствует.");
  return warnings;
}

function buildFranchisorModel(franchise: FranchiseSettingsInput, royalty: number, marketingFee: number, supplyChainMarkupRevenue: number) {
  const monthlyRevenue = royalty + marketingFee + supplyChainMarkupRevenue + franchise.monthlyFixedFees;
  const oneTimeRevenue = franchise.lumpSumFee + franchise.trainingFee + franchise.openingSupportFee;
  const allocatedFixedTeamCosts = franchise.franchisorFixedTeamCosts / franchise.numberOfFranchisees;
  const ebitda = monthlyRevenue - franchise.monthlySupportCostPerFranchisee - allocatedFixedTeamCosts;
  const totalMonthlyRevenue = monthlyRevenue * franchise.numberOfFranchisees;
  const totalMonthlyEBITDA =
    monthlyRevenue * franchise.numberOfFranchisees -
    franchise.monthlySupportCostPerFranchisee * franchise.numberOfFranchisees -
    franchise.franchisorFixedTeamCosts;
  return {
    lumpSumFee: franchise.lumpSumFee,
    royalty,
    marketingFee,
    supplyChainMarkupRevenue,
    trainingFee: franchise.trainingFee,
    openingSupportFee: franchise.openingSupportFee,
    monthlyFixedFees: franchise.monthlyFixedFees,
    monthlyRevenue,
    oneTimeRevenue,
    supportCostPerFranchisee: franchise.monthlySupportCostPerFranchisee,
    allocatedFixedTeamCosts,
    ebitda,
    totalMonthlyRevenue,
    totalMonthlyEBITDA,
    ebitdaMargin: safeDiv(ebitda, monthlyRevenue),
    revenueStructure: [
      { name: "Royalty", value: royalty },
      { name: "Marketing fee", value: marketingFee },
      { name: "Supply-chain markup", value: supplyChainMarkupRevenue },
      { name: "Monthly fixed fees", value: franchise.monthlyFixedFees },
      { name: "Lump sum", value: franchise.lumpSumFee },
      { name: "Training", value: franchise.trainingFee },
      { name: "Opening support", value: franchise.openingSupportFee }
    ].filter((item) => item.value > 0)
  };
}

function buildPnlRows(input: FranchiseCashflowRow): FranchisePnlRow[] {
  const contributionProfit = input.grossProfit - input.variableCosts;
  return [
    row("revenue", "Revenue", input.revenue, "revenue", safeDiv(input.revenue, input.revenue)),
    row("foodCost", "Food cost", -input.foodCost, "cost", safeDiv(-input.foodCost, input.revenue)),
    row("packaging", "Packaging", -input.packagingCost, "cost", safeDiv(-input.packagingCost, input.revenue)),
    row("grossProfit", "Gross profit", input.grossProfit, "subtotal", input.grossMargin),
    row("grossMargin", "Gross margin, %", input.grossMargin, "margin"),
    row("variableCosts", "Variable costs", -input.variableCosts, "cost", safeDiv(-input.variableCosts, input.revenue)),
    row("contributionProfit", "Contribution profit", contributionProfit, "subtotal", input.contributionMargin),
    row("contributionMargin", "Contribution margin, %", input.contributionMargin, "margin"),
    row("fixedCosts", "Franchise OPEX", -input.fixedCosts, "cost", safeDiv(-input.fixedCosts, input.revenue)),
    row("ebitdaBeforeFees", "EBITDA before franchise fees", input.ebitdaBeforeFees, "total", input.ebitdaMarginBeforeFees),
    row("ebitdaMarginBeforeFees", "EBITDA margin before fees, %", input.ebitdaMarginBeforeFees, "margin"),
    row("royalty", "Royalty", -input.royalty, "cost", safeDiv(-input.royalty, input.revenue)),
    row("marketingFee", "Marketing fee", -input.marketingFee, "cost", safeDiv(-input.marketingFee, input.revenue)),
    row("supplyChainMarkup", "Supply-chain markup", -input.supplyChainMarkup, "cost", safeDiv(-input.supplyChainMarkup, input.revenue)),
    row("ebitdaAfterFees", "EBITDA after franchise fees", input.ebitdaAfterFees, "total", input.ebitdaMarginAfterFees),
    row("ebitdaMarginAfterFees", "EBITDA margin after fees, %", input.ebitdaMarginAfterFees, "margin"),
    row("taxes", "Taxes", -input.taxes, "cost", safeDiv(-input.taxes, input.revenue)),
    row("loanPayments", "Loan payments", -input.loanPayments, "cost", safeDiv(-input.loanPayments, input.revenue)),
    row("ownerWithdrawals", "Owner withdrawals", -input.ownerWithdrawals, "cost", safeDiv(-input.ownerWithdrawals, input.revenue)),
    row("netOperatingCashflow", "Net operating cashflow", input.netOperatingCashflow, "total", input.netCashflowMargin),
    row("netCashflowMargin", "Net cashflow margin, %", input.netCashflowMargin, "margin")
  ];
}

function row(key: string, label: string, value: number, kind: RowKind, margin?: number | null): FranchisePnlRow {
  return { key, label, value, kind, margin: margin ?? null };
}

function buildFranchiseCashflowRows(
  months: number,
  products: ProductInput[],
  franchise: FranchiseSettingsInput,
  openingInvestment: number,
  adjustment: ScenarioAdjustment = {}
): FranchiseCashflowRow[] {
  const productCosts = averageProductCosts(products);
  const fixedBreakdown = fixedCostBreakdown(franchise);
  const rows: FranchiseCashflowRow[] = [{
    month: 0,
    label: "Month 0",
    revenue: 0,
    orders: 0,
    items: 0,
    foodCost: 0,
    packagingCost: 0,
    grossProfit: 0,
    variableCosts: 0,
    fixedCosts: 0,
    ebitdaBeforeFees: 0,
    royalty: 0,
    marketingFee: 0,
    supplyChainMarkup: 0,
    ebitdaAfterFees: 0,
    revenueTax: 0,
    profitTax: 0,
    otherTaxes: 0,
    taxes: 0,
    loanPayments: 0,
    ownerWithdrawals: 0,
    netOperatingCashflow: -openingInvestment,
    openingInvestment,
    cumulativeCashflow: -openingInvestment,
    grossMargin: 0,
    contributionMargin: 0,
    ebitdaMarginBeforeFees: 0,
    ebitdaMarginAfterFees: 0,
    netCashflowMargin: 0
  }];
  let cumulative = -openingInvestment;

  for (let month = 1; month <= months; month += 1) {
    const revenue = calculateFranchiseRevenueForMonth(franchise, month);
    const orders = franchise.franchiseAvgCheck > 0 ? revenue / franchise.franchiseAvgCheck : 0;
    const items = orders * franchise.franchiseAvgItemsPerOrder;
    const foodCost = Math.max(0, productCosts.foodCostPerItem * items + revenue * (adjustment.foodCostPercentDelta ?? 0));
    const packagingCost = productCosts.packagingCostPerItem * items;
    const acquiring = revenue * percentDecimal(franchise.franchiseAcquiringRatePercent);
    const deliveryOrders = orders * percentDecimal(franchise.franchiseDeliverySharePercent);
    const aggregatorOrders = deliveryOrders * percentDecimal(franchise.franchiseAggregatorSharePercent);
    const deliveryCommission = aggregatorOrders * franchise.franchiseAvgCheck * percentDecimal(franchise.franchiseAggregatorCommissionPercent);
    const deliveryLogistics = deliveryOrders * franchise.franchiseLogisticsPerOrder;
    const marketingVariable = items * franchise.franchiseMarketingPerSku;
    const variableCosts = acquiring + deliveryCommission + deliveryLogistics + marketingVariable;
    const grossProfit = revenue - foodCost - packagingCost;
    const contributionProfit = grossProfit - variableCosts;
    const ebitdaBeforeFees = contributionProfit - fixedBreakdown.total;
    const royalty = calculateRoyalty(revenue, franchise);
    const marketingFee = calculateMarketingFee(revenue, franchise);
    const supplyChainMarkup = foodCost * percentDecimal(franchise.supplyChainMarkup);
    const ebitdaAfterFees = ebitdaBeforeFees - royalty - marketingFee - supplyChainMarkup;
    const revenueTax = revenue * percentDecimal(franchise.franchiseRevenueTaxRatePercent);
    const profitTax = Math.max(ebitdaAfterFees, 0) * percentDecimal(franchise.franchiseProfitTaxRatePercent);
    const otherTaxes = franchise.franchiseOtherTaxesPerMonth;
    const taxes = Math.max(0, revenueTax + profitTax + otherTaxes);
    const loanPayments = franchise.franchiseLoanPaymentsPerMonth;
    const ownerWithdrawals = franchise.franchiseOwnerWithdrawalsPerMonth;
    const netOperatingCashflow = ebitdaAfterFees - taxes - loanPayments - ownerWithdrawals;
    cumulative += netOperatingCashflow;
    rows.push({
      month,
      label: `Month ${month}`,
      revenue,
      orders,
      items,
      foodCost,
      packagingCost,
      grossProfit,
      variableCosts,
      fixedCosts: fixedBreakdown.total,
      ebitdaBeforeFees,
      royalty,
      marketingFee,
      supplyChainMarkup,
      ebitdaAfterFees,
      revenueTax,
      profitTax,
      otherTaxes,
      taxes,
      loanPayments,
      ownerWithdrawals,
      netOperatingCashflow,
      openingInvestment: 0,
      cumulativeCashflow: cumulative,
      grossMargin: safeDiv(grossProfit, revenue),
      contributionMargin: safeDiv(contributionProfit, revenue),
      ebitdaMarginBeforeFees: safeDiv(ebitdaBeforeFees, revenue),
      ebitdaMarginAfterFees: safeDiv(ebitdaAfterFees, revenue),
      netCashflowMargin: safeDiv(netOperatingCashflow, revenue)
    });
  }
  return rows;
}

function emptyMonth(month: number): FranchiseCashflowRow {
  return {
    month,
    label: `Month ${month}`,
    revenue: 0,
    orders: 0,
    items: 0,
    foodCost: 0,
    packagingCost: 0,
    grossProfit: 0,
    variableCosts: 0,
    fixedCosts: 0,
    ebitdaBeforeFees: 0,
    royalty: 0,
    marketingFee: 0,
    supplyChainMarkup: 0,
    ebitdaAfterFees: 0,
    revenueTax: 0,
    profitTax: 0,
    otherTaxes: 0,
    taxes: 0,
    loanPayments: 0,
    ownerWithdrawals: 0,
    netOperatingCashflow: 0,
    openingInvestment: 0,
    cumulativeCashflow: 0,
    grossMargin: 0,
    contributionMargin: 0,
    ebitdaMarginBeforeFees: 0,
    ebitdaMarginAfterFees: 0,
    netCashflowMargin: 0
  };
}

function averageProductCosts(products: ProductInput[]) {
  if (!products.length) return { foodCostPerItem: 0, packagingCostPerItem: 0 };
  return {
    foodCostPerItem: products.reduce((sum, product) => sum + calculateIngredientCost(product), 0) / products.length,
    packagingCostPerItem: products.reduce((sum, product) => sum + calculatePackagingCost(product), 0) / products.length
  };
}

function fixedCostBreakdown(franchise: FranchiseSettingsInput) {
  const total = franchise.franchiseRent +
    franchise.franchisePayroll +
    franchise.franchiseUtilities +
    franchise.franchiseSoftware +
    franchise.franchiseAccounting +
    franchise.franchiseRepairs +
    franchise.franchiseOtherFixedOpex;
  return {
    rent: franchise.franchiseRent,
    payroll: franchise.franchisePayroll,
    utilities: franchise.franchiseUtilities,
    software: franchise.franchiseSoftware,
    accounting: franchise.franchiseAccounting,
    repairs: franchise.franchiseRepairs,
    otherFixedOpex: franchise.franchiseOtherFixedOpex,
    total
  };
}

function variableCostBreakdown(row: FranchiseCashflowRow, franchise: FranchiseSettingsInput) {
  const acquiring = row.revenue * percentDecimal(franchise.franchiseAcquiringRatePercent);
  const deliveryOrders = row.orders * percentDecimal(franchise.franchiseDeliverySharePercent);
  const aggregatorOrders = deliveryOrders * percentDecimal(franchise.franchiseAggregatorSharePercent);
  const deliveryCommission = aggregatorOrders * franchise.franchiseAvgCheck * percentDecimal(franchise.franchiseAggregatorCommissionPercent);
  const deliveryLogistics = deliveryOrders * franchise.franchiseLogisticsPerOrder;
  const marketingVariable = row.items * franchise.franchiseMarketingPerSku;
  return {
    acquiring,
    deliveryCommission,
    deliveryLogistics,
    marketingVariable,
    otherVariable: 0,
    total: row.variableCosts
  };
}

function applyFranchiseAdjustment(franchise: FranchiseSettingsInput, adjustment: ScenarioAdjustment): FranchiseSettingsInput {
  return {
    ...franchise,
    franchiseAvgOrdersPerDay: franchise.franchiseAvgOrdersPerDay * (adjustment.ordersMultiplier ?? 1) * (adjustment.revenueMultiplier ?? 1),
    franchiseAvgCheck: franchise.franchiseAvgCheck * (adjustment.avgCheckMultiplier ?? 1),
    franchiseAggregatorCommissionPercent: franchise.franchiseAggregatorCommissionPercent * (adjustment.deliveryCommissionMultiplier ?? 1),
    franchiseLogisticsPerOrder: franchise.franchiseLogisticsPerOrder * (adjustment.logisticsMultiplier ?? 1),
    franchiseRent: franchise.franchiseRent * (adjustment.rentMultiplier ?? 1),
    franchisePayroll: franchise.franchisePayroll * (adjustment.payrollMultiplier ?? 1),
    royaltyRate: Math.max(0, franchise.royaltyRate + (adjustment.royaltyRateDelta ?? 0)),
    marketingFeeRate: Math.max(0, franchise.marketingFeeRate + (adjustment.marketingFeeRateDelta ?? 0))
  };
}

function applyCapexAdjustment(capex: CapexInput[], adjustment: ScenarioAdjustment): CapexInput[] {
  if (adjustment.capexMultiplier == null) return capex;
  return capex.map((item) => ({ ...item, amount: item.amount * adjustment.capexMultiplier! }));
}
