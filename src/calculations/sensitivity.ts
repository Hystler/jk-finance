import { calculateStoreModel } from "@/calculations/financial";
import type { CapexInput, OpexInput, ProductInput, StoreInputs, TaxInputs } from "@/models/financial";

export type SensitivityRow = {
  parameter: string;
  values: Record<"-20%" | "-10%" | "Base" | "+10%" | "+20%", number | null>;
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
  const rows: Array<{ parameter: string; apply: (m: number) => [ProductInput[], StoreInputs, OpexInput[], CapexInput[], TaxInputs] }> = [
    { parameter: "Average check", apply: (m) => [products, { ...store, avgCheck: store.avgCheck * m }, opex, capex, tax] },
    { parameter: "Orders/day", apply: (m) => [products, { ...store, avgOrdersPerDay: store.avgOrdersPerDay * m }, opex, capex, tax] },
    { parameter: "Food cost", apply: (m) => [multiplyFoodCost(products, m), store, opex, capex, tax] },
    { parameter: "Packaging cost", apply: (m) => [multiplyPackagingCost(products, m), store, opex, capex, tax] },
    { parameter: "Rent", apply: (m) => [products, store, opex.map((x) => (/rent|аренд/i.test(x.category) ? { ...x, amount: x.amount * m } : x)), capex, tax] },
    { parameter: "Payroll", apply: (m) => [products, store, opex.map((x) => (/payroll|фот|зарп/i.test(x.category) ? { ...x, amount: x.amount * m } : x)), capex, tax] },
    { parameter: "Aggregator commission", apply: (m) => [products, { ...store, aggregatorCommissionRate: store.aggregatorCommissionRate * m }, opex, capex, tax] },
    { parameter: "Delivery share", apply: (m) => [products, { ...store, deliveryShare: Math.min(100, store.deliveryShare * m) }, opex, capex, tax] },
    { parameter: "Tax rate", apply: (m) => [products, store, opex, capex, { ...tax, revenueTaxRate: (tax.revenueTaxRate ?? 0) * m, profitTaxRate: (tax.profitTaxRate ?? 0) * m }] },
    { parameter: "CAPEX", apply: (m) => [products, store, opex, capex.map((x) => ({ ...x, amount: x.amount * m })), tax] }
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
    const breakEvenDelta = stressed.breakEvenOrdersPerDay != null && base.breakEvenOrdersPerDay != null
      ? stressed.breakEvenOrdersPerDay - base.breakEvenOrdersPerDay
      : null;
    return {
      parameter: row.parameter,
      values,
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
