import * as XLSX from "xlsx";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  calculateMonthlyDepreciation,
  calculateMonthlyRevenue,
  calculateProductEconomics,
  calculateRecipeItemCost,
  calculatePackagingCost,
  calculateStoreModel,
  fixedOpexTotal,
  percentDecimal
} from "@/calculations/financial";
import {
  calculateFranchiseFinancialModel,
  calculateFranchiseRevenueForMonth,
  calculateMarketingFee,
  calculateOpeningInvestment,
  calculateRoyalty
} from "@/calculations/franchise";
import { calculateSensitivity } from "@/calculations/sensitivity";
import { buildModelWorkbook } from "@/exports/workbook";
import { buildSkuMarginRanking, truncateSkuName } from "@/lib/charts";
import { formatPercent, formatRub } from "@/lib/format";
import type { CapexInput, OpexInput, ProductInput, StoreInputs, StoreModelResult } from "@/models/financial";

const store: StoreInputs = {
  workingDaysPerMonth: 30,
  avgOrdersPerDay: 100,
  avgItemsPerOrder: 2,
  avgCheck: 500,
  deliveryShare: 70,
  aggregatorShare: 50,
  acquiringRate: 2,
  aggregatorCommissionRate: 25,
  deliveryLogisticsCostPerOrder: 60,
  marketingCostPerItem: 5,
  ownerWithdrawalsMonthly: 0,
  loanPaymentsMonthly: 0,
  workingCapitalChangeMonthly: 0
};

const product: ProductInput = {
  id: "sku-1",
  category: "Бургеры",
  name: "Test burger",
  salePrice: 300,
  recipes: [{ ingredientName: "beef", totalIngredientCost: 90 }],
  packagingLinks: [{ units: 1, packaging: { name: "box", costPerUnit: 15 } }]
};

const franchiseStore: StoreInputs = {
  ...store,
  avgOrdersPerDay: 90,
  avgCheck: 500,
  deliveryShare: 0,
  aggregatorShare: 0,
  acquiringRate: 0,
  aggregatorCommissionRate: 0,
  deliveryLogisticsCostPerOrder: 0,
  marketingCostPerItem: 0
};

function makeStoreModelResult(overrides: Partial<StoreModelResult> = {}): StoreModelResult {
  const monthlyRevenue = overrides.monthlyRevenue ?? 1_350_000;
  const foodCostTotal = overrides.foodCostTotal ?? 300_000;
  const packagingTotal = overrides.packagingTotal ?? 50_000;
  const variableCosts = overrides.variableCosts ?? 200_000;
  const fixedCosts = overrides.fixedCosts ?? 271_400;
  const ebitda = monthlyRevenue - foodCostTotal - packagingTotal - variableCosts - fixedCosts;
  return {
    monthlyRevenue,
    monthlyOrders: overrides.monthlyOrders ?? 2700,
    monthlyItemsSold: overrides.monthlyItemsSold ?? 5400,
    deliveryOrders: overrides.deliveryOrders ?? 0,
    aggregatorOrders: overrides.aggregatorOrders ?? 0,
    foodCostTotal,
    packagingTotal,
    grossProfit: monthlyRevenue - foodCostTotal - packagingTotal,
    acquiringCost: overrides.acquiringCost ?? 30_000,
    aggregatorCommissionCost: overrides.aggregatorCommissionCost ?? 40_000,
    deliveryLogisticsCost: overrides.deliveryLogisticsCost ?? 50_000,
    marketingCost: overrides.marketingCost ?? 20_000,
    variableOpex: overrides.variableOpex ?? 60_000,
    variableCosts,
    fixedCosts,
    revenueTax: overrides.revenueTax ?? 0,
    profitTax: overrides.profitTax ?? 0,
    vatReference: overrides.vatReference ?? 0,
    ebitda: overrides.ebitda ?? ebitda,
    ebitdaMargin: overrides.ebitdaMargin ?? ((overrides.ebitda ?? ebitda) / monthlyRevenue),
    taxPaid: overrides.taxPaid ?? 0,
    operatingCashflow: overrides.operatingCashflow ?? (overrides.ebitda ?? ebitda),
    initialInvestment: overrides.initialInvestment ?? 0,
    contributionMarginPercent: overrides.contributionMarginPercent ?? ((monthlyRevenue - foodCostTotal - packagingTotal - variableCosts) / monthlyRevenue),
    paybackMonth: overrides.paybackMonth ?? null,
    roi: overrides.roi ?? null,
    breakEvenRevenue: overrides.breakEvenRevenue ?? null,
    breakEvenOrders: overrides.breakEvenOrders ?? null,
    breakEvenOrdersPerDay: overrides.breakEvenOrdersPerDay ?? null,
    breakEvenUnavailableReason: overrides.breakEvenUnavailableReason ?? null,
    monthlyDepreciation: overrides.monthlyDepreciation ?? 0,
    cumulativeCashflow: overrides.cumulativeCashflow ?? []
  };
}

