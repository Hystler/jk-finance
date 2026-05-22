import { calculateStoreModel } from "@/calculations/financial";
import type { CapexInput, OpexInput, ProductInput, StoreInputs, TaxInputs } from "@/models/financial";

export type SensitivityRow = {
  parameter: string;
  values: Record<"-20%" | "-10%" | "Base" | "+10%" | "+20%", number | null>;
  driverAvailable: boolean;
  driverNote: string | null;
  impactOnEbitda: number | null;
  impactOnPayback: number | null;
  ebitdaDelta: number | null;
  ebitdaMarginDelta: number | null;
  netCashflowDelta: number | null;
  paybackDelta: number | null;
  roiDelta: number | null;
  breakEvenDelta: number | null;
};

const multipliers = [
  ["-20%", 0.8],
  ["-10%", 0.9],
  ["Base", 1],
  ["+10%", 1.1],
  ["+20%", 1.2]
] as const;

export function calculateSensitivity(products: ProductInput[], store: StoreInputs, opex: OpexInput[], capex: CapexInput[], tax: TaxInputs): SensitivityRow[] {
  const base = calculateStoreModel(products, store, opex, capex, tax);
  const rentPattern = /rent|lease|аренд|помещ|площад|арендная|локац|тц|трц/i;
  const payrollPattern = /payroll|salary|salaries|wage|labor|staff|personnel|employee|team|персонал|фот|зарп|оплат[аы] труда|сотруд|команд|повар|кассир|бариста|смен/i;
  const rows: Array<{
    parameter: string;
    driverAvailable: boolean;
    driverNote: string | null;
    apply: (m: number) => [ProductInput[], StoreInputs, OpexInput[], CapexInput[], TaxInputs];
  }> = [
    {
      parameter: "Average Check",
      driverAvailable: store.avgCheck > 0,
      driverNote: store.avgCheck > 0 ? null : "Average Check не заполнен.",
      apply: (m) => [products, { ...store, avgCheck: store.avgCheck * m }, opex, capex, tax]
    },
    {
      parameter: "Orders / Day",
      driverAvailable: store.avgOrdersPerDay > 0,
      driverNote: store.avgOrdersPerDay > 0 ? null : "Orders / Day не заполнен.",
      apply: (m) => [products, { ...store, avgOrdersPerDay: store.avgOrdersPerDay * m }, opex, capex, tax]
    },
    {
      parameter: "Food Cost",
      driverAvailable: products.some((product) => (product.recipes ?? []).length > 0),
      driverNote: products.some((product) => (product.recipes ?? []).length > 0) ? null : "Нет рецептур, поэтому Food Cost не меняет модель.",
      apply: (m) => [multiplyFoodCost(products, m), store, opex, capex, tax]
    },
    {
      parameter: "Packaging Cost",
      driverAvailable: products.some((product) => (product.packagingLinks ?? []).length > 0),
      driverNote: products.some((product) => (product.packagingLinks ?? []).length > 0) ? null : "Нет упаковки, поэтому Packaging Cost не меняет модель.",
      apply: (m) => [multiplyPackagingCost(products, m), store, opex, capex, tax]
    },
    {
      parameter: "Rent",
      driverAvailable: hasMatchingOpex(opex, rentPattern),
      driverNote: hasMatchingOpex(opex, rentPattern) ? null : "В OPEX не найден драйвер Rent.",
      apply: (m) => [products, store, multiplyMatchingOpex(opex, rentPattern, m), capex, tax]
    },
    {
      parameter: "Payroll",
      driverAvailable: hasMatchingOpex(opex, payrollPattern),
      driverNote: hasMatchingOpex(opex, payrollPattern) ? null : "В OPEX не найден драйвер Payroll.",
      apply: (m) => [products, store, multiplyMatchingOpex(opex, payrollPattern, m), capex, tax]
    },
    {
      parameter: "Aggregator Commission",
      driverAvailable: store.aggregatorCommissionRate > 0 && store.deliveryShare > 0 && store.aggregatorShare > 0,
      driverNote: store.aggregatorCommissionRate > 0 && store.deliveryShare > 0 && store.aggregatorShare > 0
        ? null
        : "Aggregator Commission, Delivery Share или Aggregator Share не заполнены.",
      apply: (m) => [products, { ...store, aggregatorCommissionRate: store.aggregatorCommissionRate * m }, opex, capex, tax]
    },
    {
      parameter: "Delivery Share",
      driverAvailable: store.deliveryShare > 0,
      driverNote: store.deliveryShare > 0 ? null : "Delivery Share не заполнен.",
      apply: (m) => [products, { ...store, deliveryShare: Math.min(100, store.deliveryShare * m) }, opex, capex, tax]
    },
    {
      parameter: "Tax Rate",
      driverAvailable: (tax.revenueTaxRate ?? 0) > 0 || (tax.profitTaxRate ?? 0) > 0,
      driverNote: (tax.revenueTaxRate ?? 0) > 0 || (tax.profitTaxRate ?? 0) > 0 ? null : "Tax Rate не заполнен.",
      apply: (m) => [products, store, opex, capex, { ...tax, revenueTaxRate: (tax.revenueTaxRate ?? 0) * m, profitTaxRate: (tax.profitTaxRate ?? 0) * m }]
    },
    {
      parameter: "CAPEX",
      driverAvailable: capex.some((item) => item.amount > 0),
      driverNote: capex.some((item) => item.amount > 0) ? null : "CAPEX не заполнен.",
      apply: (m) => [products, store, opex, capex.map((x) => ({ ...x, amount: x.amount * m })), tax]
    }
  ];

  return rows.map((row) => {
    const values = {} as SensitivityRow["values"];
    const outcomes = multipliers.map(([label, multiplier]) => {
      const [nextProducts, nextStore, nextOpex, nextCapex, nextTax] = row.apply(multiplier);
      const result = calculateStoreModel(nextProducts, nextStore, nextOpex, nextCapex, nextTax);
      values[label] = result.ebitda;
      return { label, result };
    });
    const minus20 = outcomes[0].result;
    const plus20 = outcomes[4].result;
    const stressed = plus20;
    const paybackDelta = stressed.paybackMonth != null && base.paybackMonth != null ? stressed.paybackMonth - base.paybackMonth : null;
    const roiDelta = stressed.roi != null && base.roi != null ? stressed.roi - base.roi : null;
    const breakEvenDelta = calculateBreakEvenDelta(base.breakEvenOrdersPerDay, outcomes.map((outcome) => outcome.result.breakEvenOrdersPerDay));
    return {
      parameter: row.parameter,
      values,
      driverAvailable: row.driverAvailable,
      driverNote: row.driverNote,
      impactOnEbitda: plus20.ebitda - minus20.ebitda,
      impactOnPayback: plus20.paybackMonth != null && minus20.paybackMonth != null ? plus20.paybackMonth - minus20.paybackMonth : null,
      ebitdaDelta: stressed.ebitda - base.ebitda,
      ebitdaMarginDelta: stressed.ebitdaMargin - base.ebitdaMargin,
      netCashflowDelta: stressed.operatingCashflow - base.operatingCashflow,
      paybackDelta,
      roiDelta,
      breakEvenDelta
    };
  });
}

