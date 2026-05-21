import { calculateMonthlyDepreciation, calculateProductEconomics, calculateStoreModel, diagnoseNegativeResults, runChecks } from "@/calculations/financial";
import { calculateFranchiseFinancialModel, normalizeFranchiseSettings } from "@/calculations/franchise";
import { calculateSensitivity } from "@/calculations/sensitivity";
import { prisma } from "@/lib/db";
import type { CapexInput, OpexInput, ProductInput, SourceKind, StoreInputs, TaxInputs } from "@/models/financial";

export async function ensureDefaults() {
  const storeCount = await prisma.storeInput.count();
  if (!storeCount) {
    await prisma.storeInput.create({
      data: {
        id: "default-store",
        location: "editable assumption",
        workingDaysPerMonth: 0,
        workingHoursPerDay: 0,
        avgOrdersPerDay: 0,
        avgItemsPerOrder: 0,
        avgCheck: 0,
        deliveryShare: 0,
        aggregatorShare: 0,
        ownDeliveryShare: 0,
        pickupShare: 0,
        acquiringRate: 0,
        aggregatorCommissionRate: 0,
        source: "ASSUMPTION"
      }
    });
  }
  const taxCount = await prisma.taxSettings.count();
  if (!taxCount) {
    await prisma.taxSettings.create({ data: { id: "default-tax", taxSystem: "editable assumption", source: "ASSUMPTION" } });
  }
  const franchiseCount = await prisma.franchiseSettings.count();
  if (!franchiseCount) {
    await prisma.franchiseSettings.create({ data: { id: "default-franchise", source: "ASSUMPTION" } });
  }
}

