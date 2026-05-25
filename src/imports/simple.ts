export const SIMPLE_UNITS = ["kg", "g", "liter", "ml", "piece"] as const;

export type SimpleUnit = (typeof SIMPLE_UNITS)[number];

export type ImportRowIssue = {
  row_number: number;
  type: "menu" | "ingredients" | "recipes";
  field: string;
  message: string;
  raw_value: string;
};

export type ImportWarning = ImportRowIssue;

export type SimpleImportSummary = {
  createdSku: number;
  updatedSku: number;
  createdIngredients: number;
  createdIngredientsOnTheFly: number;
  updatedIngredients: number;
  addedRecipeRows: number;
  createdRecipeRows: number;
  updatedRecipeRows: number;
  errors: ImportRowIssue[];
  warnings: ImportWarning[];
};

export type SimpleProductRecord = {
  id: string;
  name: string;
  category: string;
  salePrice?: number | null;
};

export type SimpleIngredientRecord = {
  id: string;
  name: string;
  purchasePrice: number;
  purchaseUnit: string;
  category?: string | null;
  supplier?: string | null;
  edibleYieldPercent?: number | null;
  storageLossPercent?: number | null;
  comment?: string | null;
};

export type SimpleRecipeRecord = {
  id: string;
  productId: string;
  ingredientId?: string | null;
  ingredientName: string;
};

export type SimpleImportDb = {
  findProductByNameCategory(name: string, category: string): Promise<SimpleProductRecord | null>;
  findProductByName(name: string): Promise<SimpleProductRecord | null>;
  createProduct(data: SimpleProductData): Promise<SimpleProductRecord>;
  updateProduct(id: string, data: SimpleProductData): Promise<SimpleProductRecord>;
  findIngredientByName(name: string): Promise<SimpleIngredientRecord | null>;
  createIngredient(data: SimpleIngredientData): Promise<SimpleIngredientRecord>;
  updateIngredient(id: string, data: SimpleIngredientData): Promise<SimpleIngredientRecord>;
  findRecipeItem(productId: string, ingredientId: string | null, ingredientName: string): Promise<SimpleRecipeRecord | null>;
  createRecipeItem(data: SimpleRecipeData): Promise<SimpleRecipeRecord>;
  updateRecipeItem(id: string, data: SimpleRecipeData): Promise<SimpleRecipeRecord>;
};

export type SimpleProductData = {
  category: string;
  name: string;
  description: string | null;
  salePrice: number;
  imageUrl: string | null;
  productUrl: string | null;
  isActive: boolean;
  source: "IMPORTED_SIMPLE";
};

export type SimpleIngredientData = {
  name: string;
  category: string | null;
  supplier: string | null;
  purchasePrice: number;
  purchaseUnit: SimpleUnit;
  edibleYieldPercent: number;
  storageLossPercent: number;
  comment: string | null;
  source: "IMPORTED_SIMPLE";
};

export type SimpleRecipeData = {
  productId: string;
  ingredientId: string | null;
  ingredientName: string;
  quantity: number;
  unit: SimpleUnit;
  grossWeightGrams: null;
  netWeightGrams: null;
  yieldLossPercent: null;
  unitPurchasePrice: number | null;
  unitMeasure: SimpleUnit | null;
  costPerUnit: null;
  totalIngredientCost: number | null;
  comment: string | null;
  source: "IMPORTED_SIMPLE" | "USER_PORTION_COST";
};

type UnitGroup = "mass" | "volume" | "piece";

export const createEmptySimpleSummary = (): SimpleImportSummary => ({
  createdSku: 0,
  updatedSku: 0,
  createdIngredients: 0,
  createdIngredientsOnTheFly: 0,
  updatedIngredients: 0,
  addedRecipeRows: 0,
  createdRecipeRows: 0,
  updatedRecipeRows: 0,
  errors: [],
  warnings: []
});

export const text = (value: unknown) => String(value ?? "").trim();

