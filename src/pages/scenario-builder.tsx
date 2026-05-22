import { Shell } from "@/pages/index";
import { calculateStoreModel } from "@/calculations/financial";
import { loadModel } from "@/lib/model";
import { num, percent, rub } from "@/lib/format";
import type { CapexInput, OpexInput, ProductInput, StoreInputs, TaxInputs } from "@/models/financial";

type ScenarioInputs = {
  products: ProductInput[];
  store: StoreInputs;
  opex: OpexInput[];
  capex: CapexInput[];
  tax: TaxInputs;
};

const scenarioNames = [
  "Empty",
  "Demo",
  "Conservative",
  "Base",
  "Aggressive",
  "High Rent",
  "Low Traffic",
  "Delivery Heavy",
  "Premium Pricing",
  "Food Cost Shock",
  "Payroll Shock"
];

export async function getServerSideProps() {
  const data = await loadModel();
  const base: ScenarioInputs = {
    products: data.products,
    store: data.store,
    opex: data.opex,
    capex: data.capex,
    tax: data.tax
  };
  const rows = scenarioNames.map((name) => {
    const inputs = buildScenario(name, base);
    const model = calculateStoreModel(inputs.products, inputs.store, inputs.opex, inputs.capex, inputs.tax);
    return {
      name,
      revenue: model.monthlyRevenue,
      ebitda: model.ebitda,
      ebitdaMargin: model.ebitdaMargin,
      netCashflow: model.operatingCashflow,
      payback: model.paybackMonth,
      roi: model.roi,
      breakEvenOrdersPerDay: model.breakEvenOrdersPerDay
    };
  });
  return { props: { rows } };
}

