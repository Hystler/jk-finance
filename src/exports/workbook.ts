import * as XLSX from "xlsx";
import type { FranchiseFinancialModel } from "@/calculations/franchise";
import type { CheckResult, ProductEconomics, StoreModelResult } from "@/models/financial";

export function buildModelWorkbook(input: {
  economics: ProductEconomics[];
  products: Array<Record<string, unknown>>;
  recipes: Array<Record<string, unknown>>;
  ingredients: Array<Record<string, unknown>>;
  packaging: Array<Record<string, unknown>>;
  productPackaging: Array<Record<string, unknown>>;
  model: StoreModelResult;
  checks: CheckResult[];
  capex: Array<Record<string, unknown>>;
  opex: Array<Record<string, unknown>>;
  assumptions: Array<Record<string, unknown>>;
  inputUnits: Array<Record<string, unknown>>;
  chartsData: Array<Record<string, unknown>>;
  franchiseModel?: FranchiseFinancialModel;
}) {
  const workbook = XLSX.utils.book_new();
  appendJsonSheet(workbook, input.products, "SKU List");
  appendJsonSheet(workbook, input.economics.map((row) => ({
    productId: row.productId,
    category: row.category,
    name: row.name,
    price: row.salePrice,
    ingredientCost: row.ingredientCost,
    packaging: row.packagingCost,
    grossProfit: row.grossProfit,
    grossMargin: row.grossMarginPercent,
    variableCosts: row.totalVariableCost,
    contribution: row.contributionMargin,
    contributionMargin: row.contributionMarginPercent,
    allocatedFixedCost: row.allocatedFixedCostPerItem,
    depreciation: row.depreciationPerItem,
    ebitdaPerItem: row.ebitdaPerItem,
    ebitdaMargin: row.ebitdaMarginPercent,
    status: row.status,
    warnings: row.warnings.join("; ")
  })), "SKU Unit Economics");
  appendJsonSheet(workbook, toSimpleMenuRows(input.products), "Simple Menu");
  appendJsonSheet(workbook, toSimpleIngredientRows(input.ingredients), "Simple Ingredients");
  appendJsonSheet(workbook, toSimpleRecipeRows(input.recipes), "Simple Recipes");
  appendJsonSheet(workbook, input.recipes, "Recipes");
  appendJsonSheet(workbook, input.ingredients, "Ingredients");
  appendJsonSheet(workbook, input.packaging, "Packaging");
  appendJsonSheet(workbook, input.productPackaging, "Product Packaging");
  appendJsonSheet(workbook, [input.model], "Store P&L");
  appendJsonSheet(workbook, input.capex, "CAPEX");
  appendJsonSheet(workbook, input.opex, "OPEX");
  appendJsonSheet(workbook, input.checks, "Checks");
  appendJsonSheet(workbook, input.assumptions, "Assumptions");
  appendJsonSheet(workbook, input.chartsData, "Charts Data");
  appendJsonSheet(workbook, input.model.cumulativeCashflow, "Cashflow");
  appendJsonSheet(workbook, input.inputUnits, "Input Units");
  if (input.franchiseModel) appendFranchiseSheets(workbook, input.franchiseModel);
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

function appendJsonSheet(workbook: XLSX.WorkBook, rows: Array<Record<string, unknown>>, name: string) {
  const sheet = XLSX.utils.json_to_sheet(rows);
  formatNumericCells(sheet);
  XLSX.utils.book_append_sheet(workbook, sheet, name);
}

function toSimpleMenuRows(products: Array<Record<string, unknown>>) {
  return products.map((row) => ({
    sku_name: pick(row, "name", "sku_name"),
    category: pick(row, "category"),
    sale_price: pick(row, "salePrice", "sale_price", "price"),
    description: pick(row, "description"),
    image_url: pick(row, "imageUrl", "image_url"),
    product_url: pick(row, "productUrl", "product_url"),
    is_active: pick(row, "isActive", "is_active") ?? true
  }));
}

function toSimpleIngredientRows(ingredients: Array<Record<string, unknown>>) {
  return ingredients.map((row) => ({
    ingredient_name: pick(row, "name", "ingredientName", "ingredient_name"),
    category: pick(row, "category"),
    supplier: pick(row, "supplier"),
    purchase_price: pick(row, "purchasePrice", "purchase_price"),
    purchase_unit: pick(row, "purchaseUnit", "purchase_unit"),
    comment: pick(row, "comment")
  }));
}

function toSimpleRecipeRows(recipes: Array<Record<string, unknown>>) {
  return recipes.map((row) => {
    const manualCost = pick(row, "costInPortion", "cost_in_portion", "totalIngredientCost", "total_ingredient_cost");
    return {
      sku_name: pick(row, "productName", "sku_name", "product_name"),
      ingredient_name: pick(row, "ingredientName", "ingredient_name"),
      quantity: pick(row, "quantity"),
      unit: pick(row, "unit"),
      purchase_price: pick(row, "purchasePrice", "purchase_price", "unitPurchasePrice", "unit_purchase_price"),
      purchase_unit: pick(row, "purchaseUnit", "purchase_unit", "unitMeasure", "unit_measure"),
      cost_in_portion: manualCost ?? "",
      comment: pick(row, "comment")
    };
  });
}

function pick(row: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null) return row[key];
  }
  return "";
}

