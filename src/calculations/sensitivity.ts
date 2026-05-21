import { calculateStoreModel } from "@/calculations/financial";
import type { CapexInput, OpexInput, ProductInput, StoreInputs, TaxInputs } from "@/models/financial";

export type SensitivityRow = {
  parameter: string;
  values: Record<"-20%" | "-10%" | "Base" | "+10%" | "+20%", number | null>;
  impactOnEbitda: number | null;
  impactOnPayback: number | null;
};

const multipliers = [
  ["-20%", 0.8],
  ["-10%", 0.9],
  ["Base", 1],
  ["+10%", 1.1],
  ["+20%", 1.2]
] as const;

export function calculateSensitivity(products: ProductInput[], store: StoreInputs, opex: OpexInput[], capex: CapexInput[], tax: TaxInputs): SensitivityRow[] {
  const base = calculateStoreModel(products, store, opex, capex, tax);
  const rows: Array<{ parameter: string; apply: (m: number) => [StoreInputs, OpexInput[], CapexInput[], TaxInputs] }> = [
    { parameter: "Средний чек", apply: (m) => [{ ...store, avgCheck: store.avgCheck * m }, opex, capex, tax] },
    { parameter: "Заказы в день", apply: (m) => [{ ...store, avgOrdersPerDay: store.avgOrdersPerDay * m }, opex, capex, tax] },
    { parameter: "Аренда", apply: (m) => [store, opex.map((x) => (/rent|аренд/i.test(x.category) ? { ...x, amount: x.amount * m } : x)), capex, tax] },
    { parameter: "ФОТ", apply: (m) => [store, opex.map((x) => (/payroll|фот|зарп/i.test(x.category) ? { ...x, amount: x.amount * m } : x)), capex, tax] },
    { parameter: "Комиссия агрегатора", apply: (m) => [{ ...store, aggregatorCommissionRate: store.aggregatorCommissionRate * m }, opex, capex, tax] },
    { parameter: "Delivery share", apply: (m) => [{ ...store, deliveryShare: Math.min(100, store.deliveryShare * m) }, opex, capex, tax] },
    { parameter: "Налоговая ставка", apply: (m) => [store, opex, capex, { ...tax, revenueTaxRate: (tax.revenueTaxRate ?? 0) * m }] },
    { parameter: "CAPEX", apply: (m) => [store, opex, capex.map((x) => ({ ...x, amount: x.amount * m })), tax] },
    { parameter: "Упаковка", apply: (m) => [store, opex.map((x) => (/pack|упаков/i.test(x.category) ? { ...x, amount: x.amount * m } : x)), capex, tax] }
  ];

  return rows.map((row) => {
    const values = {} as SensitivityRow["values"];
    const outcomes = multipliers.map(([label, multiplier]) => {
      const [nextStore, nextOpex, nextCapex, nextTax] = row.apply(multiplier);
      const result = calculateStoreModel(products, nextStore, nextOpex, nextCapex, nextTax);
      values[label] = result.ebitda;
      return { label, result };
    });
    const minus20 = outcomes[0].result;
    const plus20 = outcomes[4].result;
    return {
      parameter: row.parameter,
      values,
      impactOnEbitda: plus20.ebitda - minus20.ebitda,
      impactOnPayback: plus20.paybackMonth != null && minus20.paybackMonth != null ? plus20.paybackMonth - minus20.paybackMonth : null
    };
  });
}
