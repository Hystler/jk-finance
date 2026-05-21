import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import * as XLSX from "xlsx";
import { prisma } from "../src/lib/db";

const file = process.argv[2];
if (!file) {
  console.error("Usage: npm run tsx scripts/import_menu.ts -- ./menu.xlsx");
  process.exit(1);
}

const workbook = XLSX.read(fs.readFileSync(path.resolve(file)));
const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });

const text = (value: unknown) => String(value ?? "").trim();
const num = (value: unknown) => {
  const n = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const stableId = (prefix: string, value: string) => `${prefix}-${createHash("sha1").update(value).digest("hex").slice(0, 16)}`;

async function main() {
  let count = 0;
  for (const row of rows) {
    const name = text(row.name ?? row.Name ?? row["Название"]);
    if (!name) continue;
    const category = text(row.category) || "Uncategorized";
    const productUrl = text(row.product_url ?? row.productUrl) || null;
    const id = text(row.id) || stableId("menu", productUrl ?? `${category}:${name}`);
    const data = {
      category,
      name,
      description: text(row.description),
      salePrice: num(row.sale_price ?? row.salePrice ?? row.price),
      imageUrl: text(row.image_url ?? row.imageUrl),
      productUrl,
      source: text(row.source) === "IMPORTED_MENU" ? "IMPORTED_MENU" : "MANUAL"
    };
    await prisma.product.upsert({
      where: productUrl ? { productUrl } : { category_name: { category, name } },
      create: { id, ...data },
      update: data
    });
    count += 1;
  }
  console.log(`Imported ${count} menu rows`);
}

main().finally(() => prisma.$disconnect());
