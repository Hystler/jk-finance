import type {
  CapexInput,
  CheckResult,
  DiagnosticResult,
  IngredientInput,
  OpexInput,
  ProductEconomics,
  ProductInput,
  RecipeInput,
  StoreInputs,
  StoreModelResult,
  TaxInputs
} from "@/models/financial";
import { formatRub } from "@/lib/format";
import {
  calculateIngredientCost as calculateIngredientBaseCost,
  calculateRecipeItemCostDetails,
  calculateSkuRecipeTotal
} from "@/lib/recipe-cost";

export const pct = (value?: number | null) => (Number.isFinite(value ?? NaN) ? Number(value) : 0);
export const percentDecimal = (value?: number | null) => pct(value) / 100;
export const money = (value?: number | null) => (Number.isFinite(value ?? NaN) ? Number(value) : 0);
export const safeDiv = (a: number, b: number) => (b === 0 ? 0 : a / b);

export function ingredientCostPerBaseUnit(ingredient?: IngredientInput | null): number {
  return calculateIngredientBaseCost(ingredient);
}

export function calculateRecipeItemCost(item: RecipeInput): number {
  if (Number.isFinite(item.costPerUnit ?? NaN)) return money(item.costPerUnit);

  if (item.ingredient) {
    return calculateRecipeItemCostDetails(item).finalIngredientCost;
  }

  if (Number.isFinite(item.netWeightGrams ?? NaN) && Number.isFinite(item.unitPurchasePrice ?? NaN)) {
    return (Number(item.netWeightGrams) / 1000) * Number(item.unitPurchasePrice);
  }
  return 0;
}

export function calculateMonthlyRevenue(store: StoreInputs): number {
  return money(store.avgOrdersPerDay) * money(store.avgCheck) * money(store.workingDaysPerMonth);
}

export function calculateMonthlyOrders(store: StoreInputs): number {
  return money(store.avgOrdersPerDay) * money(store.workingDaysPerMonth);
}

export function calculateMonthlyItemsSold(store: StoreInputs): number {
  return calculateMonthlyOrders(store) * money(store.avgItemsPerOrder);
}

export function calculateIngredientCost(product: ProductInput): number {
  return calculateSkuRecipeTotal(product);
}

export function calculatePackagingCost(product: ProductInput): number {
  return (product.packagingLinks ?? []).reduce((sum, link) => sum + money(link.units) * money(link.packaging.costPerUnit), 0);
}

export function calculateMonthlyDepreciation(capex: CapexInput[]): number {
  return capex.reduce((sum, item) => {
    const life = item.usefulLifeMonths ?? 0;
    if (life <= 0) return sum;
    return sum + money(item.amount) / life;
  }, 0);
}

export function calculateInitialInvestment(capex: CapexInput[]): number {
  return capex.filter((item) => item.paidBeforeOpening !== false).reduce((sum, item) => sum + money(item.amount), 0);
}

export function fixedOpexTotal(opex: OpexInput[]): number {
  return opex.filter((item) => item.behavior === "FIXED").reduce((sum, item) => sum + money(item.amount), 0);
}

export function variableOpexTotal(opex: OpexInput[], store: StoreInputs): number {
  const revenue = calculateMonthlyRevenue(store);
  const orders = calculateMonthlyOrders(store);
  const items = calculateMonthlyItemsSold(store);
  return opex
    .filter((item) => item.behavior === "VARIABLE")
    .reduce((sum, item) => {
      if (item.driver === "LINKED_TO_REVENUE") return sum + revenue * percentDecimal(item.amount);
      if (item.driver === "LINKED_TO_ORDERS") return sum + orders * money(item.amount);
      if (item.driver === "LINKED_TO_ITEMS") return sum + items * money(item.amount);
      return sum + money(item.amount);
    }, 0);
}

