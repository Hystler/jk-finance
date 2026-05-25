import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/db";
import { calculateRecipeRowCost } from "@/lib/recipe-cost";
import { findDuplicateIngredientGroups, findDuplicateSkuGroups, isBrokenImportedName, repairImportedName } from "@/lib/import-repair";

type AdminAction = "audit" | "repair-imported-names" | "merge-duplicate-sku" | "recalculate-recipe-costs";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isAuthorized(req)) return res.status(403).json({ error: "Admin repair token required." });

  if (req.method === "GET") return res.json(await auditImports());
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const action = String(req.body.action ?? "audit") as AdminAction;
  const apply = req.body.apply === true;

  if (action === "audit") return res.json(await auditImports());
  if (action === "repair-imported-names") return res.json(await repairImportedNames(apply));
  if (action === "merge-duplicate-sku") return res.json(await mergeDuplicateSku(apply));
  if (action === "recalculate-recipe-costs") return res.json(await recalculateRecipeCosts(apply));
  return res.status(400).json({ error: "Unknown admin import repair action." });
}

function isAuthorized(req: NextApiRequest) {
  if (process.env.NODE_ENV !== "production") return true;
  const token = process.env.ADMIN_REPAIR_TOKEN;
  if (!token) return false;
  return req.headers["x-admin-repair-token"] === token || req.query.token === token;
}

async function auditImports() {
  const [products, ingredients] = await Promise.all([
    prisma.product.findMany({ include: { recipes: true, packagingLinks: true }, orderBy: [{ category: "asc" }, { name: "asc" }] }),
    prisma.ingredient.findMany({ orderBy: { name: "asc" } })
  ]);
  const duplicateGroups = findDuplicateSkuGroups(products);
  const duplicateIngredientGroups = findDuplicateIngredientGroups(ingredients);
  return {
    duplicateSkuGroups: duplicateGroups.map((group) => ({
      key: group.key,
      canonical: pickProduct(group.canonical),
      duplicates: group.duplicates.map(pickProduct)
    })),
    brokenSkuNames: products.filter((product) => isBrokenImportedName(product.name) || isBrokenImportedName(product.category)).map(pickProduct),
    brokenIngredientNames: ingredients.filter((ingredient) => isBrokenImportedName(ingredient.name) || isBrokenImportedName(ingredient.category)).map((ingredient) => ({
      id: ingredient.id,
      name: ingredient.name,
      category: ingredient.category,
      repairedName: repairImportedName(ingredient.name),
      repairedCategory: repairImportedName(ingredient.category ?? "")
    })),
    duplicateIngredientGroups: duplicateIngredientGroups.map((group) => ({
      key: group.key,
      canonical: {
        id: group.canonical.id,
        name: group.canonical.name,
        category: group.canonical.category
      },
      duplicates: group.duplicates.map((ingredient) => ({
        id: ingredient.id,
        name: ingredient.name,
        category: ingredient.category,
        repairedName: repairImportedName(ingredient.name)
      }))
    }))
  };
}

async function repairImportedNames(apply: boolean) {
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

  if (apply) {
    for (const item of productPlan) {
        await prisma.product.update({
          where: { id: item.id },
          data: {
            name: item.nextName,
            category: item.nextCategory,
            description: item.nextDescription,
            sourceNote: item.nextSourceNote
          }
        });
    }
    for (const item of ingredientPlan) {
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
    }
  }

  return { apply, repairedProducts: productPlan.length, repairedIngredients: ingredientPlan.length, productPlan, ingredientPlan };
}

async function mergeDuplicateSku(apply: boolean) {
  const products = await prisma.product.findMany({ include: { recipes: true, packagingLinks: true } });
  const groups = findDuplicateSkuGroups(products);
  const plan = groups.flatMap((group) => group.duplicates.map((duplicate) => ({
    from: pickProduct(duplicate),
    to: pickProduct(group.canonical)
  })));

  const ingredientGroups = findDuplicateIngredientGroups(await prisma.ingredient.findMany({ include: { recipes: true } }));
  const ingredientPlan = ingredientGroups.flatMap((group) => group.duplicates.map((duplicate) => ({
    from: { id: duplicate.id, name: duplicate.name },
    to: { id: group.canonical.id, name: group.canonical.name }
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
    for (const group of ingredientGroups) {
      for (const duplicate of group.duplicates) {
        await prisma.recipeItem.updateMany({
          where: { ingredientId: duplicate.id },
          data: { ingredientId: group.canonical.id, ingredientName: group.canonical.name }
        });
        await prisma.ingredient.delete({ where: { id: duplicate.id } });
      }
    }
  }

  return { apply, merged: plan.length, mergedIngredients: ingredientPlan.length, plan, ingredientPlan };
}

async function recalculateRecipeCosts(apply: boolean) {
  const recipes = await prisma.recipeItem.findMany({ include: { ingredient: true } });
  const plan = recipes
    .filter((item) => item.source !== "USER_PORTION_COST")
    .map((item) => {
      const cost = calculateRecipeRowCost({
        ingredient: item.ingredient,
        quantity: item.quantity,
        unit: item.unit,
        wastePercent: item.yieldLossPercent,
        manualFinalCost: null
      });
      return { item, cost };
    })
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
          source: item.source === "USER_PORTION_COST" ? item.source : item.source || "IMPORTED_SIMPLE"
        }
      });
    }
  }

  return { apply, recalculatedRecipeRows: plan.length };
}

function pickProduct(product: { id: string; name: string; category: string; salePrice?: number | null }) {
  return {
    id: product.id,
    name: product.name,
    category: product.category,
    salePrice: product.salePrice,
    repairedName: repairImportedName(product.name),
    repairedCategory: repairImportedName(product.category)
  };
}
