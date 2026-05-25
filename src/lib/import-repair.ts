import { calculateRecipeRowCost } from "@/lib/recipe-cost";
import { cleanImportedText, looksLikeMojibake, normalizeCompositeKey, normalizeLookupKey, repairMojibake } from "@/lib/text-normalize";

export type ProductLike = {
  id: string;
  name: string;
  category: string;
  salePrice?: number | null;
  recipes?: unknown[];
  packagingLinks?: unknown[];
  source?: string | null;
};

export type DuplicateSkuGroup = {
  key: string;
  canonical: ProductLike;
  duplicates: ProductLike[];
};

export type IngredientLike = {
  id: string;
  name: string;
  category?: string | null;
  purchasePrice?: number | null;
  recipes?: unknown[];
};

export function findDuplicateSkuGroups(products: ProductLike[]) {
  const groups = new Map<string, ProductLike[]>();
  for (const product of products) {
    const key = normalizeCompositeKey(product.name, product.category);
    if (!key.replace(/:/g, "")) continue;
    groups.set(key, [...(groups.get(key) ?? []), product]);
  }

  return Array.from(groups.entries())
    .filter(([, rows]) => rows.length > 1)
    .map(([key, rows]) => {
      const canonical = chooseCanonicalSku(rows);
      return {
        key,
        canonical,
        duplicates: rows.filter((row) => row.id !== canonical.id)
      };
    });
}

export function findDuplicateIngredientGroups(ingredients: IngredientLike[]) {
  const groups = new Map<string, IngredientLike[]>();
  for (const ingredient of ingredients) {
    const key = normalizeLookupKey(ingredient.name);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), ingredient]);
  }

  return Array.from(groups.entries())
    .filter(([, rows]) => rows.length > 1)
    .map(([key, rows]) => {
      const canonical = chooseCanonicalIngredient(rows);
      return {
        key,
        canonical,
        duplicates: rows.filter((row) => row.id !== canonical.id)
      };
    });
}

export function chooseCanonicalSku(rows: ProductLike[]) {
  return [...rows].sort((a, b) => skuScore(b) - skuScore(a))[0];
}

export function chooseCanonicalIngredient(rows: IngredientLike[]) {
  return [...rows].sort((a, b) => ingredientScore(b) - ingredientScore(a))[0];
}

export function repairImportedName(value: unknown) {
  return cleanImportedText(repairMojibake(value));
}

export function isBrokenImportedName(value: unknown) {
  return looksLikeMojibake(value);
}

export function recipeCostSource(item: {
  source?: string | null;
  totalIngredientCost?: number | null;
  ingredient?: { purchasePrice: number; purchaseUnit: string } | null;
  quantity?: number | null;
  unit?: string | null;
  yieldLossPercent?: number | null;
}) {
  if (item.source === "USER_PORTION_COST") return "manual";
  const cost = calculateRecipeRowCost({
    ingredient: item.ingredient,
    quantity: item.quantity,
    unit: item.unit,
    wastePercent: item.yieldLossPercent,
    manualFinalCost: null
  });
  return cost.compatible ? "calculated" : "unknown";
}

function skuScore(product: ProductLike) {
  let score = 0;
  if (!looksLikeMojibake(product.name)) score += 100;
  if (!looksLikeMojibake(product.category)) score += 50;
  if (Number(product.salePrice ?? 0) > 0) score += 25;
  score += Math.min((product.recipes?.length ?? 0) * 3, 15);
  score += Math.min((product.packagingLinks?.length ?? 0) * 2, 10);
  if (normalizeLookupKey(product.source).includes("imported")) score += 1;
  return score;
}

function ingredientScore(ingredient: IngredientLike) {
  let score = 0;
  if (!looksLikeMojibake(ingredient.name)) score += 100;
  if (!looksLikeMojibake(ingredient.category)) score += 25;
  if (Number(ingredient.purchasePrice ?? 0) > 0) score += 20;
  score += Math.min((ingredient.recipes?.length ?? 0) * 2, 10);
  return score;
}