export function calculateBreakEven(input: {
  fixedCosts: number;
  contributionMarginPercent: number;
  avgCheck: number;
  workingDaysPerMonth: number;
}) {
  const fixedCosts = money(input.fixedCosts);
  const contributionMarginPercent = input.contributionMarginPercent;
  const avgCheck = money(input.avgCheck);
  const workingDaysPerMonth = money(input.workingDaysPerMonth);

  if (fixedCosts <= 0) {
    return {
      breakEvenRevenue: null,
      breakEvenOrders: null,
      breakEvenOrdersPerDay: null,
      breakEvenUnavailableReason: "Break-even unavailable: OPEX missing"
    };
  }
  if (avgCheck <= 0) {
    return {
      breakEvenRevenue: null,
      breakEvenOrders: null,
      breakEvenOrdersPerDay: null,
      breakEvenUnavailableReason: "Break-even unavailable: Average Check missing"
    };
  }
  if (workingDaysPerMonth <= 0) {
    return {
      breakEvenRevenue: null,
      breakEvenOrders: null,
      breakEvenOrdersPerDay: null,
      breakEvenUnavailableReason: "Break-even unavailable: Working Days missing"
    };
  }
  if (!Number.isFinite(contributionMarginPercent) || contributionMarginPercent <= 0) {
    return {
      breakEvenRevenue: null,
      breakEvenOrders: null,
      breakEvenOrdersPerDay: null,
      breakEvenUnavailableReason: "Break-even unavailable: Contribution Margin invalid"
    };
  }

  const breakEvenRevenue = fixedCosts / contributionMarginPercent;
  const breakEvenOrders = breakEvenRevenue / avgCheck;
  const breakEvenOrdersPerDay = breakEvenOrders / workingDaysPerMonth;
  return {
    breakEvenRevenue,
    breakEvenOrders,
    breakEvenOrdersPerDay,
    breakEvenUnavailableReason: null
  };
}

export function calculateProductEconomics(
  product: ProductInput,
  store: StoreInputs,
  tax: TaxInputs,
  monthlyDepreciation: number,
  fixedCosts: number,
  monthlyItemsSold: number
): ProductEconomics {
  const salePrice = money(product.salePrice);
  const ingredientCost = calculateIngredientCost(product);
  const packagingCost = calculatePackagingCost(product);
  const directLaborCostPerItem = 0;
  const acquiringCost = salePrice * percentDecimal(store.acquiringRate);
  const deliveryCommission = salePrice * percentDecimal(store.aggregatorCommissionRate) * percentDecimal(store.aggregatorShare) * percentDecimal(store.deliveryShare);
  const deliveryLogisticsCost = safeDiv(
    money(store.deliveryLogisticsCostPerOrder) * percentDecimal(store.deliveryShare),
    money(store.avgItemsPerOrder) || 1
  );
  const effectiveTaxRate = product.taxRate ?? tax.revenueTaxRate ?? 0;
  const taxPerItem = salePrice * percentDecimal(effectiveTaxRate);
  const depreciationPerItem = safeDiv(monthlyDepreciation, monthlyItemsSold);
  const allocatedFixedCostPerItem = safeDiv(fixedCosts, monthlyItemsSold);
  const marketingCostPerItem = money(store.marketingCostPerItem);
  const royaltyPerItem = 0;
  const otherVariableCostsPerItem = 0;
  const totalVariableCost =
    ingredientCost +
    packagingCost +
    acquiringCost +
    deliveryCommission +
    deliveryLogisticsCost +
    marketingCostPerItem +
    taxPerItem +
    royaltyPerItem +
    otherVariableCostsPerItem +
    directLaborCostPerItem;
  const grossProfit = salePrice - ingredientCost - packagingCost;
  const contributionMargin = salePrice - totalVariableCost;
  const ebitdaPerItem = contributionMargin - allocatedFixedCostPerItem - depreciationPerItem;
  const contributionMarginPercent = safeDiv(contributionMargin, salePrice);
  const ebitdaMarginPercent = safeDiv(ebitdaPerItem, salePrice);
  const grossMarginPercent = safeDiv(grossProfit, salePrice);
  const hasRecipe = Boolean(product.recipes?.length);
  const hasPackaging = Boolean(product.packagingLinks?.length);
  const missingRecipeData = !hasRecipe;
  const totalCostPerItem = totalVariableCost + allocatedFixedCostPerItem + depreciationPerItem;
  const warnings = [
    !hasRecipe ? "Нет рецептуры" : null,
    ingredientCost === 0 ? "Нет себестоимости ингредиентов" : null,
    !hasPackaging ? "Нет упаковки" : null,
    packagingCost === 0 ? "Нет стоимости упаковки" : null,
    monthlyItemsSold <= 0 ? "Для распределения fixed costs укажите заказы/день и SKU/заказ в Store Model." : null,
    salePrice > 0 && salePrice < totalVariableCost ? "Цена ниже переменных расходов. SKU продается в минус." : null
  ].filter((item): item is string => Boolean(item));
  const status =
    missingRecipeData ? "missing recipe" :
    contributionMargin < 0 ? "negative contribution" :
    ebitdaPerItem < 0 ? "negative EBITDA" :
    safeDiv(ingredientCost, salePrice) > 0.4 ? "high food cost" :
    ebitdaMarginPercent > 0.15 ? "good" :
    contributionMarginPercent < 0.2 ? "low margin" :
    "warning";

  return {
    productId: product.id,
    name: product.name,
    category: product.category,
    salePrice,
    ingredientCost,
    packagingCost,
    directLaborCostPerItem,
    acquiringCost,
    deliveryCommission,
    aggregatorCommissionPerItem: deliveryCommission,
    deliveryLogisticsCost,
    deliveryLogisticsPerItem: deliveryLogisticsCost,
    marketingCostPerItem,
    royaltyPerItem,
    taxPerItem,
    depreciationPerItem,
    allocatedFixedCostPerItem,
    totalVariableCost,
    totalCostPerItem,
    grossProfit,
    grossMarginPercent,
    contributionMargin,
    contributionMarginPercent,
    ebitdaPerItem,
    ebitdaMarginPercent,
    status,
    warnings,
    hasRecipe,
    hasPackaging,
    missingRecipeData
  };
}