function formatNumericCells(sheet: XLSX.WorkSheet) {
  for (const address of Object.keys(sheet)) {
    if (address.startsWith("!")) continue;
    const cell = sheet[address];
    if (!cell || typeof cell.v !== "number") continue;
    cell.z = Number.isInteger(cell.v) ? "#,##0" : "#,##0.0";
  }
}

function appendFranchiseSheets(workbook: XLSX.WorkBook, franchiseModel: FranchiseFinancialModel) {
  const franchisee = franchiseModel.franchisee;
  const franchisor = franchiseModel.franchisor;
  const franchiseInputs = Object.entries(franchiseModel.franchise).map(([field, value]) => ({
    field,
    value
  }));
  appendJsonSheet(workbook, franchiseInputs, "Franchise Inputs");
  appendJsonSheet(workbook, franchiseInputs.filter((row) => row.field.startsWith("franchise")), "Franchise Store Inputs");
  appendJsonSheet(workbook, franchisee.cumulativeCashflow24.filter((row) => row.month > 0).map((row) => ({
    Month: row.month,
    Revenue: row.revenue,
    Orders: row.orders,
    Items: row.items
  })), "Franchise Revenue Trend");
  appendJsonSheet(workbook, franchisee.monthlyForecast.map((row) => ({
    Month: row.month,
    Revenue: row.revenue,
    Orders: row.orders,
    Items: row.items,
    "Food cost": row.foodCost,
    Packaging: row.packagingCost,
    "Variable costs": row.variableCosts,
    "Fixed costs": row.fixedCosts,
    "EBITDA before fees": row.ebitdaBeforeFees,
    Royalty: row.royalty,
    "Marketing fee": row.marketingFee,
    "Supply-chain markup": row.supplyChainMarkup,
    "EBITDA after fees": row.ebitdaAfterFees,
    Taxes: row.taxes,
    "Net operating cashflow": row.netOperatingCashflow,
    "Cumulative cashflow": row.cumulativeCashflow
  })), "Franchise 24M Forecast");
  appendJsonSheet(workbook, franchisee.cumulativeCashflow24.map((row) => ({
    Month: row.label,
    "Opening investment": row.openingInvestment,
    "Net operating cashflow": row.netOperatingCashflow,
    "Cumulative cashflow": row.cumulativeCashflow
  })), "Franchise Payback");
  appendJsonSheet(workbook, franchisee.pnlRows.map((row) => ({
    row: row.label,
    value: row.value,
    percentOfRevenue: row.margin ?? null,
    kind: row.kind
  })), "Franchisee P&L");
  appendJsonSheet(workbook, franchisee.pnlRowsMonth1.map((row) => ({
    row: row.label,
    value: row.value,
    percentOfRevenue: row.margin ?? null,
    kind: row.kind
  })), "Franchise P&L Month 1");
  appendJsonSheet(workbook, franchisee.pnlRowsMonth12.map((row) => ({
    row: row.label,
    value: row.value,
    percentOfRevenue: row.margin ?? null,
    kind: row.kind
  })), "Franchise P&L Month 12");
  appendJsonSheet(workbook, franchisee.cumulativeCashflow24.map((row) => ({
    Month: row.label,
    Revenue: row.revenue,
    "EBITDA before fees": row.ebitdaBeforeFees,
    Royalty: row.royalty,
    "Marketing fee": row.marketingFee,
    "Supply-chain markup": row.supplyChainMarkup,
    "EBITDA after fees": row.ebitdaAfterFees,
    Taxes: row.taxes,
    "Loan payments": row.loanPayments,
    "Owner withdrawals": row.ownerWithdrawals,
    "Net operating cashflow": row.netOperatingCashflow,
    "Opening investment": row.openingInvestment,
    "Cumulative cashflow": row.cumulativeCashflow
  })), "Franchisee Cashflow 24M");
  appendJsonSheet(workbook, franchisee.monthlyForecast.map((row) => ({
    chart: "franchise_forecast",
    month: row.month,
    revenue: row.revenue,
    ebitdaAfterFees: row.ebitdaAfterFees,
    netCashflow: row.netOperatingCashflow,
    cumulativeCashflow: row.cumulativeCashflow,
    grossMargin: row.grossMargin,
    contributionMargin: row.contributionMargin,
    ebitdaMarginBeforeFees: row.ebitdaMarginBeforeFees,
    ebitdaMarginAfterFees: row.ebitdaMarginAfterFees,
    netCashflowMargin: row.netCashflowMargin
  })), "Franchise Charts Data");
  appendJsonSheet(workbook, [
    {
      metric: "Monthly franchisor revenue / franchisee",
      value: franchisor.monthlyRevenue
    },
    { metric: "One-time franchisor revenue", value: franchisor.oneTimeRevenue },
    { metric: "Royalty", value: franchisor.royalty },
    { metric: "Marketing fee", value: franchisor.marketingFee },
    { metric: "Supply-chain markup revenue", value: franchisor.supplyChainMarkupRevenue },
    { metric: "Training fee", value: franchisor.trainingFee },
    { metric: "Opening support fee", value: franchisor.openingSupportFee },
    { metric: "Support cost / franchisee", value: franchisor.supportCostPerFranchisee },
    { metric: "Allocated fixed team costs", value: franchisor.allocatedFixedTeamCosts },
    { metric: "Franchisor EBITDA / franchisee", value: franchisor.ebitda },
    { metric: "Franchisor total monthly revenue", value: franchisor.totalMonthlyRevenue },
    { metric: "Franchisor total monthly EBITDA", value: franchisor.totalMonthlyEBITDA },
    { metric: "Franchisor EBITDA margin", value: franchisor.ebitdaMargin }
  ], "Franchisor Model");
  appendJsonSheet(workbook, franchiseModel.scenarios.rows, "Franchise Scenarios");
  appendJsonSheet(workbook, franchiseModel.sensitivity, "Franchise Sensitivity");
  appendJsonSheet(workbook, [
    ...franchiseModel.checks.map((check) => ({ type: "check", ...check })),
    ...franchiseModel.missingDataWarnings.map((message) => ({ type: "missing_data", severity: "warning", code: "MISSING_DATA", message })),
    ...franchiseModel.breakers.map((message) => ({ type: "breaker", severity: "warning", code: "FRANCHISE_BREAKER", message }))
  ], "Franchise Checks");
}