export function parseOptionalNumber(value: unknown): number | null {
  const raw = text(value);
  if (!raw) return null;
  const normalized = raw.replace(/\s/g, "").replace("₽", "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseRequiredNumber(value: unknown): number | null {
  return parseOptionalNumber(value);
}

export function parseBool(value: unknown, fallback = true) {
  if (typeof value === "boolean") return value;
  const raw = text(value).toLowerCase();
  if (!raw) return fallback;
  return ["true", "1", "yes", "on", "да"].includes(raw);
}

export function normalizeSimpleUnit(value: unknown): SimpleUnit | null {
  const raw = text(value).toLowerCase();
  return SIMPLE_UNITS.includes(raw as SimpleUnit) ? raw as SimpleUnit : null;
}

export function calculateSimplePortionCost(input: {
  quantity: number;
  unit: SimpleUnit;
  purchasePrice: number;
  purchaseUnit: SimpleUnit;
}): { cost: number } | { error: string } {
  const quantityUnit = unitInfo(input.unit);
  const purchaseUnit = unitInfo(input.purchaseUnit);
  if (quantityUnit.group !== purchaseUnit.group) {
    return { error: `Incompatible units: ${input.purchaseUnit} -> ${input.unit}.` };
  }
  const pricePerBaseUnit = input.purchasePrice / purchaseUnit.baseFactor;
  const quantityInBaseUnit = input.quantity * quantityUnit.baseFactor;
  return { cost: pricePerBaseUnit * quantityInBaseUnit };
}

export async function importSimpleIngredients(rows: Array<Record<string, unknown>>, db: SimpleImportDb) {
  const summary = createEmptySimpleSummary();

  for (const [index, row] of rows.entries()) {
    if (isBlankRow(row)) continue;
    const rowNumber = index + 2;
    const name = text(row.ingredient_name ?? row.name);
    const purchasePrice = parseRequiredNumber(row.purchase_price ?? row.purchasePrice);
    const purchaseUnit = normalizeSimpleUnit(row.purchase_unit ?? row.purchaseUnit);

    if (!name) {
      addError(summary, rowNumber, "ingredients", "ingredient_name", "ingredient_name is required.", row.ingredient_name ?? row.name);
      continue;
    }
    if (purchasePrice == null || purchasePrice < 0) {
      addError(summary, rowNumber, "ingredients", "purchase_price", "purchase_price is required and must be >= 0.", row.purchase_price ?? row.purchasePrice);
      continue;
    }
    if (!purchaseUnit) {
      addError(summary, rowNumber, "ingredients", "purchase_unit", `Unsupported unit "${text(row.purchase_unit ?? row.purchaseUnit)}". Use kg, g, liter, ml, or piece.`, row.purchase_unit ?? row.purchaseUnit);
      continue;
    }

    const data: SimpleIngredientData = {
      name,
      category: text(row.category) || null,
      supplier: text(row.supplier) || null,
      purchasePrice,
      purchaseUnit,
      edibleYieldPercent: 100,
      storageLossPercent: 0,
      comment: text(row.comment) || null,
      source: "IMPORTED_SIMPLE"
    };
    const existing = await db.findIngredientByName(name);
    if (existing) {
      await db.updateIngredient(existing.id, data);
      summary.updatedIngredients += 1;
    } else {
      await db.createIngredient(data);
      summary.createdIngredients += 1;
    }
  }

  return summary;
}

export async function importSimpleMenu(rows: Array<Record<string, unknown>>, db: SimpleImportDb) {
  const summary = createEmptySimpleSummary();

  for (const [index, row] of rows.entries()) {
    if (isBlankRow(row)) continue;
    const rowNumber = index + 2;
    const name = text(row.sku_name ?? row.name);
    const category = text(row.category);
    const salePrice = parseRequiredNumber(row.sale_price ?? row.salePrice ?? row.price);

    if (!name) {
      addError(summary, rowNumber, "menu", "sku_name", "sku_name is required.", row.sku_name ?? row.name);
      continue;
    }
    if (!category) {
      addError(summary, rowNumber, "menu", "category", "category is required.", row.category);
      continue;
    }
    if (salePrice == null || salePrice <= 0) {
      addError(summary, rowNumber, "menu", "sale_price", "sale_price is required and must be > 0.", row.sale_price ?? row.salePrice ?? row.price);
      continue;
    }

    const data: SimpleProductData = {
      category,
      name,
      description: text(row.description) || null,
      salePrice,
      imageUrl: text(row.image_url ?? row.imageUrl) || null,
      productUrl: text(row.product_url ?? row.productUrl) || null,
      isActive: parseBool(row.is_active ?? row.isActive, true),
      source: "IMPORTED_SIMPLE"
    };
    const existing = await db.findProductByNameCategory(name, category);
    if (existing) {
      await db.updateProduct(existing.id, data);
      summary.updatedSku += 1;
    } else {
      await db.createProduct(data);
      summary.createdSku += 1;
    }
  }

  return summary;
}

export async function importSimpleRecipes(rows: Array<Record<string, unknown>>, db: SimpleImportDb) {
  const summary = createEmptySimpleSummary();

  for (const [index, row] of rows.entries()) {
    if (isBlankRow(row)) continue;
    const rowNumber = index + 2;
    const skuName = text(row.sku_name ?? row.product_name ?? row.productName);
    const ingredientName = text(row.ingredient_name ?? row.ingredientName);
    const quantity = parseRequiredNumber(row.quantity);
    const unit = normalizeSimpleUnit(row.unit);
    const purchasePriceFromRow = parseOptionalNumber(row.purchase_price ?? row.purchasePrice);
    const purchaseUnitRaw = row.purchase_unit ?? row.purchaseUnit;
    const purchaseUnitFromRow = normalizeSimpleUnit(purchaseUnitRaw);
    const manualCost = parseOptionalNumber(row.cost_in_portion ?? row.costInPortion);

    if (!skuName) {
      addError(summary, rowNumber, "recipes", "sku_name", "sku_name is required.", row.sku_name ?? row.product_name);
      continue;
    }
    if (!ingredientName) {
      addError(summary, rowNumber, "recipes", "ingredient_name", "ingredient_name is required.", row.ingredient_name ?? row.ingredientName);
      continue;
    }
    if (quantity == null || quantity <= 0) {
      addError(summary, rowNumber, "recipes", "quantity", "quantity is required and must be > 0.", row.quantity);
      continue;
    }
    if (!unit) {
      addError(summary, rowNumber, "recipes", "unit", `Unsupported unit "${text(row.unit)}". Use kg, g, liter, ml, or piece.`, row.unit);
      continue;
    }
    if (manualCost != null && manualCost < 0) {
      addError(summary, rowNumber, "recipes", "cost_in_portion", "cost_in_portion must be >= 0.", row.cost_in_portion ?? row.costInPortion);
      continue;
    }
    if (purchasePriceFromRow != null && purchasePriceFromRow < 0) {
      addError(summary, rowNumber, "recipes", "purchase_price", "purchase_price must be >= 0.", row.purchase_price ?? row.purchasePrice);
      continue;
    }
    if (text(purchaseUnitRaw) && !purchaseUnitFromRow) {
      addError(summary, rowNumber, "recipes", "purchase_unit", `Unsupported unit "${text(purchaseUnitRaw)}". Use kg, g, liter, ml, or piece.`, purchaseUnitRaw);
      continue;
    }

    const product = await db.findProductByName(skuName);
    if (!product) {
      addError(summary, rowNumber, "recipes", "sku_name", "SKU not found.", skuName);
      continue;
    }

    let ingredient = await db.findIngredientByName(ingredientName);
    if (!ingredient) {
      if (purchasePriceFromRow == null) {
        addError(summary, rowNumber, "recipes", "ingredient_name", "Ingredient not found and no purchase price provided.", ingredientName);
        continue;
      }
      if (!purchaseUnitFromRow) {
        addError(summary, rowNumber, "recipes", "purchase_unit", "Ingredient not found and no purchase unit provided.", ingredientName);
        continue;
      }
      ingredient = await db.createIngredient({
        name: ingredientName,
        category: null,
        supplier: null,
        purchasePrice: purchasePriceFromRow,
        purchaseUnit: purchaseUnitFromRow,
        edibleYieldPercent: 100,
        storageLossPercent: 0,
        comment: null,
        source: "IMPORTED_SIMPLE"
      });
      summary.createdIngredients += 1;
      summary.createdIngredientsOnTheFly += 1;
    } else if (purchasePriceFromRow != null || purchaseUnitFromRow) {
      const nextPurchasePrice = purchasePriceFromRow ?? ingredient.purchasePrice;
      const nextPurchaseUnit = purchaseUnitFromRow ?? normalizeSimpleUnit(ingredient.purchaseUnit) ?? "kg";
      ingredient = await db.updateIngredient(ingredient.id, {
        name: ingredient.name,
        category: ingredient.category ?? null,
        supplier: ingredient.supplier ?? null,
        purchasePrice: nextPurchasePrice,
        purchaseUnit: nextPurchaseUnit,
        edibleYieldPercent: ingredient.edibleYieldPercent ?? 100,
        storageLossPercent: ingredient.storageLossPercent ?? 0,
        comment: ingredient.comment ?? null,
        source: "IMPORTED_SIMPLE"
      });
      summary.updatedIngredients += 1;
    }

    const purchasePrice = purchasePriceFromRow ?? ingredient.purchasePrice;
    const purchaseUnit = purchaseUnitFromRow ?? normalizeSimpleUnit(ingredient.purchaseUnit);
    let costInPortion: number | null = manualCost;
    let source: SimpleRecipeData["source"] = "USER_PORTION_COST";

    if (costInPortion == null) {
      if (purchasePrice == null || !purchaseUnit) {
        addError(summary, rowNumber, "recipes", "purchase_price", "Purchase price and purchase unit are required for calculation.", ingredientName);
        continue;
      }
      const calculated = calculateSimplePortionCost({ quantity, unit, purchasePrice, purchaseUnit });
      if ("error" in calculated) {
        addError(summary, rowNumber, "recipes", "unit", calculated.error, `${purchaseUnit} -> ${unit}`);
        continue;
      }
      costInPortion = calculated.cost;
      source = "IMPORTED_SIMPLE";
    }

    const recipeData: SimpleRecipeData = {
      productId: product.id,
      ingredientId: ingredient.id,
      ingredientName: ingredient.name,
      quantity,
      unit,
      grossWeightGrams: null,
      netWeightGrams: null,
      yieldLossPercent: null,
      unitPurchasePrice: purchasePrice,
      unitMeasure: purchaseUnit,
      costPerUnit: null,
      totalIngredientCost: source === "USER_PORTION_COST" ? costInPortion : null,
      comment: text(row.comment) || null,
      source
    };

    const existingRecipe = await db.findRecipeItem(product.id, ingredient.id, ingredient.name);
    if (existingRecipe) {
      await db.updateRecipeItem(existingRecipe.id, recipeData);
      summary.updatedRecipeRows += 1;
    } else {
      await db.createRecipeItem(recipeData);
      summary.addedRecipeRows += 1;
      summary.createdRecipeRows += 1;
    }
  }

  return summary;
}

export function isSimpleImportKind(kind: string) {
  return ["menu_simple", "menu-simple", "ingredients_simple", "ingredients-simple", "recipes_simple", "recipes-simple"].includes(kind);
}

export function normalizeSimpleImportKind(kind: string) {
  return kind.replace("-", "_");
}

function unitInfo(unit: SimpleUnit): { group: UnitGroup; baseFactor: number } {
  if (unit === "kg") return { group: "mass", baseFactor: 1000 };
  if (unit === "g") return { group: "mass", baseFactor: 1 };
  if (unit === "liter") return { group: "volume", baseFactor: 1000 };
  if (unit === "ml") return { group: "volume", baseFactor: 1 };
  return { group: "piece", baseFactor: 1 };
}

function addError(summary: SimpleImportSummary, rowNumber: number, type: ImportRowIssue["type"], field: string, message: string, rawValue: unknown) {
  summary.errors.push({
    row_number: rowNumber,
    type,
    field,
    message,
    raw_value: typeof rawValue === "string" ? rawValue : JSON.stringify(rawValue ?? "")
  });
}

function isBlankRow(row: Record<string, unknown>) {
  return Object.values(row).every((value) => text(value) === "");
}