export function calculateStoreModel(
  products: ProductInput[],
  store: StoreInputs,
  opex: OpexInput[],
  capex: CapexInput[],
  tax: TaxInputs
): StoreModelResult {
  const monthlyRevenue = calculateMonthlyRevenue(store);
  const monthlyOrders = calculateMonthlyOrders(store);
  const monthlyItemsSold = calculateMonthlyItemsSold(store);
  const deliveryOrders = monthlyOrders * percentDecimal(store.deliveryShare);
  const aggregatorOrders = deliveryOrders * percentDecimal(store.aggregatorShare);
  const fixedCosts = fixedOpexTotal(opex);
  const monthlyDepreciation = calculateMonthlyDepreciation(capex);
  const initialInvestment = calculateInitialInvestment(capex);
  const productMixShare = products.length ? 1 / products.length : 0;
  const foodCostTotal = products.reduce((sum, product) => sum + calculateIngredientCost(product) * monthlyItemsSold * productMixShare, 0);
  const packagingTotal = products.reduce((sum, product) => sum + calculatePackagingCost(product) * monthlyItemsSold * productMixShare, 0);
  const acquiringCost = monthlyRevenue * percentDecimal(store.acquiringRate);
  const aggregatorCommissionCost = aggregatorOrders * money(store.avgCheck) * percentDecimal(store.aggregatorCommissionRate);
  const deliveryLogisticsCost = deliveryOrders * money(store.deliveryLogisticsCostPerOrder);
  const marketingVariable = monthlyItemsSold * money(store.marketingCostPerItem);
  const variableOpex = variableOpexTotal(opex, store);
  const variableCosts = acquiringCost + aggregatorCommissionCost + deliveryLogisticsCost + marketingVariable + variableOpex;
  const grossProfit = monthlyRevenue - foodCostTotal - packagingTotal;
  const ebitda = monthlyRevenue - foodCostTotal - packagingTotal - variableCosts - fixedCosts;
  const ebitdaMargin = safeDiv(ebitda, monthlyRevenue);
  const revenueTax = monthlyRevenue * percentDecimal(tax.revenueTaxRate ?? 0);
  const profitTax = Math.max(ebitda, 0) * percentDecimal(tax.profitTaxRate ?? 0);
  const vatReference = monthlyRevenue * percentDecimal(tax.vatRate ?? 0);
  const taxPaid = Math.max(0, revenueTax + profitTax + money(tax.otherTaxes ?? 0));
  const operatingCashflow = ebitda - taxPaid - money(store.loanPaymentsMonthly) - money(store.ownerWithdrawalsMonthly);
  const contributionMarginPercent = safeDiv(monthlyRevenue - foodCostTotal - packagingTotal - variableCosts, monthlyRevenue);
  const breakEven = calculateBreakEven({
    fixedCosts,
    contributionMarginPercent,
    avgCheck: store.avgCheck,
    workingDaysPerMonth: store.workingDaysPerMonth
  });
  const cumulativeCashflow = buildCashflow(initialInvestment, operatingCashflow, 36);
  const paybackMonth = initialInvestment > 0 && monthlyRevenue > 0 && operatingCashflow > 0
    ? cumulativeCashflow.find((row) => row.cumulativeCashflow >= 0)?.month ?? null
    : null;
  const roi = initialInvestment > 0 ? (operatingCashflow * 12) / initialInvestment : null;

  return {
    monthlyRevenue,
    monthlyOrders,
    monthlyItemsSold,
    deliveryOrders,
    aggregatorOrders,
    foodCostTotal,
    packagingTotal,
    grossProfit,
    acquiringCost,
    aggregatorCommissionCost,
    deliveryLogisticsCost,
    marketingCost: marketingVariable,
    variableOpex,
    variableCosts,
    fixedCosts,
    revenueTax,
    profitTax,
    vatReference,
    ebitda,
    ebitdaMargin,
    taxPaid,
    operatingCashflow,
    initialInvestment,
    contributionMarginPercent,
    paybackMonth,
    roi,
    breakEvenRevenue: breakEven.breakEvenRevenue,
    breakEvenOrders: breakEven.breakEvenOrders,
    breakEvenOrdersPerDay: breakEven.breakEvenOrdersPerDay,
    breakEvenUnavailableReason: breakEven.breakEvenUnavailableReason,
    monthlyDepreciation,
    cumulativeCashflow
  };
}