export default function ScenarioBuilderPage({ rows }: any) {
  return (
    <Shell>
      <div className="pageHeader">
        <div>
          <h1>Scenario Builder</h1>
          <p>Read-only scenario matrix for fast-food franchise assumptions. Scenarios are calculated on the fly and do not overwrite the base model.</p>
        </div>
      </div>
      <section className="band">
        <div className="tableScroll">
          <table className="financeTable">
            <thead>
              <tr>
                <th>Scenario</th>
                <th>Revenue</th>
                <th>EBITDA</th>
                <th>EBITDA margin</th>
                <th>Net cashflow</th>
                <th>Payback</th>
                <th>ROI</th>
                <th>Break-even orders/day</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row: any) => (
                <tr key={row.name}>
                  <td><strong>{row.name}</strong></td>
                  <td>{rub(row.revenue)}</td>
                  <td className={row.ebitda < 0 ? "negative" : "positive"}>{rub(row.ebitda)}</td>
                  <td className={row.ebitdaMargin < 0 ? "negative" : "positive"}>{percent(row.ebitdaMargin)}</td>
                  <td className={row.netCashflow < 0 ? "negative" : "positive"}>{rub(row.netCashflow)}</td>
                  <td>{row.payback == null ? "n/a" : `${row.payback} мес.`}</td>
                  <td>{row.roi == null ? "n/a" : percent(row.roi)}</td>
                  <td>{row.breakEvenOrdersPerDay == null ? "n/a" : num(row.breakEvenOrdersPerDay, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </Shell>
  );
}

function buildScenario(name: string, base: ScenarioInputs): ScenarioInputs {
  if (name === "Empty") return { products: [], store: emptyStore(), opex: [], capex: [], tax: {} };
  if (name === "Demo") return demoInputs();
  if (name === "Base") return base;
  if (name === "Conservative") return transform(base, { traffic: 0.85, avgCheck: 0.95, food: 1.05, rent: 1.05, payroll: 1.05 });
  if (name === "Aggressive") return transform(base, { traffic: 1.2, avgCheck: 1.08, food: 0.96, rent: 1, payroll: 1.03 });
  if (name === "High Rent") return transform(base, { rent: 1.35 });
  if (name === "Low Traffic") return transform(base, { traffic: 0.7 });
  if (name === "Delivery Heavy") return transform(base, { deliveryShare: 1.5, aggregatorCommission: 1.15 });
  if (name === "Premium Pricing") return transform(base, { avgCheck: 1.18, traffic: 0.95 });
  if (name === "Food Cost Shock") return transform(base, { food: 1.25 });
  if (name === "Payroll Shock") return transform(base, { payroll: 1.25 });
  return base;
}

function transform(base: ScenarioInputs, factors: Partial<Record<"traffic" | "avgCheck" | "food" | "packaging" | "rent" | "payroll" | "deliveryShare" | "aggregatorCommission", number>>): ScenarioInputs {
  return {
    products: multiplyProductCosts(base.products, factors.food ?? 1, factors.packaging ?? 1),
    store: {
      ...base.store,
      avgOrdersPerDay: base.store.avgOrdersPerDay * (factors.traffic ?? 1),
      avgCheck: base.store.avgCheck * (factors.avgCheck ?? 1),
      deliveryShare: Math.min(100, base.store.deliveryShare * (factors.deliveryShare ?? 1)),
      aggregatorCommissionRate: Math.min(100, base.store.aggregatorCommissionRate * (factors.aggregatorCommission ?? 1))
    },
    opex: base.opex.map((item) => {
      if (/rent|аренд/i.test(item.category)) return { ...item, amount: item.amount * (factors.rent ?? 1) };
      if (/payroll|фот|зарп/i.test(item.category)) return { ...item, amount: item.amount * (factors.payroll ?? 1) };
      return item;
    }),
    capex: base.capex,
    tax: base.tax
  };
}

function multiplyProductCosts(products: ProductInput[], food: number, packaging: number): ProductInput[] {
  return products.map((product) => ({
    ...product,
    recipes: (product.recipes ?? []).map((recipe) => ({
      ...recipe,
      totalIngredientCost: recipe.totalIngredientCost == null ? recipe.totalIngredientCost : recipe.totalIngredientCost * food,
      costPerUnit: recipe.costPerUnit == null ? recipe.costPerUnit : recipe.costPerUnit * food,
      unitPurchasePrice: recipe.unitPurchasePrice == null ? recipe.unitPurchasePrice : recipe.unitPurchasePrice * food,
      ingredient: recipe.ingredient ? { ...recipe.ingredient, purchasePrice: recipe.ingredient.purchasePrice * food } : recipe.ingredient
    })),
    packagingLinks: (product.packagingLinks ?? []).map((link) => ({
      ...link,
      packaging: { ...link.packaging, costPerUnit: link.packaging.costPerUnit * packaging }
    }))
  }));
}

function demoInputs(): ScenarioInputs {
  return {
    products: [{
      id: "demo",
      category: "Demo",
      name: "Demo Fast Food Combo",
      salePrice: 650,
      recipes: [{ ingredientName: "Demo food cost", totalIngredientCost: 115 }],
      packagingLinks: [{ units: 1, packaging: { name: "Demo packaging", costPerUnit: 18 } }]
    }],
    store: {
      workingDaysPerMonth: 30,
      avgOrdersPerDay: 150,
      avgItemsPerOrder: 1.8,
      avgCheck: 650,
      deliveryShare: 35,
      aggregatorShare: 55,
      acquiringRate: 2.1,
      aggregatorCommissionRate: 24,
      deliveryLogisticsCostPerOrder: 95,
      marketingCostPerItem: 18,
      ownerWithdrawalsMonthly: 0,
      loanPaymentsMonthly: 0,
      workingCapitalChangeMonthly: 0
    },
    opex: [
      { category: "Rent", amount: 190_000, behavior: "FIXED", driver: "FIXED" },
      { category: "Payroll", amount: 320_000, behavior: "FIXED", driver: "FIXED" },
      { category: "Utilities", amount: 45_000, behavior: "FIXED", driver: "FIXED" },
      { category: "Software", amount: 18_000, behavior: "FIXED", driver: "FIXED" },
      { category: "Accounting", amount: 25_000, behavior: "FIXED", driver: "FIXED" },
      { category: "Repairs", amount: 18_000, behavior: "FIXED", driver: "FIXED" },
      { category: "Other fixed OPEX", amount: 35_000, behavior: "FIXED", driver: "FIXED" }
    ],
    capex: [{ category: "Kitchen equipment", amount: 1_550_000, usefulLifeMonths: 36, paidBeforeOpening: true }],
    tax: { revenueTaxRate: 6 }
  };
}

function emptyStore(): StoreInputs {
  return {
    workingDaysPerMonth: 0,
    avgOrdersPerDay: 0,
    avgItemsPerOrder: 0,
    avgCheck: 0,
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
}