export async function loadModel() {
  await ensureDefaults();
  const [productsRaw, ingredientsRaw, packagingRaw, storeRaw, opexRaw, capexRaw, taxRaw, franchiseRaw] = await Promise.all([
    prisma.product.findMany({
      orderBy: [{ category: "asc" }, { name: "asc" }],
      include: {
        recipes: { include: { ingredient: true } },
        packagingLinks: { include: { packaging: true } }
      }
    }),
    prisma.ingredient.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] }),
    prisma.packaging.findMany({ orderBy: { name: "asc" } }),
    prisma.storeInput.findFirst(),
    prisma.opexItem.findMany({ orderBy: { category: "asc" } }),
    prisma.capexItem.findMany({ orderBy: { category: "asc" } }),
    prisma.taxSettings.findFirst(),
    prisma.franchiseSettings.findFirst()
  ]);

  const products: ProductInput[] = productsRaw.map((product) => ({
    id: product.id,
    category: product.category,
    name: product.name,
    description: product.description,
    salePrice: product.salePrice,
    isActive: product.isActive,
    taxRate: product.taxRate,
    source: product.source as SourceKind,
    recipes: product.recipes.map((recipe) => ({
      id: recipe.id,
      productId: recipe.productId,
      ingredientId: recipe.ingredientId,
      ingredientName: recipe.ingredientName,
      ingredient: recipe.ingredient ? {
        id: recipe.ingredient.id,
        name: recipe.ingredient.name,
        category: recipe.ingredient.category,
        supplier: recipe.ingredient.supplier,
        purchasePrice: recipe.ingredient.purchasePrice,
        purchaseUnit: recipe.ingredient.purchaseUnit,
        edibleYieldPercent: recipe.ingredient.edibleYieldPercent,
        storageLossPercent: recipe.ingredient.storageLossPercent,
        comment: recipe.ingredient.comment,
        source: recipe.ingredient.source as SourceKind
      } : null,
      quantity: recipe.quantity,
      unit: recipe.unit,
      grossWeightGrams: recipe.grossWeightGrams,
      netWeightGrams: recipe.netWeightGrams,
      yieldLossPercent: recipe.yieldLossPercent,
      unitPurchasePrice: recipe.unitPurchasePrice,
      unitMeasure: recipe.unitMeasure,
      costPerUnit: recipe.costPerUnit,
      totalIngredientCost: recipe.totalIngredientCost,
      comment: recipe.comment,
      source: recipe.source as SourceKind
    })),
    packagingLinks: product.packagingLinks.map((link) => ({
      id: link.id,
      packagingId: link.packagingId,
      units: link.units,
      comment: link.comment,
      packaging: {
        id: link.packaging.id,
        name: link.packaging.name,
        costPerUnit: link.packaging.costPerUnit,
        supplier: link.packaging.supplier,
        comment: link.packaging.comment,
        source: link.packaging.source as SourceKind
      }
    }))
  }));

  const store: StoreInputs = {
    workingDaysPerMonth: storeRaw?.workingDaysPerMonth ?? 0,
    avgOrdersPerDay: storeRaw?.avgOrdersPerDay ?? 0,
    avgItemsPerOrder: storeRaw?.avgItemsPerOrder ?? 0,
    avgCheck: storeRaw?.avgCheck ?? 0,
    deliveryShare: storeRaw?.deliveryShare ?? 0,
    aggregatorShare: storeRaw?.aggregatorShare ?? 0,
    acquiringRate: storeRaw?.acquiringRate ?? 0,
    aggregatorCommissionRate: storeRaw?.aggregatorCommissionRate ?? 0,
    deliveryLogisticsCostPerOrder: storeRaw?.deliveryLogisticsCostPerOrder ?? 0,
    marketingCostPerItem: storeRaw?.marketingCostPerItem ?? 0,
    ownerWithdrawalsMonthly: storeRaw?.ownerWithdrawalsMonthly ?? 0,
    loanPaymentsMonthly: storeRaw?.loanPaymentsMonthly ?? 0,
    workingCapitalChangeMonthly: storeRaw?.workingCapitalChangeMonthly ?? 0
  };

  const opex: OpexInput[] = opexRaw.map((item) => ({
    category: item.category,
    amount: item.amount,
    behavior: item.behavior as OpexInput["behavior"],
    driver: item.driver as OpexInput["driver"]
  }));
  const capex: CapexInput[] = capexRaw.map((item) => ({
    category: item.category,
    amount: item.amount,
    usefulLifeMonths: item.usefulLifeMonths,
    paidBeforeOpening: item.paidBeforeOpening
  }));
  const tax: TaxInputs = {
    revenueTaxRate: taxRaw?.revenueTaxRate,
    profitTaxRate: taxRaw?.profitTaxRate,
    vatRate: taxRaw?.vatRate,
    payrollTaxRate: taxRaw?.payrollTaxRate,
    otherTaxes: taxRaw?.otherTaxes
  };

  const monthlyDepreciation = calculateMonthlyDepreciation(capex);
  const fixedCosts = opex.filter((item) => item.behavior === "FIXED").reduce((sum, item) => sum + item.amount, 0);
  const model = calculateStoreModel(products, store, opex, capex, tax);
  const economics = products.map((product) =>
    calculateProductEconomics(product, store, tax, monthlyDepreciation, fixedCosts, model.monthlyItemsSold)
  );
  const checks = runChecks(products, economics, store, opex, capex, tax, model);
  const diagnostics = diagnoseNegativeResults(model, store);
  const sensitivity = calculateSensitivity(products, store, opex, capex, tax);
  const franchise = normalizeFranchiseSettings(franchiseRaw as any);
  const franchiseModel = calculateFranchiseFinancialModel({ products, store, opex, capex, tax, model, franchise });

  return {
    productsRaw,
    ingredientsRaw,
    packagingRaw,
    storeRaw,
    opexRaw,
    capexRaw,
    taxRaw,
    franchiseRaw,
    products,
    store,
    opex,
    capex,
    tax,
    franchise,
    franchiseModel,
    economics,
    model,
    diagnostics,
    checks,
    sensitivity
  };
}