export function diagnoseNegativeResults(model: StoreModelResult, store: StoreInputs): DiagnosticResult[] {
  const diagnostics: DiagnosticResult[] = [];
  if (model.variableCosts > model.monthlyRevenue) {
    diagnostics.push({
      severity: "critical",
      message: "Переменные расходы выше выручки. Проверьте проценты, комиссии агрегаторов, логистику и налоги.",
      impact: model.variableCosts - model.monthlyRevenue
    });
  }
  if (model.taxPaid > model.monthlyRevenue * 0.3) {
    diagnostics.push({
      severity: "warning",
      message: "Налоговая нагрузка выглядит слишком высокой. Возможно, ставка введена как 1 вместо 1% или 6 вместо 6% при старой логике.",
      impact: model.taxPaid
    });
  }
  if (model.foodCostTotal === 0) diagnostics.push({ severity: "warning", message: "Себестоимость продуктов равна 0. Заполните рецептуры и закупочные цены." });
  if (model.packagingTotal === 0) diagnostics.push({ severity: "warning", message: "Упаковка равна 0. Заполните стоимость упаковки." });
  if (store.avgItemsPerOrder <= 0) diagnostics.push({ severity: "critical", message: "SKU / заказ равен 0. Это ломает расчет unit economics." });
  if (model.ebitdaMargin < 0) {
    const reasons = [
      { label: "Fixed costs", value: model.fixedCosts },
      { label: "Variable costs", value: model.variableCosts },
      { label: "Food cost", value: model.foodCostTotal },
      { label: "Packaging", value: model.packagingTotal },
      { label: "Taxes", value: model.taxPaid }
    ]
      .sort((a, b) => b.value - a.value)
      .slice(0, 3)
      .map((item) => `${item.label}: ${formatRub(item.value)}`)
      .join("; ");
    diagnostics.push({ severity: "warning", message: `EBITDA margin отрицательная. Топ-3 причины по влиянию: ${reasons}.` });
  }
  return diagnostics;
}

export function buildCashflow(initialInvestment: number, monthlyNetCashflow: number, months: number) {
  const rows: Array<{ month: number; netCashflow: number; cumulativeCashflow: number }> = [];
  let cumulative = -money(initialInvestment);
  for (let month = 1; month <= months; month += 1) {
    cumulative += money(monthlyNetCashflow);
    rows.push({ month, netCashflow: money(monthlyNetCashflow), cumulativeCashflow: cumulative });
  }
  return rows;
}

