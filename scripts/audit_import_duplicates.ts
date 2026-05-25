import { prisma } from "../src/lib/db";
import { findDuplicateSkuGroups, isBrokenImportedName, repairImportedName } from "../src/lib/import-repair";

async function main() {
  const products = await prisma.product.findMany({
    include: { recipes: true, packagingLinks: true },
    orderBy: [{ category: "asc" }, { name: "asc" }]
  });
  const ingredients = await prisma.ingredient.findMany({ orderBy: { name: "asc" } });
  const duplicateGroups = findDuplicateSkuGroups(products);

  console.log(JSON.stringify({
    duplicateSkuGroups: duplicateGroups.map((group) => ({
      key: group.key,
      keep: {
        id: group.canonical.id,
        category: group.canonical.category,
        name: group.canonical.name,
        salePrice: group.canonical.salePrice
      },
      mergeOrDelete: group.duplicates.map((item) => ({
        id: item.id,
        category: item.category,
        name: item.name,
        salePrice: item.salePrice,
        repairedCategory: repairImportedName(item.category),
        repairedName: repairImportedName(item.name)
      }))
    })),
    brokenSkuNames: products
      .filter((item) => isBrokenImportedName(item.name) || isBrokenImportedName(item.category))
      .map((item) => ({
        id: item.id,
        category: item.category,
        name: item.name,
        repairedCategory: repairImportedName(item.category),
        repairedName: repairImportedName(item.name)
      })),
    brokenIngredientNames: ingredients
      .filter((item) => isBrokenImportedName(item.name) || isBrokenImportedName(item.category))
      .map((item) => ({
        id: item.id,
        category: item.category,
        name: item.name,
        repairedCategory: repairImportedName(item.category ?? ""),
        repairedName: repairImportedName(item.name)
      }))
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
