import type { ProductInput, RecipeInput } from "@/models/financial";

export const RECIPE_UNITS = ["kg", "g", "liter", "ml", "piece"] as const;

export type RecipeUnit = (typeof RECIPE_UNITS)[number];

type UnitGroup = "mass" | "volume" | "piece";

type CostIngredient = {
  purchasePrice: number;
  purchaseUnit: string;
};

type RecipeCostInput = {
  ingredient?: CostIngredient | null;
  quantity?: number | null;
  unit?: string | null;
  wastePercent?: number | null;
  manualFinalCost?: number | null;
};

export type RecipeRowCost = {
  costPerPortion: number;
  finalIngredientCost: number;
  foodCostPercent: number | null;
  compatible: boolean;
  error: string | null;
};

export function roundMoney(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

export function normalizeRecipeUnit(value: unknown): RecipeUnit | null {
  const unit = String(value ?? "").trim().toLowerCase();
  return RECIPE_UNITS.includes(unit as RecipeUnit) ? unit as RecipeUnit : null;
}

export function calculateIngredientCost(ingredient?: CostIngredient | null) {
  if (!ingredient) return 0;
  const purchaseUnit = normalizeRecipeUnit(ingredient.purchaseUnit);
  if (!purchaseUnit) return roundMoney(Number(ingredient.purchasePrice) || 0);
  return roundMoney((Number(ingredient.purchasePrice) || 0) / unitInfo(purchaseUnit).baseFactor);
}

export function validateUnitCompatibility(purchaseUnit: unknown, recipeUnit: unknown) {
  const purchase = normalizeRecipeUnit(purchaseUnit);
  const recipe = normalizeRecipeUnit(recipeUnit);
  if (!purchase || !recipe) return { ok: false, message: "Unit должен быть одним из: kg, g, liter, ml, piece." };
  if (unitInfo(purchase).group !== unitInfo(recipe).group) {
    return { ok: false, message: `Нельзя конвертировать ${purchase} в ${recipe}. Используйте совместимые единицы.` };
  }
  return { ok: true, message: null };
}

export function calculateRecipeRowCost(input: RecipeCostInput): RecipeRowCost {
  const manual = numberOrNull(input.manualFinalCost);
  if (manual != null) {
    const finalIngredientCost = roundMoney(manual);
    return {
      costPerPortion: finalIngredientCost,
      finalIngredientCost,
      foodCostPercent: null,
      compatible: true,
      error: null
    };
  }

  const ingredient = input.ingredient;
  if (!ingredient) return zeroCost("Ingredient is required.");
  const quantity = Number(input.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) return zeroCost("Quantity must be greater than 0.");
  const wastePercent = Number(input.wastePercent ?? 0);
  if (!Number.isFinite(wastePercent) || wastePercent < 0) return zeroCost("Waste % must be 0 or greater.");

  const recipeUnit = normalizeRecipeUnit(input.unit);
  const purchaseUnit = normalizeRecipeUnit(ingredient.purchaseUnit);
  if (!recipeUnit || !purchaseUnit) return zeroCost("Unit должен быть одним из: kg, g, liter, ml, piece.");

  const compatibility = validateUnitCompatibility(purchaseUnit, recipeUnit);
  if (!compatibility.ok) return zeroCost(compatibility.message ?? "Несовместимые единицы.");

  const purchase = unitInfo(purchaseUnit);
  const recipe = unitInfo(recipeUnit);
  const pricePerBaseUnit = (Number(ingredient.purchasePrice) || 0) / purchase.baseFactor;
  const quantityInBaseUnit = quantity * recipe.baseFactor;
  const costPerPortion = roundMoney(pricePerBaseUnit * quantityInBaseUnit);
  const finalIngredientCost = roundMoney(costPerPortion * (1 + wastePercent / 100));

  return {
    costPerPortion,
    finalIngredientCost,
    foodCostPercent: null,
    compatible: true,
    error: null
  };
}

export function calculateRecipeItemCostDetails(item: RecipeInput): RecipeRowCost {
  const quantity = item.quantity ?? item.netWeightGrams ?? item.grossWeightGrams ?? null;
  return calculateRecipeRowCost({
    ingredient: item.ingredient,
    quantity,
    unit: item.unit,
    wastePercent: item.yieldLossPercent,
    manualFinalCost: item.totalIngredientCost ?? item.costPerUnit
  });
}

export function calculateSkuRecipeTotal(product: ProductInput) {
  return roundMoney((product.recipes ?? []).reduce((sum, item) => sum + calculateRecipeItemCostDetails(item).finalIngredientCost, 0));
}

export function calculateFoodCostPercent(recipeTotal: number, salePrice?: number | null) {
  const price = Number(salePrice ?? 0);
  if (!Number.isFinite(price) || price <= 0) return null;
  return recipeTotal / price;
}

function zeroCost(error: string): RecipeRowCost {
  return {
    costPerPortion: 0,
    finalIngredientCost: 0,
    foodCostPercent: null,
    compatible: false,
    error
  };
}

function numberOrNull(value: unknown) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function unitInfo(unit: RecipeUnit): { group: UnitGroup; baseFactor: number } {
  if (unit === "kg") return { group: "mass", baseFactor: 1000 };
  if (unit === "g") return { group: "mass", baseFactor: 1 };
  if (unit === "liter") return { group: "volume", baseFactor: 1000 };
  if (unit === "ml") return { group: "volume", baseFactor: 1 };
  return { group: "piece", baseFactor: 1 };
}
