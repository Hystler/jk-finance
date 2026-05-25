import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { prisma } from "../src/lib/db";

type MenuRow = {
  id?: string;
  category?: string;
  name?: string;
  description?: string;
  sale_price?: number | string;
  salePrice?: number | string;
  image_url?: string;
  imageUrl?: string;
  product_url?: string;
  productUrl?: string;
  is_active?: boolean | string;
  isActive?: boolean | string;
  tax_rate?: number | string;
  taxRate?: number | string;
  delivery_available?: boolean | string;
  deliveryAvailable?: boolean | string;
  source?: string;
  source_note?: string;
  sourceNote?: string;
};

const menuPath = path.join(process.cwd(), "public", "scrape_artifacts", "scraped_menu.json");

const text = (value: unknown) => String(value ?? "").trim();
const numberOrNull = (value: unknown) => {
  const raw = text(value);
  if (!raw) return null;
  const parsed = Number(raw.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
};
const money = (value: unknown) => numberOrNull(value) ?? 0;
const bool = (value: unknown, fallback: boolean) => {
  if (typeof value === "boolean") return value;
  const raw = text(value).toLowerCase();
  if (!raw) return fallback;
  return ["true", "1", "yes", "on", "да"].includes(raw);
};
const stableId = (prefix: string, value: string) => `${prefix}-${createHash("sha1").update(value).digest("hex").slice(0, 16)}`;

async function seedSettings() {
  await prisma.storeInput.upsert({
    where: { id: "default-store" },
    create: {
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
      deliveryLogisticsCostPerOrder: 0,
      marketingCostPerItem: 0,
      ownerWithdrawalsMonthly: 0,
      loanPaymentsMonthly: 0,
      workingCapitalChangeMonthly: 0,
      source: "ASSUMPTION"
    },
    update: {}
  });

  await prisma.taxSettings.upsert({
    where: { id: "default-tax" },
    create: {
      id: "default-tax",
      taxSystem: "editable assumption",
      otherTaxes: 0,
      source: "ASSUMPTION"
    },
    update: {}
  });

  await prisma.franchiseSettings.upsert({
    where: { id: "default-franchise" },
    create: {
      id: "default-franchise",
      source: "ASSUMPTION"
    },
    update: {}
  });

  await prisma.assumption.upsert({
    where: { id: "seed-default-settings-note" },
    create: {
      id: "seed-default-settings-note",
      entityType: "Settings",
      entityId: "default-store",
      field: "initialValues",
      value: "0",
      source: "ASSUMPTION",
      note: "Seed creates empty editable assumptions only. Replace traffic, tax, CAPEX, OPEX, recipes and purchase costs with verified data."
    },
    update: {}
  });
}

function readMenuRows() {
  if (!fs.existsSync(menuPath)) return [];
  const parsed = JSON.parse(fs.readFileSync(menuPath, "utf8"));
  return Array.isArray(parsed) ? parsed as MenuRow[] : [];
}

async function seedMenu() {
  const rows = readMenuRows();
  let imported = 0;

  for (const row of rows) {
    const name = text(row.name);
    const category = text(row.category) || "Без категории";
    if (!name) continue;

    const productUrl = text(row.product_url ?? row.productUrl) || null;
    const id = text(row.id) || stableId("menu", productUrl ?? `${category}:${name}`);
    const data = {
      category,
      name,
      description: text(row.description) || null,
      salePrice: money(row.sale_price ?? row.salePrice),
      imageUrl: text(row.image_url ?? row.imageUrl) || null,
      productUrl,
      isActive: bool(row.is_active ?? row.isActive, true),
      taxRate: numberOrNull(row.tax_rate ?? row.taxRate),
      deliveryAvailable: bool(row.delivery_available ?? row.deliveryAvailable, true),
      source: text(row.source) || "IMPORTED_MENU",
      sourceNote: text(row.source_note ?? row.sourceNote) || "Imported from scraped public menu JSON; verify manually before financial decisions."
    };

    await prisma.product.upsert({
      where: productUrl ? { productUrl } : { category_name: { category, name } },
      create: { id, ...data },
      update: data
    });
    imported += 1;
  }

  return imported;
}

async function seedRecipeBuilderTestData() {
  const skuRows = [
    ["Бургер классический белый", "Бургеры", 350],
    ["Бургер классический черный", "Бургеры", 370],
    ["Шаурма с курицей", "Шаурма", 320],
    ["Шаурма с говядиной", "Шаурма", 430],
    ["Хот-дог классический", "Хот-доги", 250],
    ["БоксФуд курица", "Боксы", 390],
    ["АйдахоБокс курица", "Боксы", 410]
  ] as const;
  const ingredientRows = [
    ["Котлета", "Мясо", 68.8, "piece"],
    ["Булочка белая", "Хлеб", 31, "piece"],
    ["Булочка черная", "Хлеб", 44, "piece"],
    ["Ломтик сыра", "Сыр", 10, "piece"],
    ["Овощи бургер", "Овощи", 15, "piece"],
    ["Соус", "Соусы", 10, "piece"],
    ["Лаваш", "Хлеб", 9, "piece"],
    ["Курица 90 г", "Мясо", 50, "piece"],
    ["Говядина 90 г", "Мясо", 139, "piece"],
    ["Свинина 90 г", "Мясо", 60.6, "piece"],
    ["Картошка фри", "Гарниры", 155.2, "kg"],
    ["Бекон 20 г", "Мясо", 10, "piece"]
  ] as const;

  for (const [name, category, salePrice] of skuRows) {
    await prisma.product.upsert({
      where: { category_name: { category, name } },
      create: {
        id: stableId("menu", `${category}:${name}`),
        category,
        name,
        salePrice,
        isActive: true,
        source: "ASSUMPTION",
        sourceNote: "Recipe builder test SKU"
      },
      update: {}
    });
  }

  for (const [name, category, purchasePrice, purchaseUnit] of ingredientRows) {
    await prisma.ingredient.upsert({
      where: { name },
      create: {
        name,
        category,
        purchasePrice,
        purchaseUnit,
        edibleYieldPercent: 100,
        storageLossPercent: 0,
        source: "ASSUMPTION",
        comment: "Recipe builder test ingredient"
      },
      update: {}
    });
  }
}

async function main() {
  await seedSettings();
  const imported = await seedMenu();
  await seedRecipeBuilderTestData();
  console.log(`Seed complete. Imported or updated ${imported} menu SKU rows and ensured recipe builder test SKU/ingredients.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