function hasMatchingOpex(opex: OpexInput[], pattern: RegExp): boolean {
  return opex.some((item) => pattern.test(item.category) && item.amount > 0);
}

function multiplyMatchingOpex(opex: OpexInput[], pattern: RegExp, multiplier: number): OpexInput[] {
  return opex.map((item) => (pattern.test(item.category) ? { ...item, amount: item.amount * multiplier } : item));
}

function calculateBreakEvenDelta(baseBreakEven: number | null, scenarioBreakEvens: Array<number | null>): number | null {
  if (baseBreakEven == null) return null;
  const deltas = scenarioBreakEvens
    .filter((value): value is number => value != null && Number.isFinite(value))
    .map((value) => value - baseBreakEven)
    .sort((a, b) => Math.abs(b) - Math.abs(a));
  return deltas[0] ?? null;
}

function multiplyFoodCost(products: ProductInput[], multiplier: number): ProductInput[] {
  return products.map((product) => ({
    ...product,
    recipes: (product.recipes ?? []).map((recipe) => ({
      ...recipe,
      totalIngredientCost: recipe.totalIngredientCost == null ? recipe.totalIngredientCost : recipe.totalIngredientCost * multiplier,
      costPerUnit: recipe.costPerUnit == null ? recipe.costPerUnit : recipe.costPerUnit * multiplier,
      unitPurchasePrice: recipe.unitPurchasePrice == null ? recipe.unitPurchasePrice : recipe.unitPurchasePrice * multiplier,
      ingredient: recipe.ingredient ? {
        ...recipe.ingredient,
        purchasePrice: recipe.ingredient.purchasePrice * multiplier
      } : recipe.ingredient
    }))
  }));
}

function multiplyPackagingCost(products: ProductInput[], multiplier: number): ProductInput[] {
  return products.map((product) => ({
    ...product,
    packagingLinks: (product.packagingLinks ?? []).map((link) => ({
      ...link,
      packaging: {
        ...link.packaging,
        costPerUnit: link.packaging.costPerUnit * multiplier
      }
    }))
  }));
}
