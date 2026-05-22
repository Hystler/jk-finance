export type SourceKind = "USER_INPUT" | "IMPORTED_MENU" | "CALCULATED" | "ASSUMPTION" | "MANUAL" | "IMPORTED";

export type ProductInput = {
  id: string;
  category: string;
  name: string;
  description?: string | null;
  salePrice: number;
  isActive?: boolean;
  taxRate?: number | null;
  source?: SourceKind;
  recipes?: RecipeInput[];
  packagingLinks?: PackagingLinkInput[];
};

export type IngredientInput = {
  id?: string | null;
  name: string;
  category?: string | null;
  supplier?: string | null;
  purchasePrice: number;
  purchaseUnit: "kg" | "g" | "liter" | "ml" | "piece" | string;
  edibleYieldPercent?: number | null;
  storageLossPercent?: number | null;
  comment?: string | null;
  source?: SourceKind;
};

export type RecipeInput = {
  id?: string;
  productId?: string;
  ingredientId?: string | null;
  ingredientName: string;
  ingredient?: IngredientInput | null;
  quantity?: number | null;
  unit?: "g" | "ml" | "piece" | string | null;
  grossWeightGrams?: number | null;
  netWeightGrams?: number | null;
  yieldLossPercent?: number | null;
  unitPurchasePrice?: number | null;
  unitMeasure?: string | null;
  costPerUnit?: number | null;
  totalIngredientCost?: number | null;
  comment?: string | null;
  source?: SourceKind;
};

export type PackagingInput = {
  id?: string;
  name: string;
  costPerUnit: number;
  supplier?: string | null;
  comment?: string | null;
  source?: SourceKind;
};

export type PackagingLinkInput = {
  id?: string;
  packagingId?: string;
  units: number;
  packaging: PackagingInput;
  comment?: string | null;
};

export type StoreInputs = {
  workingDaysPerMonth: number;
  avgOrdersPerDay: number;
  avgItemsPerOrder: number;
  avgCheck: number;
  deliveryShare: number;
  aggregatorShare: number;
  acquiringRate: number;
  aggregatorCommissionRate: number;
  deliveryLogisticsCostPerOrder: number;
  marketingCostPerItem: number;
  ownerWithdrawalsMonthly: number;
  loanPaymentsMonthly: number;
  workingCapitalChangeMonthly: number;
};

export type TaxInputs = {
  revenueTaxRate?: number | null;
  profitTaxRate?: number | null;
  vatRate?: number | null;
  payrollTaxRate?: number | null;
  otherTaxes?: number | null;
};

export type RoyaltyType = "percent_of_revenue" | "fixed_monthly" | "hybrid";
export type RevenueTrendType = "flat" | "growth" | "decline" | "ramp_up" | "custom";

export type FranchiseSettingsInput = {
  lumpSumFee: number;
  royaltyType: RoyaltyType;
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
  revenueTrendType: RevenueTrendType;
  monthlyGrowthRatePercent: number;
  monthlyDeclineRatePercent: number;
  rampUpMonths: number;
  rampUpStartPercent: number;
  seasonalityEnabled: boolean;
  franchiseInputsCopiedFromStore: boolean;
};

export type OpexInput = {
  category: string;
  amount: number;
  behavior: "FIXED" | "VARIABLE";
  driver: "FIXED" | "LINKED_TO_REVENUE" | "LINKED_TO_ORDERS" | "LINKED_TO_ITEMS";
};

export type CapexInput = {
  category: string;
  amount: number;
  usefulLifeMonths?: number | null;
  paidBeforeOpening?: boolean;
};

export type ProductStatus =
  | "good"
  | "warning"
  | "bad"
  | "missing recipe"
  | "missing packaging"
  | "negative contribution"
  | "negative EBITDA"
  | "high food cost"
  | "low margin";

export type ProductEconomics = {
  productId: string;
  name: string;
  category: string;
  salePrice: number;
  ingredientCost: number;
  packagingCost: number;
  directLaborCostPerItem: number;
  acquiringCost: number;
  deliveryCommission: number;
  aggregatorCommissionPerItem: number;
  deliveryLogisticsCost: number;
  deliveryLogisticsPerItem: number;
  marketingCostPerItem: number;
  royaltyPerItem: number;
  taxPerItem: number;
  depreciationPerItem: number;
  allocatedFixedCostPerItem: number;
  totalVariableCost: number;
  totalCostPerItem: number;
  grossProfit: number;
  grossMarginPercent: number;
  contributionMargin: number;
  contributionMarginPercent: number;
  ebitdaPerItem: number;
  ebitdaMarginPercent: number;
  status: ProductStatus;
  warnings: string[];
  hasRecipe: boolean;
  hasPackaging: boolean;
  missingRecipeData: boolean;
};

export type StoreModelResult = {
  monthlyRevenue: number;
  monthlyOrders: number;
  monthlyItemsSold: number;
  deliveryOrders: number;
  aggregatorOrders: number;
  foodCostTotal: number;
  packagingTotal: number;
  grossProfit: number;
  acquiringCost: number;
  aggregatorCommissionCost: number;
  deliveryLogisticsCost: number;
  marketingCost: number;
  variableOpex: number;
  variableCosts: number;
  fixedCosts: number;
  revenueTax: number;
  profitTax: number;
  vatReference: number;
  ebitda: number;
  ebitdaMargin: number;
  taxPaid: number;
  operatingCashflow: number;
  initialInvestment: number;
  contributionMarginPercent: number;
  paybackMonth: number | null;
  roi: number | null;
  breakEvenRevenue: number | null;
  breakEvenOrders: number | null;
  breakEvenOrdersPerDay: number | null;
  breakEvenUnavailableReason: string | null;
  monthlyDepreciation: number;
  cumulativeCashflow: Array<{ month: number; netCashflow: number; cumulativeCashflow: number }>;
};

export type DiagnosticResult = {
  severity: "info" | "warning" | "critical";
  message: string;
  impact?: number;
};

export type CheckResult = {
  severity: "warning" | "critical";
  code: string;
  message: string;
  category?: "SKU" | "Store Model" | "CAPEX" | "OPEX" | "Missing data";
};