export function runChecks(
  products: ProductInput[],
  economics: ProductEconomics[],
  store: StoreInputs,
  opex: OpexInput[],
  capex: CapexInput[],
  tax: TaxInputs,
  model: StoreModelResult
): CheckResult[] {
  const checks: CheckResult[] = [];
  const percentFields = [
    ["deliveryShare", store.deliveryShare],
    ["aggregatorShare", store.aggregatorShare],
    ["acquiringRate", store.acquiringRate],
    ["aggregatorCommissionRate", store.aggregatorCommissionRate],
    ["revenueTaxRate", tax.revenueTaxRate],
    ["profitTaxRate", tax.profitTaxRate],
    ["vatRate", tax.vatRate],
    ["payrollTaxRate", tax.payrollTaxRate]
  ] as const;
  percentFields.forEach(([field, value]) => {
    if (value != null && value > 100) checks.push({ severity: "critical", code: "PERCENT_OVER_100", message: `${field}: процентное поле > 100%`, category: "Store Model" });
    if (value != null && value < 0) checks.push({ severity: "critical", code: "PERCENT_BELOW_0", message: `${field}: процентное поле < 0%`, category: "Store Model" });
  });
  opex.filter((item) => item.driver === "LINKED_TO_REVENUE").forEach((item) => {
    if (item.amount > 100) checks.push({ severity: "critical", code: "PERCENT_OVER_100", message: `${item.category}: OPEX linked to revenue > 100%`, category: "OPEX" });
  });
  economics.forEach((sku) => {
    if (sku.salePrice <= 0) checks.push({ severity: "critical", code: "ZERO_SKU_PRICE", message: `${sku.name}: цена SKU = 0`, category: "SKU" });
    if (!sku.hasRecipe) checks.push({ severity: "warning", code: "MISSING_RECIPE", message: `${sku.name}: нет рецептуры`, category: "Missing data" });
    if (!sku.hasPackaging) checks.push({ severity: "warning", code: "MISSING_PACKAGING", message: `${sku.name}: нет упаковки`, category: "Missing data" });
    if (sku.ingredientCost === 0) checks.push({ severity: "warning", code: "ZERO_INGREDIENT_COST", message: `${sku.name}: ingredient cost = 0`, category: "SKU" });
    if (sku.missingRecipeData && sku.grossMarginPercent > 0.9) checks.push({ severity: "warning", code: "FAKE_HIGH_MARGIN", message: `${sku.name}: gross margin > 90% из-за отсутствующей рецептуры`, category: "Missing data" });
    if (safeDiv(sku.ingredientCost, sku.salePrice) > 0.4) checks.push({ severity: "warning", code: "FOOD_COST_HIGH", message: `${sku.name}: food cost > 40%`, category: "SKU" });
    if (safeDiv(sku.packagingCost, sku.salePrice) > 0.1) checks.push({ severity: "warning", code: "PACKAGING_COST_HIGH", message: `${sku.name}: packaging cost > 10% от цены`, category: "SKU" });
    if (sku.contributionMargin < 0) checks.push({ severity: "critical", code: "NEGATIVE_SKU_CM", message: `${sku.name}: contribution margin < 0`, category: "SKU" });
    if (sku.ebitdaPerItem < 0) checks.push({ severity: "critical", code: "NEGATIVE_SKU_EBITDA", message: `${sku.name}: EBITDA/item < 0`, category: "SKU" });
    if (sku.totalCostPerItem > sku.salePrice) checks.push({ severity: "critical", code: "TOTAL_COST_OVER_PRICE", message: `${sku.name}: total cost > price`, category: "SKU" });
  });
  if (model.ebitdaMargin < 0.1) checks.push({ severity: "warning", code: "LOW_EBITDA_MARGIN", message: "EBITDA margin < 10%", category: "Store Model" });
  if (model.ebitdaMargin < 0) checks.push({ severity: "warning", code: "NEGATIVE_EBITDA_MARGIN", message: "EBITDA margin < 0%", category: "Store Model" });
  if (model.operatingCashflow < 0) checks.push({ severity: "warning", code: "NEGATIVE_OPERATING_CF", message: "Operating cashflow < 0", category: "Store Model" });
  if ((model.paybackMonth ?? 999) > 24) checks.push({ severity: "warning", code: "LONG_PAYBACK", message: "Окупаемость > 24 месяцев или не достигается", category: "Store Model" });
  const rent = opex.find((item) => item.category.toLowerCase().includes("rent") || item.category.toLowerCase().includes("аренд"))?.amount ?? 0;
  if (safeDiv(rent, model.monthlyRevenue) > 0.12) checks.push({ severity: "warning", code: "RENT_RATIO_HIGH", message: "Аренда / revenue > 12%", category: "OPEX" });
  const payroll = opex.filter((item) => /payroll|фот|зарп/i.test(item.category)).reduce((sum, item) => sum + item.amount, 0);
  if (safeDiv(payroll, model.monthlyRevenue) > 0.25) checks.push({ severity: "warning", code: "PAYROLL_RATIO_HIGH", message: "ФОТ / revenue > 25%", category: "OPEX" });
  const deliveryCommissionRatio = percentDecimal(store.aggregatorCommissionRate) * percentDecimal(store.aggregatorShare) * percentDecimal(store.deliveryShare);
  if (deliveryCommissionRatio > 0.15) checks.push({ severity: "warning", code: "DELIVERY_COMMISSION_HIGH", message: "Комиссия агрегаторов > 15% revenue", category: "Store Model" });
  if (store.deliveryShare > 100) checks.push({ severity: "critical", code: "DELIVERY_SHARE_OVER_100", message: "Delivery share > 100%", category: "Store Model" });
  if (store.aggregatorShare > 100) checks.push({ severity: "critical", code: "AGGREGATOR_SHARE_OVER_100", message: "Aggregator share > 100%", category: "Store Model" });
  if (store.aggregatorCommissionRate > 40) checks.push({ severity: "warning", code: "AGGREGATOR_COMMISSION_HIGH", message: "Aggregator commission > 40%", category: "Store Model" });
  if ((tax.revenueTaxRate ?? 0) > 15) checks.push({ severity: "warning", code: "REVENUE_TAX_HIGH", message: "Revenue tax rate > 15%", category: "Store Model" });
  if (safeDiv(model.taxPaid, model.monthlyRevenue) > 0.3) checks.push({ severity: "warning", code: "TAX_LOAD_HIGH", message: "Tax paid > 30% revenue", category: "Store Model" });
  if (model.variableCosts > model.monthlyRevenue) checks.push({ severity: "critical", code: "VARIABLE_COSTS_OVER_REVENUE", message: "Variable costs > revenue", category: "Store Model" });
  if (products.length && model.foodCostTotal === 0) checks.push({ severity: "warning", code: "ZERO_FOOD_COST", message: "Food cost = 0 while SKU exist", category: "Missing data" });
  if (products.length && model.packagingTotal === 0) checks.push({ severity: "warning", code: "ZERO_PACKAGING", message: "Packaging = 0 while SKU exist", category: "Missing data" });
  if (store.avgItemsPerOrder <= 0) checks.push({ severity: "critical", code: "AVG_ITEMS_ZERO", message: "SKU / заказ не может быть 0, иначе food cost и упаковка могут считаться некорректно. Укажите среднее количество позиций в одном заказе.", category: "Store Model" });
  const month6 = model.cumulativeCashflow.find((row) => row.month === 6);
  if (month6 && month6.cumulativeCashflow < 0) checks.push({ severity: "warning", code: "NEGATIVE_CF_MONTH_6", message: "Cashflow отрицательный после 6 месяцев", category: "Store Model" });
  if (tax.revenueTaxRate == null && tax.profitTaxRate == null && tax.vatRate == null) checks.push({ severity: "warning", code: "MISSING_TAX", message: "Не задана налоговая assumption", category: "Missing data" });
  capex.filter((item) => item.amount > 0 && !item.usefulLifeMonths).forEach((item) => {
    checks.push({ severity: "warning", code: "MISSING_DEPRECIATION_LIFE", message: `${item.category}: не задан срок амортизации`, category: "CAPEX" });
  });
  opex.filter((item) => !item.category.trim()).forEach(() => {
    checks.push({ severity: "warning", code: "EMPTY_OPEX_NAME", message: "OPEX item with empty name", category: "OPEX" });
  });
  if (!products.length) checks.push({ severity: "critical", code: "EMPTY_MENU", message: "Меню пустое: импортируйте или внесите SKU", category: "SKU" });
  return checks;
}
