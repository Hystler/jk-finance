import type { NextApiRequest, NextApiResponse } from "next";
import { buildModelWorkbook } from "@/exports/workbook";
import { prisma } from "@/lib/db";
import { loadModel } from "@/lib/model";
import { calculateRecipeRowCost } from "@/lib/recipe-cost";

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  const data = await loadModel();
  const [assumptions, recipes, productPackaging] = await Promise.all([
    prisma.assumption.findMany(),
    prisma.recipeItem.findMany({ include: { ingredient: true, product: true } }),
    prisma.productPackaging.findMany({ include: { packaging: true, product: true } })
  ]);
  const inputUnits = [
    { field: "workingDaysPerMonth", unit: "дней / мес", note: "1-31" },
    { field: "avgOrdersPerDay", unit: "заказов / день", note: ">= 0" },
    { field: "avgItemsPerOrder", unit: "шт", note: "> 0 recommended" },
    { field: "avgCheck", unit: "₽", note: "> 0 recommended" },
    { field: "deliveryShare", unit: "%", note: "10 = 10%" },
    { field: "aggregatorShare", unit: "%", note: "50 = 50%" },
    { field: "acquiringRate", unit: "%", note: "2.5 = 2.5%" },
    { field: "aggregatorCommissionRate", unit: "%", note: "25 = 25%" },
    { field: "deliveryLogisticsCostPerOrder", unit: "₽ / заказ", note: "delivery order" },
    { field: "marketingCostPerItem", unit: "₽ / SKU", note: "per sold item" },
    { field: "revenueTaxRate", unit: "%", note: "6 = 6%" },
    { field: "profitTaxRate", unit: "%", note: "20 = 20%" },
    { field: "vatRate", unit: "%", note: "reference only, not included automatically" },
    { field: "otherTaxes", unit: "₽ / мес", note: "monthly" },
    { field: "lumpSumFee", unit: "₽", note: "franchise one-time fee" },
    { field: "royaltyRate", unit: "%", note: "6 = 6%" },
    { field: "marketingFeeRate", unit: "%", note: "5 = 5%" },
    { field: "supplyChainMarkup", unit: "%", note: "markup over food cost" },
    { field: "openingInventory", unit: "₽", note: "opening investment component" },
    { field: "launchMarketing", unit: "₽", note: "opening investment component" },
    { field: "rentDeposit", unit: "₽", note: "opening investment component" },
    { field: "contingencyAmount", unit: "₽", note: "overrides contingencyPercent when > 0" },
    { field: "contingencyPercent", unit: "%", note: "percent of CAPEX when amount = 0" },
    { field: "numberOfFranchisees", unit: "шт", note: "network mode allocation" },
    { field: "franchiseWorkingDaysPerMonth", unit: "дней / мес", note: "separate Franchise Mode input" },
    { field: "franchiseAvgOrdersPerDay", unit: "заказов / день", note: "separate Franchise Mode input" },
    { field: "franchiseAvgItemsPerOrder", unit: "шт", note: "SKU / заказ, step 0.1" },
    { field: "franchiseAvgCheck", unit: "₽", note: "average franchisee check" },
    { field: "franchiseDeliverySharePercent", unit: "%", note: "10 = 10%" },
    { field: "franchiseAggregatorSharePercent", unit: "%", note: "50 = 50%" },
    { field: "franchiseAcquiringRatePercent", unit: "%", note: "2 = 2%" },
    { field: "franchiseAggregatorCommissionPercent", unit: "%", note: "25 = 25%" },
    { field: "forecastMonths", unit: "мес", note: "default 24" },
    { field: "revenueTrendType", unit: "flat/growth/decline/ramp_up/custom", note: "franchise revenue trend" },
    { field: "monthlyGrowthRatePercent", unit: "%", note: "growth mode monthly rate" },
    { field: "monthlyDeclineRatePercent", unit: "%", note: "decline mode monthly rate" },
    { field: "rampUpMonths", unit: "мес", note: "ramp_up horizon" },
    { field: "rampUpStartPercent", unit: "%", note: "month 1 revenue share in ramp_up" }
  ];
  const chartsData = [
    ...data.model.cumulativeCashflow.slice(0, 12).map((row) => ({ chart: "cashflow", ...row })),
    { chart: "expense_structure", name: "foodCost", value: data.model.foodCostTotal },
    { chart: "expense_structure", name: "packaging", value: data.model.packagingTotal },
    { chart: "expense_structure", name: "variableCosts", value: data.model.variableCosts },
    { chart: "expense_structure", name: "fixedCosts", value: data.model.fixedCosts },
    { chart: "expense_structure", name: "taxPaid", value: data.model.taxPaid },
    { chart: "expense_structure", name: "depreciation", value: data.model.monthlyDepreciation },
    ...data.sensitivity.map((row) => ({ chart: "sensitivity", parameter: row.parameter, impactOnEbitda: row.impactOnEbitda, impactOnPayback: row.impactOnPayback }))
  ];
  const buffer = buildModelWorkbook({
    economics: data.economics,
    products: data.productsRaw.map((product) => ({
      id: product.id,
      category: product.category,
      name: product.name,
      description: product.description,
      salePrice: product.salePrice,
      imageUrl: product.imageUrl,
      productUrl: product.productUrl,
      isActive: product.isActive,
      source: product.source
    })),
    recipes: recipes.map((item) => {
      const cost = calculateRecipeRowCost({
        ingredient: item.ingredient,
        quantity: item.quantity,
        unit: item.unit,
        wastePercent: item.yieldLossPercent,
        manualFinalCost: item.totalIngredientCost
      });
      return {
        sku_id: item.productId,
        sku_name: item.product.name,
        ingredient_id: item.ingredientId,
        ingredient_name: item.ingredientName,
        quantity_per_portion: item.quantity,
        unit: item.unit,
        waste_percent: item.yieldLossPercent ?? 0,
        cost_per_portion: cost.costPerPortion,
        final_ingredient_cost: cost.finalIngredientCost,
        purchase_price: item.ingredient?.purchasePrice,
        purchase_unit: item.ingredient?.purchaseUnit,
        comment: item.comment,
        source: item.source
      };
    }),
    ingredients: data.ingredientsRaw as any,
    packaging: data.packagingRaw as any,
    productPackaging: productPackaging.map((item) => ({
      productId: item.productId,
      productName: item.product.name,
      packagingId: item.packagingId,
      packagingName: item.packaging.name,
      units: item.units,
      costPerUnit: item.packaging.costPerUnit,
      totalCost: item.units * item.packaging.costPerUnit,
      comment: item.comment
    })),
    model: data.model,
    checks: data.checks,
    capex: data.capexRaw as any,
    opex: data.opexRaw as any,
    assumptions: assumptions as any,
    inputUnits,
    chartsData,
    franchiseModel: data.franchiseModel
  });
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=zhuy-kaifuy-financial-model.xlsx");
  res.send(buffer);
}
