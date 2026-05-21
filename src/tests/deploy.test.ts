import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { calculateProductEconomics, calculateStoreModel } from "@/calculations/financial";
import type { ProductInput, StoreInputs } from "@/models/financial";

const { mockLoadModel, mockPrisma } = vi.hoisted(() => ({
  mockLoadModel: vi.fn(),
  mockPrisma: {
    assumption: { findMany: vi.fn() },
    recipeItem: { findMany: vi.fn() },
    productPackaging: { findMany: vi.fn() },
    $queryRaw: vi.fn()
  }
}));

vi.mock("@/lib/model", () => ({ loadModel: mockLoadModel }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

import exportHandler from "@/pages/api/export/full";
import healthHandler from "@/pages/api/health";

const store: StoreInputs = {
  workingDaysPerMonth: 30,
  avgOrdersPerDay: 100,
  avgItemsPerOrder: 2,
  avgCheck: 500,
  deliveryShare: 70,
  aggregatorShare: 50,
  acquiringRate: 2,
  aggregatorCommissionRate: 25,
  deliveryLogisticsCostPerOrder: 60,
  marketingCostPerItem: 5,
  ownerWithdrawalsMonthly: 0,
  loanPaymentsMonthly: 0,
  workingCapitalChangeMonthly: 0
};

const product: ProductInput = {
  id: "sku-export",
  category: "Tests",
  name: "Export burger",
  salePrice: 300,
  source: "MANUAL",
  recipes: [{ ingredientName: "beef", totalIngredientCost: 90 }],
  packagingLinks: [{ units: 1, packaging: { name: "box", costPerUnit: 15 } }]
};

function mockRes() {
  const res: any = {
    statusCode: 200,
    body: undefined,
    headers: {} as Record<string, string>,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
    setHeader(key: string, value: string) {
      this.headers[key] = value;
      return this;
    },
    send(payload: unknown) {
      this.body = payload;
      return this;
    }
  };
  return res;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.assumption.findMany.mockResolvedValue([]);
  mockPrisma.recipeItem.findMany.mockResolvedValue([]);
  mockPrisma.productPackaging.findMany.mockResolvedValue([]);
});

describe("deploy readiness", () => {
  it("export route generates an XLSX response in memory", async () => {
    const model = calculateStoreModel([product], store, [], [], { revenueTaxRate: 6 });
    mockLoadModel.mockResolvedValue({
      economics: [calculateProductEconomics(product, store, { revenueTaxRate: 6 }, 0, 0, 6000)],
      productsRaw: [{
        id: product.id,
        category: product.category,
        name: product.name,
        description: null,
        salePrice: product.salePrice,
        imageUrl: null,
        productUrl: null,
        isActive: true,
        source: "MANUAL"
      }],
      ingredientsRaw: [],
      packagingRaw: [],
      model,
      checks: [],
      capexRaw: [],
      opexRaw: [],
      sensitivity: [],
      franchiseModel: undefined
    });

    const res = mockRes();
    await exportHandler({ method: "GET" } as any, res);

    expect(res.headers["Content-Type"]).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(Buffer.isBuffer(res.body)).toBe(true);
    const workbook = XLSX.read(res.body);
    expect(workbook.SheetNames).toContain("SKU Unit Economics");
  });

  it("health route reports a connected database", async () => {
    mockPrisma.$queryRaw.mockResolvedValueOnce([{ ok: 1 }]);
    const res = mockRes();

    await healthHandler({ method: "GET" } as any, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.db).toBe("connected");
  });

  it("health route reports a disconnected database without leaking details", async () => {
    mockPrisma.$queryRaw.mockRejectedValueOnce(new Error("secret connection string"));
    const res = mockRes();

    await healthHandler({ method: "GET" } as any, res);

    expect(res.statusCode).toBe(503);
    expect(res.body).toMatchObject({ status: "error", db: "disconnected" });
    expect(JSON.stringify(res.body)).not.toContain("secret connection string");
  });

  it("does not contain local absolute paths in project text files", () => {
    const forbidden = ["/Users", "akimkovalenko", "Desktop", "JK", "app"].join("/");
    const files = collectTextFiles(process.cwd());
    const offenders = files.filter((file) => fs.readFileSync(file, "utf8").includes(forbidden));
    expect(offenders.map((file) => path.relative(process.cwd(), file))).toEqual([]);
  });
});

function collectTextFiles(dir: string): string[] {
  const ignoredDirs = new Set(["node_modules", ".next", ".npm-cache", "scrape_artifacts"]);
  const textExtensions = new Set([".css", ".json", ".md", ".mjs", ".prisma", ".sql", ".ts", ".tsx"]);
  const files: string[] = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") && ![".env.example", ".gitignore"].includes(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name)) files.push(...collectTextFiles(fullPath));
      continue;
    }
    if (entry.isFile() && (textExtensions.has(path.extname(entry.name)) || entry.name === ".env.example" || entry.name === ".gitignore")) {
      files.push(fullPath);
    }
  }

  return files;
}
