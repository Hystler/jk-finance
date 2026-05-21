export function truncateSkuName(name: string, max = 22) {
  return name.length <= max ? name : `${name.slice(0, Math.max(0, max - 1))}…`;
}

export function buildSkuMarginRanking<T extends { name: string; ingredientCost: number; packagingCost: number; contributionMargin: number }>(economics: T[]) {
  return economics
    .filter((sku) => sku.ingredientCost > 0 || sku.packagingCost > 0)
    .sort((a, b) => b.contributionMargin - a.contributionMargin)
    .slice(0, 10)
    .map((sku) => ({ ...sku, shortName: truncateSkuName(sku.name, 22), fullName: sku.name }));
}
