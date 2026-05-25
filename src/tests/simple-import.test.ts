import * as XLSX from "xlsx";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { calculateProductEconomics, calculateRecipeItemCost, calculateStoreModel } from "@/calculations/financial";
import { SIMPLE_EXPORT_COLUMNS, toSimpleIngredientRows, toSimpleMenuRows, toSimpleRecipeRows } from "@/exports/simple";
import { buildModelWorkbook } from "@/exports/workbook";
import {
  calculateSimplePortionCost,
  importSimpleIngredients,
  importSimpleMenu,
  importSimpleRecipes,
  type SimpleImportDb,
  type SimpleIngredientData,
  type SimpleIngredientRecord,
  type SimpleProductData,
  type SimpleProductRecord,
  type SimpleRecipeData,
  type SimpleRecipeRecord
} from "@/imports/simple";
import { calculateModelReadiness } from "@/lib/readiness";
import { calculateFoodCostPercent, calculateRecipeRowCost } from "@/lib/recipe-cost";
import type { ProductInput, StoreInputs } from "@/models/financial";

const store: StoreInputs = {
  workingDaysPerMonth: 30,
  avgOrdersPerDay: 100,
  avgItemsPerOrder: 2,
  avgCheck: 500,
  deliveryShare: 0,
  aggregatorShare: 0,
  acquiringRate: 0,
  aggregatorCommissionRate: 0,
  deliveryLogisticsCostPerOrder: 0,
  marketingCostPerItem: 0,
  ownerWithdrawalsMonthly: 0,
  loanPaymentsMonthly: 0,
  workingCapitalChangeMonthly: 0
};

