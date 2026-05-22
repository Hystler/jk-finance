import type { StoreInputs, StoreModelResult } from "@/models/financial";

type ReadinessCheck = {
  severity: "warning" | "critical" | "info";
  code?: string;
  message?: string;
};

type ReadinessProduct = {
  salePrice?: number | null;
  isActive?: boolean | null;
};

type ReadinessEconomics = {
  hasRecipe?: boolean | null;
  hasPackaging?: boolean | null;
  ingredientCost?: number | null;
  packagingCost?: number | null;
};

type ReadinessMoneyRow = {
  amount?: number | null;
};

export type ReadinessItem = {
  label: string;
  done: number;
  total: number;
};

export type ModelReadiness = {
  score: number;
  status: string;
  financialLabel: "Draft estimate" | "Investor-ready draft";
  isInvestorReady: boolean;
  investorWarning: string | null;
  mostlyMissingRecipes: boolean;
  mostlyMissingPackaging: boolean;
  items: ReadinessItem[];
};

export function calculateModelReadiness(input: {
  products?: ReadinessProduct[];
  economics?: ReadinessEconomics[];
  capex?: ReadinessMoneyRow[];
  opex?: ReadinessMoneyRow[];
  store?: Partial<StoreInputs> | null;
  model?: Partial<StoreModelResult> | null;
  checks?: ReadinessCheck[];
  franchiseMissingWarnings?: string[];
}): ModelReadiness {
  const products = input.products ?? [];
  const economics = input.economics ?? [];
  const activeProducts = products.filter((product) => product.isActive !== false);
  const skuTotal = Math.max(activeProducts.length || economics.length, 1);
  const store = input.store ?? {};
  const capex = input.capex ?? [];
  const opex = input.opex ?? [];
  const checks = input.checks ?? [];
  const franchiseWarnings = input.franchiseMissingWarnings ?? [];

  const recipeDone = economics.filter((sku) => sku.hasRecipe && Number(sku.ingredientCost ?? 0) > 0).length;
  const packagingDone = economics.filter((sku) => sku.hasPackaging && Number(sku.packagingCost ?? 0) > 0).length;
  const items: ReadinessItem[] = [
    { label: "SKU prices imported", done: activeProducts.filter((sku) => Number(sku.salePrice ?? 0) > 0).length, total: skuTotal },
    { label: "Recipes filled", done: recipeDone, total: Math.max(economics.length, 1) },
    { label: "Packaging filled", done: packagingDone, total: Math.max(economics.length, 1) },
    { label: "CAPEX filled", done: capex.filter((row) => Number(row.amount ?? 0) > 0).length, total: Math.max(capex.length, 1) },
    { label: "OPEX filled", done: opex.filter((row) => Number(row.amount ?? 0) > 0).length, total: Math.max(opex.length, 1) },
    {
      label: "Store Model filled",
      done: [store.workingDaysPerMonth, store.avgOrdersPerDay, store.avgItemsPerOrder, store.avgCheck]
        .filter((value) => Number(value ?? 0) > 0).length,
      total: 4
    }
  ];

  const completionScore = items.length
    ? items.reduce((sum, item) => sum + Math.min(1, item.done / Math.max(item.total, 1)), 0) / items.length
    : 0;
  const criticalPenalty = Math.min(0.35, checks.filter((check) => check.severity === "critical").length * 0.05);
  const franchisePenalty = Math.min(0.15, franchiseWarnings.length * 0.03);
  const economicsPenalty = Number(input.model?.monthlyRevenue ?? 0) <= 0 || Number(input.model?.operatingCashflow ?? 0) <= 0 ? 0.1 : 0;
  const score = Math.max(0, Math.min(100, Math.round((completionScore - criticalPenalty - franchisePenalty - economicsPenalty) * 100)));
  const missingRecipeRatio = economics.length ? economics.filter((sku) => !sku.hasRecipe || Number(sku.ingredientCost ?? 0) <= 0).length / economics.length : 1;
  const missingPackagingRatio = economics.length ? economics.filter((sku) => !sku.hasPackaging || Number(sku.packagingCost ?? 0) <= 0).length / economics.length : 1;
  const mostlyMissingRecipes = missingRecipeRatio >= 0.5;
  const mostlyMissingPackaging = missingPackagingRatio >= 0.5;
  const isInvestorReady = score >= 80 && !mostlyMissingRecipes && !mostlyMissingPackaging && franchiseWarnings.length === 0;
  const status = isInvestorReady
    ? "Готова к внешнему показу"
    : score >= 55
      ? "Черновая модель: требуется аудит"
      : "Модель не готова для внешнего показа";

  return {
    score,
    status,
    financialLabel: isInvestorReady ? "Investor-ready draft" : "Draft estimate",
    isInvestorReady,
    investorWarning: isInvestorReady ? null : "Модель не готова для внешнего показа: рецептуры, упаковка или assumptions заполнены не полностью.",
    mostlyMissingRecipes,
    mostlyMissingPackaging,
    items
  };
}
