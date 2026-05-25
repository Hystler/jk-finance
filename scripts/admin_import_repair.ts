import { prisma } from "../src/lib/db";
import { calculateRecipeRowCost } from "../src/lib/recipe-cost";
import { findDuplicateIngredientGroups, findDuplicateSkuGroups, repairImportedName } from "../src/lib/import-repair";

const apply = process.argv.includes("--apply");
const includeManual = process.argv.includes("--include-manual");

async function main() {
  const mergeResult = await mergeDuplicateSku();
  const ingredientMergeResult = await mergeDuplicateIngredients();
  const repairResult = await repairNames();
  const recalculateResult = await recalculateRecipes();

  console.log(JSON.stringify({ apply, mergeResult, ingredientMergeResult, repairResult, recalculateResult }, null, 2));
}

async function mergeDuplicateSku() {
  const products = await prisma.product.findMany({ include: { recipes: true, packagingLinks: true } });
  const groups = findDuplicateSkuGroups(products);
  const plan = groups.flatMap((group) => group.duplicates.map((duplicate) => ({
    fromId: duplicate.id,
    fromName: duplicate.name,
    fromCategory: duplicate.category,
    toId: group.canonical.id,
    toName: group.canonical.name,
    toCategory: group.canonical.category
  })));

  if (apply) {
    for (const group of groups) {
      for (const duplicate of group.duplicates) {
        await prisma.recipeItem.updateMany({ where: { productId: duplicate.id }, data: { productId: group.canonical.id } });
        await prisma.productPackaging.updateMany({ where: { productId: duplicate.id }, data: { productId: group.canonical.id } });
        await prisma.assumption.updateMany({ where: { productId: duplicate.id }, data: { productId: group.canonical.id } });
        await prisma.product.delete({ where: { id: duplicate.id } });
      }
    }
  }

  return { planned: plan.length, plan };
}

async function mergeDuplicateIngredients() {
  const ingredients = await prisma.ingredient.findMany({ include: { recipes: true } });
  const groups = findDuplicateIngredientGroups(ingredients);
  const plan = groups.flatMap((group) => group.duplicates.map((duplicate) => ({
    fromId: duplicate.id,
    fromName: duplicate.name,
    toId: group.canonical.id,
    toName: group.canonical.name
  })));

  if (apply) {
    for (const group of groups) {
      for (const duplicate of group.duplicates) {
        await prisma.recipeItem.updateMany({
          where: { ingredientId: duplicate.id },
          data: { ingredientId: group.canonical.id, ingredientName: group.canonical.name }
        });
        await prisma.ingredient.delete({ where: { id: duplicate.id } });
      }
    }
  }

  return { planned: plan.length, plan };
}

async function repairNames() {
  const [products, ingredients] = await Promise.all([
    prisma.product.findMany(),
    prisma.ingredient.findMany()
  ]);
  const productPlan = products
    .map((product) => ({
      id: product.id,
      name: product.name,
      category: product.category,
      description: product.description,
      sourceNote: product.sourceNote,
      nextName: repairImportedName(product.name),
      nextCategory: repairImportedName(product.category),
      nextDescription: product.description ? repairImportedName(product.description) : null,
      nextSourceNote: product.sourceNote ? repairImportedName(product.sourceNote) : null
    }))
    .filter((item) =>
      item.name !== item.nextName ||
      item.category !== item.nextCategory ||
      item.description !== item.nextDescription ||
      item.sourceNote !== item.nextSourceNote
    );
  const ingredientPlan = ingredients
    .map((ingredient) => ({
      id: ingredient.id,
      name: ingredient.name,
      category: ingredient.category,
      supplier: ingredient.supplier,
      comment: ingredient.comment,
      nextName: repairImportedName(ingredient.name),
      nextCategory: ingredient.category ? repairImportedName(ingredient.category) : null,
      nextSupplier: ingredient.supplier ? repairImportedName(ingredient.supplier) : null,
      nextComment: ingredient.comment ? repairImportedName(ingredient.comment) : null
    }))
    .filter((item) =>
      item.name !== item.nextName ||
      item.category !== item.nextCategory ||
      item.supplier !== item.nextSupplier ||
      item.comment !== item.nextComment
    );

  const skipped: Array<{ id: string; reason: string }> = [];
  if (apply) {
    for (const item of productPlan) {
      try {
        await prisma.product.update({
          where: { id: item.id },
          data: {
            name: item.nextName,
            category: item.nextCategory,
            description: item.nextDescription,
            sourceNote: item.nextSourceNote
          }
        });
      } catch (error) {
        skipped.push({ id: item.id, reason: error instanceof Error ? error.message : "Product repair failed" });
      }
    }
    for (const item of ingredientPlan) {
      try {
        await prisma.ingredient.update({
          where: { id: item.id },
          data: {
            name: item.nextName,
            category: item.nextCategory,
            supplier: item.nextSupplier,
            comment: item.nextComment
          }
        });
        await prisma.recipeItem.updateMany({ where: { ingredientId: item.id }, data: { ingredientName: item.nextName } });
      } catch (error) {
        skipped.push({ id: item.id, reason: error instanceof Error ? error.message : "Ingredient repair failed" });
      }
    }
  }

  return { plannedProducts: productPlan.length, plannedIngredients: ingredientPlan.length, skipped };
}

async function recalculateRecipes() {
  const recipes = await prisma.recipeItem.findMany({ include: { ingredient: true } });
  const plan = recipes
    .filter((item) => includeManual || item.source !== "USER_PORTION_COST")
    .map((item) => ({
      item,
      cost: calculateRecipeRowCost({
        ingredient: item.ingredient,
        quantity: item.quantity,
        unit: item.unit,
        wastePercent: item.yieldLossPercent,
        manualFinalCost: null
      })
    }))
    .filter(({ cost }) => cost.compatible);

  if (apply) {
    for (const { item } of plan) {
      await prisma.recipeItem.update({
        where: { id: item.id },
        data: {
          unitPurchasePrice: item.ingredient?.purchasePrice ?? null,
          unitMeasure: item.ingredient?.purchaseUnit ?? null,
          costPerUnit: null,
          totalIngredientCost: null,
          source: includeManual ? "IMPORTED_SIMPLE" : item.source || "IMPORTED_SIMPLE"
        }
      });
    }
  }

  return { planned: plan.length, includeManual };
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
