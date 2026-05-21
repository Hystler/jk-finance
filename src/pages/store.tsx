import { Shell } from "@/pages/index";
import { loadModel } from "@/lib/model";
import { percent, rub } from "@/lib/format";

export async function getServerSideProps() {
  const data = await loadModel();
  return { props: { store: JSON.parse(JSON.stringify(data.storeRaw)), tax: JSON.parse(JSON.stringify(data.taxRaw)), model: data.model, diagnostics: data.diagnostics } };
}

export default function StorePage({ store, tax, model, diagnostics }: any) {
  return (
    <Shell>
      <div className="pageHeader">
        <div>
          <h1>Store Model</h1>
          <p>Ввод точки, налогов, комиссий и delivery assumptions. Налоги являются расчетными assumptions, не юридическим заключением.</p>
        </div>
      </div>
      <form className="band" method="post" action="/api/store">
        <div className="gridForm">
          <Input name="workingDaysPerMonth" label="Рабочие дни" unit="дней / мес" value={store.workingDaysPerMonth} min={1} max={31} step={1} help="Например: 30" />
          <Input name="avgOrdersPerDay" label="Заказы" unit="заказов / день" value={store.avgOrdersPerDay} min={0} step={1} help="Среднее число заказов в день" />
          <Input name="avgItemsPerOrder" label="SKU / заказ" unit="шт" value={store.avgItemsPerOrder} min={0.1} step={0.1} help="Среднее количество позиций в одном заказе. Например: 1.4" />
          <Input name="avgCheck" label="Средний чек" unit="₽" value={store.avgCheck} min={0} step={10} help="Средний чек одного заказа" />
          <Input name="deliveryShare" label="Delivery share" unit="%" value={store.deliveryShare} min={0} max={100} step={1} help="Доля заказов на доставку. 10 = 10%" />
          <Input name="aggregatorShare" label="Aggregator share" unit="%" value={store.aggregatorShare} min={0} max={100} step={1} help="Доля доставки через агрегаторы. 50 = 50%" />
          <Input name="acquiringRate" label="Acquiring rate" unit="%" value={store.acquiringRate} min={0} max={100} step={1} help="Комиссия эквайринга. 2.5 = 2.5%" />
          <Input name="aggregatorCommissionRate" label="Aggregator commission" unit="%" value={store.aggregatorCommissionRate} min={0} max={100} step={1} help="Комиссия агрегатора от заказа. 25 = 25%" />
          <Input name="deliveryLogisticsCostPerOrder" label="Логистика / заказ" unit="₽ / заказ" value={store.deliveryLogisticsCostPerOrder} min={0} step={10} help="Переменная стоимость доставки на один delivery-заказ" />
          <Input name="marketingCostPerItem" label="Marketing / SKU" unit="₽ / SKU" value={store.marketingCostPerItem} min={0} step={10} help="Переменный маркетинг на одну проданную позицию" />
          <Input name="loanPaymentsMonthly" label="Loan payments" unit="₽ / мес" value={store.loanPaymentsMonthly} min={0} step={1000} help="Ежемесячные платежи по займам, если есть" />
          <Input name="ownerWithdrawalsMonthly" label="Owner withdrawals" unit="₽ / мес" value={store.ownerWithdrawalsMonthly} min={0} step={1000} help="Выплаты собственнику, если учитываются в cashflow" />
          <Input name="revenueTaxRate" label="Revenue tax rate" unit="%" value={tax?.revenueTaxRate ?? ""} min={0} max={100} step={1} help="Налог с выручки. 6 = 6%" />
          <Input name="profitTaxRate" label="Profit tax rate" unit="%" value={tax?.profitTaxRate ?? ""} min={0} max={100} step={1} help="Налог с прибыли. 20 = 20%" />
          <Input name="vatRate" label="VAT rate" unit="%" value={tax?.vatRate ?? ""} min={0} max={100} step={1} help="НДС. 20 = 20%. Сейчас справочное поле, не включается в tax paid автоматически" />
          <Input name="otherTaxes" label="Other taxes" unit="₽ / мес" value={tax?.otherTaxes ?? 0} min={0} step={1000} help="Прочие налоги и обязательные платежи в месяц" />
        </div>
        <p className="muted">НДС требует отдельной налоговой логики, сейчас используется как справочное поле или упрощенное допущение.</p>
        <p><button className="primary" type="submit">Сохранить assumptions</button></p>
      </form>
      <Diagnostics diagnostics={diagnostics} />
      <section className="band">
        <h2>P&L / Cashflow</h2>
        <table>
          <tbody>
            <Row label="Revenue" value={rub(model.monthlyRevenue)} />
            <Row label="Food cost" value={rub(model.foodCostTotal)} />
            <Row label="Packaging" value={rub(model.packagingTotal)} />
            <Row label="Gross profit" value={rub(model.grossProfit)} />
            <Row label="Variable costs" value={rub(model.variableCosts)} />
            <Row label="Fixed costs" value={rub(model.fixedCosts)} />
            <Row label="Revenue tax" value={rub(model.revenueTax)} />
            <Row label="Profit tax" value={rub(model.profitTax)} />
            <Row label="VAT reference, not in tax paid" value={rub(model.vatReference)} />
            <Row label="EBITDA" value={`${rub(model.ebitda)} / ${percent(model.ebitdaMargin)}`} tone={model.ebitda < 0 ? "negative" : "positive"} />
            <Row label="Tax paid" value={rub(model.taxPaid)} />
            <Row label="Operating cashflow" value={rub(model.operatingCashflow)} tone={model.operatingCashflow < 0 ? "negative" : "positive"} />
            <Row label="Break-even revenue" value={model.breakEvenRevenue == null ? "n/a" : rub(model.breakEvenRevenue)} />
            <Row label="Payback" value={model.paybackMonth ? `${model.paybackMonth} мес.` : "n/a"} />
          </tbody>
        </table>
      </section>
    </Shell>
  );
}

function Input({
  label,
  name,
  unit,
  value,
  help,
  min,
  max,
  step = 1
}: {
  label: string;
  name: string;
  unit: string;
  value: string | number;
  help: string;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <label>
      <span>{label}, {unit}</span>
      <input name={name} defaultValue={value} inputMode="decimal" type="number" min={min} max={max} step={step} placeholder={help} />
      <small>{help}</small>
    </label>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "positive" | "negative" }) {
  return <tr><td>{label}</td><td><strong className={tone ? `value ${tone}` : ""}>{value}</strong></td></tr>;
}

function Diagnostics({ diagnostics }: { diagnostics: any[] }) {
  return (
    <section className="band warningPanel">
      <h2>Почему EBITDA / Cashflow отрицательные</h2>
      {diagnostics.length ? diagnostics.map((item) => <div className={`check ${item.severity}`} key={item.message}>{item.message}</div>) : <p>Явных причин отрицательных значений сейчас нет. Если модель пустая, заполните Store Inputs, рецептуры, упаковку, OPEX и CAPEX.</p>}
    </section>
  );
}