const franchiseOpex: OpexInput[] = [{ category: "Аренда", amount: 271_400, behavior: "FIXED", driver: "FIXED" }];

const franchiseInputs = {
  franchiseWorkingDaysPerMonth: 30,
  franchiseAvgOrdersPerDay: 90,
  franchiseAvgItemsPerOrder: 2,
  franchiseAvgCheck: 500,
  franchiseRent: 271_400,
  forecastMonths: 24,
  revenueTrendType: "flat" as const
};

describe("financial calculations", () => {
  it("calculates monthly revenue", () => {
    expect(calculateMonthlyRevenue(store)).toBe(1_500_000);
  });

  it("calculates SKU gross margin", () => {
    const economics = calculateProductEconomics(product, store, { revenueTaxRate: 6 }, 0, 0, 6000);
    expect(economics.grossProfit).toBe(195);
    expect(economics.grossMarginPercent).toBeCloseTo(0.65);
  });

  it("calculates contribution margin", () => {
    const economics = calculateProductEconomics(product, store, { revenueTaxRate: 6 }, 0, 0, 6000);
    expect(economics.contributionMargin).toBeCloseTo(118.75);
  });

  it("calculates EBITDA per SKU after fixed allocation", () => {
    const economics = calculateProductEconomics(product, store, { revenueTaxRate: 6 }, 0, 60_000, 6000);
    expect(economics.ebitdaPerItem).toBeCloseTo(108.75);
  });

  it("calculates ingredient cost from kg to grams", () => {
    const cost = calculateRecipeItemCost({
      ingredientName: "Говядина",
      quantity: 120,
      unit: "g",
      ingredient: { name: "Говядина", purchasePrice: 850, purchaseUnit: "kg", edibleYieldPercent: 100, storageLossPercent: 0 }
    });
    expect(cost).toBeCloseTo(102);
  });

  it("calculates ingredient cost from piece", () => {
    const cost = calculateRecipeItemCost({
      ingredientName: "Булочка",
      quantity: 1,
      unit: "piece",
      ingredient: { name: "Булочка", purchasePrice: 25, purchaseUnit: "piece", edibleYieldPercent: 100, storageLossPercent: 0 }
    });
    expect(cost).toBeCloseTo(25);
  });

  it("calculates packaging cost", () => {
    expect(calculatePackagingCost({ ...product, packagingLinks: [{ units: 2, packaging: { name: "box", costPerUnit: 12 } }] })).toBe(24);
  });

  it("calculates depreciation", () => {
    expect(calculateMonthlyDepreciation([{ category: "equipment", amount: 360_000, usefulLifeMonths: 36 }])).toBe(10_000);
  });

  it("calculates store EBITDA, break-even, payback and ROI", () => {
    const model = calculateStoreModel(
      [product],
      store,
      [{ category: "Аренда", amount: 100_000, behavior: "FIXED", driver: "FIXED" }],
      [{ category: "CAPEX", amount: 1_000_000, usefulLifeMonths: 36, paidBeforeOpening: true }],
      { revenueTaxRate: 6 }
    );
    expect(model.ebitda).toBeGreaterThan(0);
    expect(model.breakEvenRevenue).toBeGreaterThan(0);
    expect(model.paybackMonth).not.toBeNull();
    expect(model.roi).toBeGreaterThan(0);
  });

  it("missing recipe creates status missing recipe, not bad", () => {
    const economics = calculateProductEconomics({ id: "sku-empty", category: "Tests", name: "No recipe", salePrice: 250, recipes: [] }, store, {}, 0, 0, 6000);
    expect(economics.status).toBe("missing recipe");
  });

  it("does not build SKU margin ranking when there is no cost data", () => {
    const ranking = buildSkuMarginRanking([{ name: "No cost", ingredientCost: 0, packagingCost: 0, contributionMargin: 100 }]);
    expect(ranking).toHaveLength(0);
  });

  it("truncates long SKU names for charts", () => {
    const name = "Очень длинное название SKU которое ломает график";
    expect(truncateSkuName(name, 22).length).toBeLessThanOrEqual(22);
  });

  it("export contains SKU Unit Economics sheet", () => {
    const buffer = buildModelWorkbook({
      economics: [calculateProductEconomics(product, store, { revenueTaxRate: 6 }, 0, 0, 6000)],
      products: [{ id: product.id, name: product.name }],
      recipes: [],
      ingredients: [],
      packaging: [],
      productPackaging: [],
      model: calculateStoreModel([product], store, [], [], { revenueTaxRate: 6 }),
      checks: [],
      capex: [],
      opex: [],
      assumptions: [],
      inputUnits: [],
      chartsData: []
    });
    const workbook = XLSX.read(buffer);
    expect(workbook.SheetNames).toContain("SKU Unit Economics");
  });

  it("builds sensitivity scenarios", () => {
    const rows = calculateSensitivity([product], store, [], [], { revenueTaxRate: 6 });
    expect(rows.some((row) => row.parameter === "Average Check")).toBe(true);
    expect(rows[0].values.Base).not.toBeNull();
  });

  it("keeps CAPEX outside EBITDA sensitivity while changing ROI/payback", () => {
    const rows = calculateSensitivity(
      [product],
      store,
      [{ category: "Аренда", amount: 100_000, behavior: "FIXED", driver: "FIXED" }],
      [{ category: "CAPEX", amount: 1_000_000, usefulLifeMonths: 36, paidBeforeOpening: true }],
      { revenueTaxRate: 6 }
    );
    const capex = rows.find((row) => row.parameter === "CAPEX");
    expect(capex?.ebitdaDelta).toBe(0);
    expect(capex?.roiDelta).not.toBe(0);
  });

  it("keeps tax rate outside EBITDA sensitivity while changing net cashflow", () => {
    const rows = calculateSensitivity(
      [product],
      store,
      [{ category: "Аренда", amount: 100_000, behavior: "FIXED", driver: "FIXED" }],
      [{ category: "CAPEX", amount: 1_000_000, usefulLifeMonths: 36, paidBeforeOpening: true }],
      { revenueTaxRate: 6 }
    );
    const taxRate = rows.find((row) => row.parameter === "Tax Rate");
    expect(taxRate?.ebitdaDelta).toBe(0);
    expect(taxRate?.netCashflowDelta).toBeLessThan(0);
  });

  it("applies rent, payroll and aggregator sensitivity to EBITDA and cashflow", () => {
    const rows = calculateSensitivity(
      [product],
      store,
      [
        { category: "Аренда помещения", amount: 100_000, behavior: "FIXED", driver: "FIXED" },
        { category: "Фонд оплаты труда", amount: 180_000, behavior: "FIXED", driver: "FIXED" }
      ],
      [{ category: "CAPEX", amount: 1_000_000, usefulLifeMonths: 36, paidBeforeOpening: true }],
      { revenueTaxRate: 6 }
    );
    for (const parameter of ["Rent", "Payroll", "Aggregator Commission"]) {
      const row = rows.find((item) => item.parameter === parameter);
      expect(row?.ebitdaDelta).toBeLessThan(0);
      expect(row?.netCashflowDelta).toBeLessThan(0);
      expect(row?.roiDelta).toBeLessThan(0);
      expect(row?.breakEvenDelta).not.toBeNull();
    }
  });

  it("converts percent inputs to decimals", () => {
    expect(percentDecimal(1)).toBe(0.01);
    expect(percentDecimal(50)).toBe(0.5);
  });

  it("formats rubles with space thousand separators", () => {
    expect(formatRub(1_350_000)).toBe("1 350 000 ₽");
    expect(formatRub(528_600)).toBe("528 600 ₽");
  });

  it("formats percent values entered as percent points", () => {
    expect(formatPercent(28.23)).toBe("28,2 %");
  });

  it("sets percentage input steps to one", () => {
    const storePage = readFileSync("src/pages/store.tsx", "utf8");
    const franchisePage = readFileSync("src/pages/franchise.tsx", "utf8");
    expect(storePage).toMatch(/name="deliveryShare"[\s\S]*step=\{1\}/);
    expect(storePage).toMatch(/name="revenueTaxRate"[\s\S]*step=\{1\}/);
    expect(franchisePage).toContain("function PercentInput");
    expect(franchisePage).toContain("step={1}");
  });

  it("calculates revenue tax as percent input", () => {
    const model = calculateStoreModel([], { ...store, workingDaysPerMonth: 30, avgOrdersPerDay: 50, avgCheck: 500 }, [], [], { revenueTaxRate: 1 });
    expect(model.monthlyRevenue).toBe(750_000);
    expect(model.revenueTax).toBe(7_500);
    expect(model.taxPaid).toBe(7_500);
  });

  it("calculates aggregator orders from delivery and aggregator shares", () => {
    const model = calculateStoreModel([], { ...store, workingDaysPerMonth: 30, avgOrdersPerDay: 50, deliveryShare: 10, aggregatorShare: 50 }, [], [], {});
    expect(model.monthlyOrders).toBe(1_500);
    expect(model.aggregatorOrders).toBe(75);
  });

  it("does not include VAT in tax paid automatically", () => {
    const model = calculateStoreModel([], { ...store, avgOrdersPerDay: 50, avgCheck: 500 }, [], [], { revenueTaxRate: 1, vatRate: 20 });
    expect(model.vatReference).toBe(150_000);
    expect(model.taxPaid).toBe(7_500);
  });

  it("recalculates fixed costs after deleting OPEX", () => {
    const opex = [
      { category: "Аренда", amount: 100_000, behavior: "FIXED", driver: "FIXED" },
      { category: "Software", amount: 10_000, behavior: "FIXED", driver: "FIXED" }
    ] as const;
    expect(fixedOpexTotal([...opex])).toBe(110_000);
    expect(fixedOpexTotal([opex[0]])).toBe(100_000);
  });

  it("recalculates CAPEX after deleting an item", () => {
    const capex = [
      { category: "Equipment", amount: 360_000, usefulLifeMonths: 36, paidBeforeOpening: true },
      { category: "Sign", amount: 120_000, usefulLifeMonths: 24, paidBeforeOpening: true }
    ];
    const before = calculateStoreModel([], store, [], capex, {});
    const after = calculateStoreModel([], store, [], [capex[0]], {});
    expect(before.initialInvestment).toBe(480_000);
    expect(before.monthlyDepreciation).toBe(15_000);
    expect(after.initialInvestment).toBe(360_000);
    expect(after.monthlyDepreciation).toBe(10_000);
  });

  it("does not divide break-even by zero", () => {
    const model = calculateStoreModel([], { ...store, avgCheck: 0 }, [{ category: "Аренда", amount: 100_000, behavior: "FIXED", driver: "FIXED" }], [], {});
    expect(model.breakEvenOrders).toBeNull();
  });

  it("does not show store payback when opening investment is empty", () => {
    const model = calculateStoreModel([product], store, [], [], { revenueTaxRate: 6 });
    expect(model.initialInvestment).toBe(0);
    expect(model.paybackMonth).toBeNull();
  });

  it("avgItemsPerOrder = 0 creates critical check", async () => {
    const { runChecks } = await import("@/calculations/financial");
    const zeroStore = { ...store, avgItemsPerOrder: 0 };
    const model = calculateStoreModel([product], zeroStore, [], [], {});
    const checks = runChecks([product], [], zeroStore, [], [], {}, model);
    expect(checks.some((check) => check.severity === "critical" && check.code === "AVG_ITEMS_ZERO")).toBe(true);
  });

  it("calculates franchise royalty percent", () => {
    expect(calculateRoyalty(1_350_000, { royaltyType: "percent_of_revenue", royaltyRate: 6 })).toBe(81_000);
  });

  it("calculates franchise marketing fee", () => {
    expect(calculateMarketingFee(1_350_000, { marketingFeeRate: 5 })).toBe(67_500);
  });

  it("calculates franchisee EBITDA after fees", () => {
    const franchise = calculateFranchiseFinancialModel({
      products: [product],
      store: franchiseStore,
      opex: franchiseOpex,
      capex: [],
      tax: {},
      model: makeStoreModelResult(),
      franchise: { ...franchiseInputs, royaltyType: "percent_of_revenue", royaltyRate: 6, marketingFeeRate: 5 }
    });
    expect(franchise.franchisee.revenue).toBe(1_350_000);
    expect(franchise.franchisee.ebitdaBeforeFranchiseFees).toBe(511_600);
    expect(franchise.franchisee.ebitdaAfterFranchiseFees).toBe(363_100);
  });

  it("does not auto-use Store Model revenue for Franchise Mode", () => {
    const first = calculateFranchiseFinancialModel({
      products: [product],
      store: { ...franchiseStore, avgOrdersPerDay: 10, avgCheck: 100 },
      opex: [],
      capex: [],
      tax: {},
      model: makeStoreModelResult({ monthlyRevenue: 9_999_999 }),
      franchise: { ...franchiseInputs }
    });
    const second = calculateFranchiseFinancialModel({
      products: [product],
      store: { ...franchiseStore, avgOrdersPerDay: 200, avgCheck: 900 },
      opex: [],
      capex: [],
      tax: {},
      model: makeStoreModelResult({ monthlyRevenue: 123_456 }),
      franchise: { ...franchiseInputs }
    });
    expect(first.franchisee.revenueMonth1).toBe(1_350_000);
    expect(second.franchisee.revenueMonth1).toBe(1_350_000);
  });

  it("calculates franchise opening investment", () => {
    const result = calculateOpeningInvestment(
      [{ category: "CAPEX", amount: 1_000_000, paidBeforeOpening: true }],
      {
        lumpSumFee: 500_000,
        trainingFee: 100_000,
        openingSupportFee: 150_000,
        openingInventory: 200_000,
        launchMarketing: 120_000,
        rentDeposit: 80_000,
        contingencyAmount: 50_000
      }
    );
    expect(result.openingInvestment).toBe(2_200_000);
  });

  it("calculates franchise payback month", () => {
    const model = makeStoreModelResult({
      monthlyRevenue: 1_000_000,
      foodCostTotal: 100_000,
      packagingTotal: 0,
      variableCosts: 100_000,
      fixedCosts: 550_000
    });
    const franchise = calculateFranchiseFinancialModel({
      products: [product],
      store: franchiseStore,
      opex: [{ category: "Аренда", amount: 550_000, behavior: "FIXED", driver: "FIXED" }],
      capex: [{ category: "CAPEX", amount: 1_000_000, paidBeforeOpening: true }],
      tax: {},
      model,
      franchise: { ...franchiseInputs, franchiseRent: 533_000 }
    });
    expect(franchise.franchisee.netOperatingCashflow).toBe(250_000);
    expect(franchise.franchisee.paybackMonth).toBe(4);
    expect(franchise.franchisee.cumulativeCashflow24[0].cumulativeCashflow).toBe(-1_000_000);
  });

  it("returns null when franchise payback is not reached in 24 months", () => {
    const model = makeStoreModelResult({
      monthlyRevenue: 1_000_000,
      foodCostTotal: 100_000,
      packagingTotal: 0,
      variableCosts: 100_000,
      fixedCosts: 700_000
    });
    const franchise = calculateFranchiseFinancialModel({
      products: [product],
      store: franchiseStore,
      opex: [{ category: "Аренда", amount: 700_000, behavior: "FIXED", driver: "FIXED" }],
      capex: [{ category: "CAPEX", amount: 10_000_000, paidBeforeOpening: true }],
      tax: {},
      model,
      franchise: { ...franchiseInputs, franchiseRent: 683_000 }
    });
    expect(franchise.franchisee.netOperatingCashflow).toBe(100_000);
    expect(franchise.franchisee.paybackMonth24).toBeNull();
  });

  it("does not show franchise payback for empty assumptions", () => {
    const franchise = calculateFranchiseFinancialModel({
      products: [product],
      store: franchiseStore,
      opex: [],
      capex: [],
      tax: {},
      model: makeStoreModelResult(),
      franchise: {}
    });
    const paybackScenario = franchise.scenarios.rows.find((row) => row.metric === "Payback month");

    expect(franchise.franchisee.paybackMonth).toBeNull();
    expect(franchise.franchisee.paybackMonth24).toBeNull();
    expect(paybackScenario).toMatchObject({ Downside: null, Base: null, Upside: null });
    expect(franchise.missingDataWarnings).toContain("Franchisee Store Inputs не заполнены.");
  });

  it("does not show franchise payback when SKU cost assumptions are missing", () => {
    const noCostProduct: ProductInput = {
      id: "sku-no-cost",
      category: "Tests",
      name: "No cost SKU",
      salePrice: 650,
      recipes: [],
      packagingLinks: []
    };
    const franchise = calculateFranchiseFinancialModel({
      products: [noCostProduct],
      store: franchiseStore,
      opex: franchiseOpex,
      capex: [{ category: "CAPEX", amount: 1_000_000, paidBeforeOpening: true }],
      tax: {},
      model: makeStoreModelResult(),
      franchise: { ...franchiseInputs }
    });

    expect(franchise.franchisee.revenueMonth12).toBeGreaterThan(0);
    expect(franchise.franchisee.netCashflowMonth12).toBeGreaterThan(0);
    expect(franchise.franchisee.paybackMonth).toBeNull();
    expect(franchise.missingDataWarnings).toContain("SKU себестоимость отсутствует.");
  });

  it("calculates franchise ROI", () => {
    const model = makeStoreModelResult({
      monthlyRevenue: 1_000_000,
      foodCostTotal: 100_000,
      packagingTotal: 0,
      variableCosts: 100_000,
      fixedCosts: 700_000
    });
    const franchise = calculateFranchiseFinancialModel({
      products: [product],
      store: franchiseStore,
      opex: [{ category: "Аренда", amount: 700_000, behavior: "FIXED", driver: "FIXED" }],
      capex: [{ category: "CAPEX", amount: 1_000_000, paidBeforeOpening: true }],
      tax: {},
      model,
      franchise: { ...franchiseInputs, franchiseRent: 683_000 }
    });
    expect(franchise.franchisee.annualROI).toBeCloseTo(1.2);
    expect(franchise.franchisee.annualROIPercent).toBeCloseTo(120);
  });

  it("calculates franchisor EBITDA", () => {
    const model = makeStoreModelResult({
      monthlyRevenue: 1_000_000,
      foodCostTotal: 300_000,
      packagingTotal: 0,
      variableCosts: 0,
      fixedCosts: 0
    });
    const franchise = calculateFranchiseFinancialModel({
      products: [product],
      store: franchiseStore,
      opex: [],
      capex: [],
      tax: {},
      model,
      franchise: {
        ...franchiseInputs,
        franchiseAvgOrdersPerDay: 1_000_000 / 30 / 500,
        franchiseRent: 0,
        royaltyType: "percent_of_revenue",
        royaltyRate: 5,
        marketingFeeRate: 2,
        supplyChainMarkup: 10,
        monthlySupportCostPerFranchisee: 10_000,
        franchisorFixedTeamCosts: 40_000,
        numberOfFranchisees: 2
      }
    });
    expect(franchise.franchisor.ebitda).toBeCloseTo(76_000);
  });

  it("warns when royalty plus marketing fee is above 15% of revenue", () => {
    const franchise = calculateFranchiseFinancialModel({
      products: [product],
      store: franchiseStore,
      opex: franchiseOpex,
      capex: [{ category: "CAPEX", amount: 1_000_000, paidBeforeOpening: true }],
      tax: {},
      model: makeStoreModelResult(),
      franchise: { ...franchiseInputs, royaltyType: "percent_of_revenue", royaltyRate: 10, marketingFeeRate: 6 }
    });
    expect(franchise.checks.some((check) => check.code === "FRANCHISE_FEES_OVER_15" && check.severity === "critical")).toBe(true);
  });

  it("warns when franchise payback is above 24 months", () => {
    const model = makeStoreModelResult({
      monthlyRevenue: 1_000_000,
      foodCostTotal: 100_000,
      packagingTotal: 0,
      variableCosts: 100_000,
      fixedCosts: 700_000
    });
    const franchise = calculateFranchiseFinancialModel({
      products: [product],
      store: franchiseStore,
      opex: [{ category: "Аренда", amount: 700_000, behavior: "FIXED", driver: "FIXED" }],
      capex: [{ category: "CAPEX", amount: 3_000_000, paidBeforeOpening: true }],
      tax: {},
      model,
      franchise: { ...franchiseInputs, franchiseRent: 683_000 }
    });
    expect(franchise.franchisee.paybackMonth).toBe(30);
    expect(franchise.checks.some((check) => check.code === "PAYBACK_OVER_24")).toBe(true);
  });

  it("marks negative franchisee EBITDA after fees as critical", () => {
    const franchise = calculateFranchiseFinancialModel({
      products: [product],
      store: franchiseStore,
      opex: [{ category: "Аренда", amount: 1_200_000, behavior: "FIXED", driver: "FIXED" }],
      capex: [{ category: "CAPEX", amount: 1_000_000, paidBeforeOpening: true }],
      tax: {},
      model: makeStoreModelResult({ fixedCosts: 1_200_000 }),
      franchise: { ...franchiseInputs, franchiseRent: 1_200_000, royaltyType: "percent_of_revenue", royaltyRate: 6 }
    });
    expect(franchise.franchisee.ebitdaAfterFranchiseFees).toBeLessThan(0);
    expect(franchise.checks.some((check) => check.code === "NEGATIVE_FRANCHISEE_EBITDA" && check.severity === "critical")).toBe(true);
  });

  it("export contains franchise sheets", () => {
    const franchiseModel = calculateFranchiseFinancialModel({
      products: [product],
      store: franchiseStore,
      opex: franchiseOpex,
      capex: [{ category: "CAPEX", amount: 1_000_000, paidBeforeOpening: true }],
      tax: {},
      model: makeStoreModelResult(),
      franchise: { ...franchiseInputs, royaltyType: "percent_of_revenue", royaltyRate: 6, marketingFeeRate: 5 }
    });
    const buffer = buildModelWorkbook({
      economics: [calculateProductEconomics(product, store, { revenueTaxRate: 6 }, 0, 0, 6000)],
      products: [{ id: product.id, name: product.name }],
      recipes: [],
      ingredients: [],
      packaging: [],
      productPackaging: [],
      model: calculateStoreModel([product], store, [], [], { revenueTaxRate: 6 }),
      checks: [],
      capex: [],
      opex: [],
      assumptions: [],
      inputUnits: [],
      chartsData: [],
      franchiseModel
    });
    const workbook = XLSX.read(buffer);
    expect(workbook.SheetNames).toContain("Franchise Inputs");
    expect(workbook.SheetNames).toContain("Franchise Store Inputs");
    expect(workbook.SheetNames).toContain("Franchise Revenue Trend");
    expect(workbook.SheetNames).toContain("Franchise 24M Forecast");
    expect(workbook.SheetNames).toContain("Franchise Payback");
    expect(workbook.SheetNames).toContain("Franchise P&L Month 1");
    expect(workbook.SheetNames).toContain("Franchise P&L Month 12");
    expect(workbook.SheetNames).toContain("Franchise Charts Data");
    expect(workbook.SheetNames).toContain("Franchisee P&L");
    expect(workbook.SheetNames).toContain("Franchisee Cashflow 24M");
    expect(workbook.SheetNames).toContain("Franchisor Model");
    expect(workbook.SheetNames).toContain("Franchise Scenarios");
    expect(workbook.SheetNames).toContain("Franchise Sensitivity");
    expect(workbook.SheetNames).toContain("Franchise Checks");
  });

  it("calculates flat franchise revenue trend", () => {
    const model = calculateFranchiseFinancialModel({
      products: [product],
      store,
      opex: [],
      capex: [],
      tax: {},
      model: makeStoreModelResult(),
      franchise: { ...franchiseInputs, revenueTrendType: "flat" }
    });
    expect(model.franchisee.monthlyForecast[0].revenue).toBe(model.franchisee.monthlyForecast[11].revenue);
  });

  it("calculates growth franchise revenue trend", () => {
    const model = calculateFranchiseFinancialModel({
      products: [product],
      store,
      opex: [],
      capex: [],
      tax: {},
      model: makeStoreModelResult(),
      franchise: { ...franchiseInputs, revenueTrendType: "growth", monthlyGrowthRatePercent: 2 }
    });
    expect(model.franchisee.monthlyForecast[11].revenue).toBeGreaterThan(model.franchisee.monthlyForecast[0].revenue);
  });

  it("calculates decline franchise revenue trend", () => {
    const model = calculateFranchiseFinancialModel({
      products: [product],
      store,
      opex: [],
      capex: [],
      tax: {},
      model: makeStoreModelResult(),
      franchise: { ...franchiseInputs, revenueTrendType: "decline", monthlyDeclineRatePercent: 2 }
    });
    expect(model.franchisee.monthlyForecast[11].revenue).toBeLessThan(model.franchisee.monthlyForecast[0].revenue);
  });

  it("calculates ramp-up franchise revenue trend", () => {
    const baseRevenue = 1_350_000;
    const ramp = { ...franchiseInputs, revenueTrendType: "ramp_up" as const, rampUpStartPercent: 60, rampUpMonths: 6 };
    expect(calculateFranchiseRevenueForMonth(ramp, 1)).toBeCloseTo(baseRevenue * 0.6);
    expect(calculateFranchiseRevenueForMonth(ramp, 6)).toBeCloseTo(baseRevenue);
  });

  it("main dashboard contains KPI cards and chart sections", () => {
    const dashboard = readFileSync("src/pages/index.tsx", "utf8");
    expect(dashboard).toContain("Monthly Revenue");
    expect(dashboard).toContain("Franchise payback preview");
    expect(dashboard).toContain("Data completeness");
  });
});