describe("simple import", () => {
  it("Import simple ingredient creates ingredient", async () => {
    const db = new MemoryImportDb();
    const summary = await importSimpleIngredients([{ ingredient_name: "Говядина", category: "Мясо", purchase_price: 850, purchase_unit: "kg" }], db);

    expect(summary.createdIngredients).toBe(1);
    expect(db.ingredients[0]).toMatchObject({ name: "Говядина", purchasePrice: 850, purchaseUnit: "kg", edibleYieldPercent: 100, storageLossPercent: 0 });
  });

  it("Import simple ingredient updates existing ingredient", async () => {
    const db = new MemoryImportDb();
    await importSimpleIngredients([{ ingredient_name: "Говядина", purchase_price: 800, purchase_unit: "kg" }], db);
    const summary = await importSimpleIngredients([{ ingredient_name: "Говядина", category: "Мясо", supplier: "A", purchase_price: 850, purchase_unit: "kg", comment: "new" }], db);

    expect(summary.updatedIngredients).toBe(1);
    expect(db.ingredients).toHaveLength(1);
    expect(db.ingredients[0]).toMatchObject({ purchasePrice: 850, category: "Мясо", supplier: "A", comment: "new" });
  });

  it("Import simple menu creates SKU", async () => {
    const db = new MemoryImportDb();
    const summary = await importSimpleMenu([{ sku_name: "Бургер Рокки", category: "Бургеры", sale_price: 450 }], db);

    expect(summary.createdSku).toBe(1);
    expect(db.products[0]).toMatchObject({ name: "Бургер Рокки", category: "Бургеры", salePrice: 450 });
  });

  it("Import simple menu updates existing SKU price", async () => {
    const db = new MemoryImportDb();
    await importSimpleMenu([{ sku_name: "Бургер Рокки", category: "Бургеры", sale_price: 450 }], db);
    const summary = await importSimpleMenu([{ sku_name: "Бургер Рокки", category: "Бургеры", sale_price: 490, description: "new" }], db);

    expect(summary.updatedSku).toBe(1);
    expect(db.products).toHaveLength(1);
    expect(db.products[0]).toMatchObject({ salePrice: 490, description: "new" });
  });

  it("Import simple recipe links SKU and ingredient", async () => {
    const db = await dbWithBurgerAndBeef();
    const summary = await importSimpleRecipes([{ sku_name: "Бургер Рокки", ingredient_name: "Говядина", quantity: 120, unit: "g" }], db);

    expect(summary.addedRecipeRows).toBe(1);
    expect(db.recipes[0]).toMatchObject({ productId: db.products[0].id, ingredientId: db.ingredients[0].id, ingredientName: "Говядина" });
  });

  it("Recipe cost kg->g: 850 ₽/kg * 120g = 102 ₽", () => {
    const cost = calculateSimplePortionCost({ purchasePrice: 850, purchaseUnit: "kg", quantity: 120, unit: "g" });
    expect(cost).toEqual({ cost: 102 });
  });

  it("Recipe cost piece->piece: 25 ₽/piece * 1 = 25 ₽", () => {
    const cost = calculateSimplePortionCost({ purchasePrice: 25, purchaseUnit: "piece", quantity: 1, unit: "piece" });
    expect(cost).toEqual({ cost: 25 });
  });

  it("adds waste percent to final ingredient cost", () => {
    const cost = calculateRecipeRowCost({
      ingredient: { name: "Картошка фри", purchasePrice: 155.2, purchaseUnit: "kg" },
      quantity: 100,
      unit: "g",
      wastePercent: 10
    });

    expect(cost.costPerPortion).toBeCloseTo(15.52);
    expect(cost.finalIngredientCost).toBeCloseTo(17.07);
  });

  it("returns null food cost percent when sale price is empty", () => {
    expect(calculateFoodCostPercent(134.8, 0)).toBeNull();
  });

  it("Manual cost_in_portion overrides calculation", async () => {
    const db = await dbWithBurgerAndBeef();
    await importSimpleRecipes([{ sku_name: "Бургер Рокки", ingredient_name: "Говядина", quantity: 120, unit: "g", cost_in_portion: 77 }], db);

    expect(db.recipes[0].totalIngredientCost).toBe(77);
    expect(db.recipes[0].source).toBe("USER_PORTION_COST");
    expect(calculateRecipeItemCost(productFromDb(db).recipes![0])).toBe(77);
  });

  it("Missing SKU returns row error", async () => {
    const db = new MemoryImportDb();
    const summary = await importSimpleRecipes([{ sku_name: "Нет SKU", ingredient_name: "Говядина", quantity: 120, unit: "g", purchase_price: 850, purchase_unit: "kg" }], db);

    expect(summary.errors[0]).toMatchObject({ row_number: 2, type: "recipes", field: "sku_name", message: "SKU not found." });
  });

  it("Missing ingredient without price returns row error", async () => {
    const db = new MemoryImportDb();
    await importSimpleMenu([{ sku_name: "Бургер Рокки", category: "Бургеры", sale_price: 450 }], db);
    const summary = await importSimpleRecipes([{ sku_name: "Бургер Рокки", ingredient_name: "Говядина", quantity: 120, unit: "g" }], db);

    expect(summary.errors[0]).toMatchObject({ row_number: 2, type: "recipes", field: "ingredient_name", message: "Ingredient not found and no purchase price provided." });
  });

  it("Incompatible unit returns row error", async () => {
    const db = await dbWithBurgerAndBeef();
    const summary = await importSimpleRecipes([{ sku_name: "Бургер Рокки", ingredient_name: "Говядина", quantity: 1, unit: "piece" }], db);

    expect(summary.errors[0]).toMatchObject({ row_number: 2, type: "recipes" });
    expect(summary.errors[0].message).toContain("Incompatible units");
  });

  it("recipes import can auto-create ingredient from price/unit", async () => {
    const db = new MemoryImportDb();
    await importSimpleMenu([{ sku_name: "Бургер Рокки", category: "Бургеры", sale_price: 450 }], db);
    const summary = await importSimpleRecipes([{ sku_name: "Бургер Рокки", ingredient_name: "Булочка", quantity: 1, unit: "piece", purchase_price: 25, purchase_unit: "piece" }], db);

    expect(summary.createdIngredientsOnTheFly).toBe(1);
    expect(summary.createdRecipeRows).toBe(1);
    expect(db.ingredients[0]).toMatchObject({ name: "Булочка", purchasePrice: 25, purchaseUnit: "piece" });
    expect(db.recipes[0]).toMatchObject({ ingredientName: "Булочка", source: "IMPORTED_SIMPLE" });
  });

  it("SKU ingredient cost updates after recipe import", async () => {
    const db = await dbWithBurgerAndBeef();
    await importSimpleRecipes([{ sku_name: "Бургер Рокки", ingredient_name: "Говядина", quantity: 120, unit: "g" }], db);

    const economics = calculateProductEconomics(productFromDb(db), store, {}, 0, 0, 6000);
    expect(economics.ingredientCost).toBeCloseTo(102);
    expect(economics.status).not.toBe("missing recipe");
  });

  it("Dashboard readiness updates after recipes filled", async () => {
    const db = await dbWithBurgerAndBeef();
    const emptyProduct = productFromDb(db);
    const beforeEconomics = calculateProductEconomics(emptyProduct, store, {}, 0, 0, 6000);
    await importSimpleRecipes([{ sku_name: "Бургер Рокки", ingredient_name: "Говядина", quantity: 120, unit: "g" }], db);
    const afterProduct = productFromDb(db);
    const afterEconomics = calculateProductEconomics(afterProduct, store, {}, 0, 0, 6000);

    const before = calculateModelReadiness({ products: [emptyProduct], economics: [beforeEconomics], store });
    const after = calculateModelReadiness({ products: [afterProduct], economics: [afterEconomics], store });

    expect(before.items.find((item) => item.label === "Recipes filled")?.done).toBe(0);
    expect(after.items.find((item) => item.label === "Recipes filled")?.done).toBe(1);
    expect(after.score).toBeGreaterThan(before.score);
  });

  it("Export contains Simple Recipes sheet", () => {
    const product: ProductInput = {
      id: "sku-1",
      category: "Бургеры",
      name: "Бургер Рокки",
      salePrice: 450,
      recipes: [{ ingredientName: "Говядина", quantity: 120, unit: "g", ingredient: { name: "Говядина", purchasePrice: 850, purchaseUnit: "kg" } }],
      packagingLinks: []
    };
    const buffer = buildModelWorkbook({
      economics: [calculateProductEconomics(product, store, {}, 0, 0, 6000)],
      products: [{ id: product.id, category: product.category, name: product.name, salePrice: product.salePrice, isActive: true }],
      recipes: [{ productName: product.name, ingredientName: "Говядина", quantity: 120, unit: "g", purchasePrice: 850, purchaseUnit: "kg", comment: "Цена за кг" }],
      ingredients: [{ name: "Говядина", category: "Мясо", purchasePrice: 850, purchaseUnit: "kg" }],
      packaging: [],
      productPackaging: [],
      model: calculateStoreModel([product], store, [], [], {}),
      checks: [],
      capex: [],
      opex: [],
      assumptions: [],
      inputUnits: [],
      chartsData: []
    });

    const workbook = XLSX.read(buffer);
    expect(workbook.SheetNames).toContain("Simple Recipes");
  });

  it("menu import summary returns created/updated/errors", async () => {
    const db = new MemoryImportDb();
    await importSimpleMenu([{ sku_name: "Бургер Рокки", category: "Бургеры", sale_price: 450 }], db);
    const summary = await importSimpleMenu([
      { sku_name: "Бургер Рокки", category: "Бургеры", sale_price: 490 },
      { sku_name: "", category: "Бургеры", sale_price: 100 }
    ], db);

    expect(summary.createdSku).toBe(0);
    expect(summary.updatedSku).toBe(1);
    expect(summary.errors).toHaveLength(1);
    expect(summary.errors[0]).toMatchObject({ field: "sku_name" });
  });

  it("ingredients import summary returns created/updated/errors", async () => {
    const db = new MemoryImportDb();
    await importSimpleIngredients([{ ingredient_name: "Говядина", purchase_price: 800, purchase_unit: "kg" }], db);
    const summary = await importSimpleIngredients([
      { ingredient_name: "Говядина", purchase_price: 850, purchase_unit: "kg" },
      { ingredient_name: "Булочка", purchase_price: 25, purchase_unit: "piece" },
      { ingredient_name: "Соус", purchase_price: 10, purchase_unit: "pcs" }
    ], db);

    expect(summary.createdIngredients).toBe(1);
    expect(summary.updatedIngredients).toBe(1);
    expect(summary.errors).toHaveLength(1);
    expect(summary.errors[0]).toMatchObject({ field: "purchase_unit" });
  });

  it("recipes import summary returns created/updated/errors", async () => {
    const db = await dbWithBurgerAndBeef();
    await importSimpleRecipes([{ sku_name: "Бургер Рокки", ingredient_name: "Говядина", quantity: 120, unit: "g" }], db);
    const summary = await importSimpleRecipes([
      { sku_name: "Бургер Рокки", ingredient_name: "Говядина", quantity: 130, unit: "g" },
      { sku_name: "Бургер Рокки", ingredient_name: "Булочка", quantity: 1, unit: "piece", purchase_price: 25, purchase_unit: "piece" },
      { sku_name: "Бургер Рокки", ingredient_name: "Соус", quantity: 1, unit: "pcs", purchase_price: 10, purchase_unit: "piece" }
    ], db);

    expect(summary.createdRecipeRows).toBe(1);
    expect(summary.updatedRecipeRows).toBe(1);
    expect(summary.errors).toHaveLength(1);
    expect(summary.errors[0]).toMatchObject({ field: "unit" });
  });

  it("export menu returns simple schema", () => {
    const rows = toSimpleMenuRows([{ name: "Бургер Рокки", category: "Бургеры", salePrice: 450, description: "Описание", id: "sku-1" }]);

    expect(Object.keys(rows[0])).toEqual(SIMPLE_EXPORT_COLUMNS.menu);
    expect(rows[0]).toEqual({ sku_name: "Бургер Рокки", category: "Бургеры", sale_price: 450, description: "Описание" });
  });

  it("export ingredients returns simple schema", () => {
    const rows = toSimpleIngredientRows([{ name: "Говядина", category: "Мясо", purchasePrice: 850, purchaseUnit: "kg", supplier: "A" }]);

    expect(Object.keys(rows[0])).toEqual(SIMPLE_EXPORT_COLUMNS.ingredients);
    expect(rows[0]).toEqual({ ingredient_name: "Говядина", category: "Мясо", purchase_price: 850, purchase_unit: "kg" });
  });

  it("export recipes returns simple schema", () => {
    const rows = toSimpleRecipeRows([{ productName: "Бургер Рокки", ingredientName: "Говядина", quantity: 120, unit: "g", purchasePrice: 850, purchaseUnit: "kg", source: "IMPORTED_SIMPLE" }]);

    expect(Object.keys(rows[0])).toEqual(SIMPLE_EXPORT_COLUMNS.recipes);
    expect(rows[0]).toEqual({ sku_name: "Бургер Рокки", ingredient_name: "Говядина", quantity: 120, unit: "g", purchase_price: 850, purchase_unit: "kg", cost_in_portion: "" });
  });

  it("/import page shows only Menu / Ingredients / Recipes import cards", () => {
    const source = readFileSync("src/pages/import.tsx", "utf8");

    expect(source).toContain('title: "Menu"');
    expect(source).toContain('title: "Ingredients"');
    expect(source).toContain('title: "Recipes"');
    expect(source).not.toContain("advancedImports");
    expect(source).not.toContain("Advanced import");
  });

  it("/import page does not show CAPEX/OPEX/tax import", () => {
    const source = readFileSync("src/pages/import.tsx", "utf8");

    expect(source).not.toContain("CAPEX");
    expect(source).not.toContain("OPEX");
    expect(source).not.toContain("Tax assumptions");
    expect(source).not.toContain("Export full model");
  });

  it("import summary does not show 0 rows after successful import", () => {
    const source = readFileSync("src/pages/import.tsx", "utf8");

    expect(source).not.toContain("Импортировано строк");
    expect(source).not.toContain("0 rows");
  });
});

async function dbWithBurgerAndBeef() {
  const db = new MemoryImportDb();
  await importSimpleMenu([{ sku_name: "Бургер Рокки", category: "Бургеры", sale_price: 450 }], db);
  await importSimpleIngredients([{ ingredient_name: "Говядина", category: "Мясо", purchase_price: 850, purchase_unit: "kg" }], db);
  return db;
}

function productFromDb(db: MemoryImportDb): ProductInput {
  const product = db.products[0];
  return {
    id: product.id,
    category: product.category,
    name: product.name,
    salePrice: product.salePrice ?? 0,
    isActive: true,
    recipes: db.recipes.filter((recipe) => recipe.productId === product.id).map((recipe) => ({
      ...recipe,
      ingredient: db.ingredients.find((ingredient) => ingredient.id === recipe.ingredientId) ?? null
    })),
    packagingLinks: []
  };
}

class MemoryImportDb implements SimpleImportDb {
  products: Array<SimpleProductRecord & Partial<SimpleProductData>> = [];
  ingredients: Array<SimpleIngredientRecord & Partial<SimpleIngredientData>> = [];
  recipes: Array<SimpleRecipeRecord & SimpleRecipeData> = [];
  private nextId = 1;

  async findProductByNameCategory(name: string, category: string) {
    return this.products.find((product) => product.name === name && product.category === category) ?? null;
  }

  async findProductByName(name: string) {
    return this.products.find((product) => product.name === name) ?? null;
  }

  async createProduct(data: SimpleProductData) {
    const product = { id: this.id("sku"), ...data };
    this.products.push(product);
    return product;
  }

  async updateProduct(id: string, data: SimpleProductData) {
    const index = this.products.findIndex((product) => product.id === id);
    this.products[index] = { ...this.products[index], ...data };
    return this.products[index];
  }

  async findIngredientByName(name: string) {
    return this.ingredients.find((ingredient) => ingredient.name === name) ?? null;
  }

  async createIngredient(data: SimpleIngredientData) {
    const ingredient = { id: this.id("ing"), ...data };
    this.ingredients.push(ingredient);
    return ingredient;
  }

  async updateIngredient(id: string, data: SimpleIngredientData) {
    const index = this.ingredients.findIndex((ingredient) => ingredient.id === id);
    this.ingredients[index] = { ...this.ingredients[index], ...data };
    return this.ingredients[index];
  }

  async findRecipeItem(productId: string, ingredientId: string | null, ingredientName: string) {
    return this.recipes.find((recipe) => recipe.productId === productId && (recipe.ingredientId === ingredientId || recipe.ingredientName === ingredientName)) ?? null;
  }

  async createRecipeItem(data: SimpleRecipeData) {
    const recipe = { id: this.id("recipe"), ...data };
    this.recipes.push(recipe);
    return recipe;
  }

  async updateRecipeItem(id: string, data: SimpleRecipeData) {
    const index = this.recipes.findIndex((recipe) => recipe.id === id);
    this.recipes[index] = { ...this.recipes[index], ...data };
    return this.recipes[index];
  }

  private id(prefix: string) {
    const id = `${prefix}-${this.nextId}`;
    this.nextId += 1;
    return id;
  }
}
