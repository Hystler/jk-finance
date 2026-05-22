import { AlertTriangle, Copy, Download, Save, Sparkles } from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { Shell } from "@/pages/index";
import { loadModel } from "@/lib/model";
import { num, percent, rub } from "@/lib/format";

const colors = ["#7A4E2D", "#D9B88F", "#6F7F52", "#C9822B", "#B23A2E", "#4B2F1D", "#A67246", "#4F7A73"];

export async function getServerSideProps() {
  const data = await loadModel();
  return {
    props: {
      franchise: data.franchise,
      franchiseModel: data.franchiseModel
    }
  };
}

export default function FranchisePage({ franchise, franchiseModel }: any) {
  const franchisee = franchiseModel.franchisee;
  const franchisor = franchiseModel.franchisor;
  const forecast = franchisee.monthlyForecast ?? [];
  const cashflow24 = franchisee.cumulativeCashflow24 ?? [];
  const paybackPoint = franchisee.paybackMonth24 == null
    ? null
    : cashflow24.find((row: any) => row.month === franchisee.paybackMonth24);
  const chartHeight = 320;
  const sensitivityHeight = Math.max(320, franchiseModel.sensitivity.length * 42);
  const statusLabel = franchiseModel.status === "good" ? "good" : franchiseModel.status === "critical" ? "critical" : "warning";
  const hasRevenueForecast = forecast.some((row: any) => row.revenue > 0);
  const hasPaybackData = cashflow24.some((row: any) => row.openingInvestment > 0 || row.cumulativeCashflow !== 0);
  const hasMissingModelInputs = franchiseModel.missingDataWarnings.length > 0;
  const paybackValue = franchisee.paybackMonth == null
    ? hasMissingModelInputs ? "Недостаточно данных" : "not reached"
    : `${franchisee.paybackMonth} мес.`;

  return (
    <Shell>
      <div className="pageHeader franchiseHeader">
        <div>
          <h1>Franchise Mode</h1>
          <p>Franchise Mode считает новую точку франчайзи. Данные Store Model не используются автоматически, кроме случаев, когда вы вручную нажали “Скопировать inputs из Store Model”.</p>
          <div className="badgeRow">
            <span className={`status ${statusLabel}`}>{statusLabel}</span>
            {franchise.franchiseInputsCopiedFromStore && <span className="pill warningPill">inputs copied from Store Model</span>}
            {franchiseModel.missingDataWarning && <span className="pill warningPill">{franchiseModel.missingDataWarning}</span>}
          </div>
        </div>
        <div className="actions">
          <form method="post" action="/api/franchise">
            <button type="submit" name="action" value="demo"><Sparkles size={16} /> Demo / Base scenario</button>
          </form>
          <a className="button primary" href="/api/export/full"><Download size={16} /> XLSX</a>
        </div>
      </div>

      <div className="metrics franchiseMetrics">
        <Metric title="Opening investment" value={rub(franchisee.openingInvestment)} />
        <Metric title="Revenue month 1" value={rub(franchisee.revenueMonth1)} />
        <Metric title="Revenue month 12" value={rub(franchisee.revenueMonth12)} />
        <Metric title="EBITDA after fees M12" value={rub(franchisee.ebitdaAfterFeesMonth12)} tone={franchisee.ebitdaAfterFeesMonth12 < 0 ? "negative" : "positive"} />
        <Metric title="EBITDA margin M12" value={percent(franchisee.ebitdaMarginAfterFeesMonth12)} tone={franchisee.ebitdaMarginAfterFeesMonth12 < 0.1 ? "negative" : "positive"} />
        <Metric title="Net cashflow M12" value={rub(franchisee.netCashflowMonth12)} tone={franchisee.netCashflowMonth12 < 0 ? "negative" : "positive"} />
        <Metric title="Payback" value={paybackValue} />
        <Metric title="Annual ROI" value={franchisee.annualROI == null ? "n/a" : percent(franchisee.annualROI)} tone={franchisee.annualROI != null && franchisee.annualROI < 0.3 ? "negative" : "positive"} />
      </div>
      {hasMissingModelInputs && (
        <div className="franchiseEmptyBanner">
          Заполните Franchisee Store Inputs, OPEX, CAPEX и SKU себестоимость для расчета.
        </div>
      )}

      <nav className="segmented wrap sectionNav" aria-label="Franchise sections">
        <a href="#inputs">Inputs</a>
        <a href="#charts">Charts</a>
        <a href="#pnl">P&L</a>
        <a href="#cashflow">24M Cashflow</a>
        <a href="#franchisor">Franchisor</a>
        <a href="#scenarios">Scenarios</a>
        <a href="#checks">Audit</a>
      </nav>

      <section className="band" id="inputs">
        <div className="sectionHead">
          <h2>Inputs</h2>
          <span>Проценты вводятся как 6 = 6%, шаг стрелок равен 1</span>
        </div>
        <form className="franchiseInputStack" method="post" action="/api/franchise">
          <InputSection title="Franchise fees">
            <MoneyInput name="lumpSumFee" label="Паушальный взнос, ₽" value={franchise.lumpSumFee} step={10000} />
            <label>Royalty type
              <select name="royaltyType" defaultValue={franchise.royaltyType}>
                <option value="percent_of_revenue">percent_of_revenue</option>
                <option value="fixed_monthly">fixed_monthly</option>
                <option value="hybrid">hybrid</option>
              </select>
            </label>
            <PercentInput name="royaltyRate" label="Royalty rate, %" value={franchise.royaltyRate} />
            <MoneyInput name="fixedMonthlyRoyalty" label="Fixed royalty, ₽ / мес" value={franchise.fixedMonthlyRoyalty} step={1000} />
            <PercentInput name="marketingFeeRate" label="Marketing fee, %" value={franchise.marketingFeeRate} />
            <PercentInput name="supplyChainMarkup" label="Supply-chain markup, %" value={franchise.supplyChainMarkup} />
            <MoneyInput name="monthlyFixedFees" label="Other monthly fees, ₽ / мес" value={franchise.monthlyFixedFees} step={1000} />
            <MoneyInput name="monthlySupportCostPerFranchisee" label="Support cost / franchisee, ₽ / мес" value={franchise.monthlySupportCostPerFranchisee} step={1000} />
            <MoneyInput name="franchisorFixedTeamCosts" label="Franchisor fixed team costs, ₽ / мес" value={franchise.franchisorFixedTeamCosts} step={1000} />
            <NumberInput name="numberOfFranchisees" label="Number of franchisees" value={franchise.numberOfFranchisees} min={1} step={1} />
          </InputSection>

          <InputSection title="Franchisee Store Inputs">
            <NumberInput name="franchiseWorkingDaysPerMonth" label="Рабочие дни / мес" value={franchise.franchiseWorkingDaysPerMonth} min={0} max={31} step={1} />
            <NumberInput name="franchiseAvgOrdersPerDay" label="Заказы / день" value={franchise.franchiseAvgOrdersPerDay} min={0} step={1} />
            <NumberInput name="franchiseAvgItemsPerOrder" label="SKU / заказ" value={franchise.franchiseAvgItemsPerOrder} min={0} step={0.1} />
            <MoneyInput name="franchiseAvgCheck" label="Средний чек, ₽" value={franchise.franchiseAvgCheck} step={10} />
            <PercentInput name="franchiseDeliverySharePercent" label="Delivery share, %" value={franchise.franchiseDeliverySharePercent} />
            <PercentInput name="franchiseAggregatorSharePercent" label="Aggregator share, %" value={franchise.franchiseAggregatorSharePercent} />
            <PercentInput name="franchiseAcquiringRatePercent" label="Acquiring rate, %" value={franchise.franchiseAcquiringRatePercent} />
            <PercentInput name="franchiseAggregatorCommissionPercent" label="Aggregator commission, %" value={franchise.franchiseAggregatorCommissionPercent} />
            <MoneyInput name="franchiseLogisticsPerOrder" label="Логистика / заказ, ₽" value={franchise.franchiseLogisticsPerOrder} step={10} />
            <MoneyInput name="franchiseMarketingPerSku" label="Marketing / SKU, ₽" value={franchise.franchiseMarketingPerSku} step={10} />
            <PercentInput name="franchiseRevenueTaxRatePercent" label="Revenue tax rate, %" value={franchise.franchiseRevenueTaxRatePercent} />
            <PercentInput name="franchiseProfitTaxRatePercent" label="Profit tax rate, %" value={franchise.franchiseProfitTaxRatePercent} />
            <PercentInput name="franchiseVatRatePercent" label="VAT rate, %" value={franchise.franchiseVatRatePercent} />
            <MoneyInput name="franchiseOtherTaxesPerMonth" label="Other taxes, ₽ / мес" value={franchise.franchiseOtherTaxesPerMonth} step={1000} />
            <MoneyInput name="franchiseLoanPaymentsPerMonth" label="Loan payments, ₽ / мес" value={franchise.franchiseLoanPaymentsPerMonth} step={1000} />
            <MoneyInput name="franchiseOwnerWithdrawalsPerMonth" label="Owner withdrawals, ₽ / мес" value={franchise.franchiseOwnerWithdrawalsPerMonth} step={1000} />
          </InputSection>

          <InputSection title="Franchisee OPEX">
            <MoneyInput name="franchiseRent" label="Rent, ₽ / мес" value={franchise.franchiseRent} step={1000} />
            <MoneyInput name="franchisePayroll" label="Payroll, ₽ / мес" value={franchise.franchisePayroll} step={1000} />
            <MoneyInput name="franchiseUtilities" label="Utilities, ₽ / мес" value={franchise.franchiseUtilities} step={1000} />
            <MoneyInput name="franchiseSoftware" label="Software, ₽ / мес" value={franchise.franchiseSoftware} step={1000} />
            <MoneyInput name="franchiseAccounting" label="Accounting, ₽ / мес" value={franchise.franchiseAccounting} step={1000} />
            <MoneyInput name="franchiseRepairs" label="Repairs, ₽ / мес" value={franchise.franchiseRepairs} step={1000} />
            <MoneyInput name="franchiseOtherFixedOpex" label="Other fixed OPEX, ₽ / мес" value={franchise.franchiseOtherFixedOpex} step={1000} />
          </InputSection>

          <InputSection title="Opening investment additions">
            <MoneyInput name="trainingFee" label="Training fee, ₽" value={franchise.trainingFee} step={10000} />
            <MoneyInput name="openingSupportFee" label="Opening support fee, ₽" value={franchise.openingSupportFee} step={10000} />
            <MoneyInput name="openingInventory" label="Opening inventory, ₽" value={franchise.openingInventory} step={10000} />
            <MoneyInput name="launchMarketing" label="Launch marketing, ₽" value={franchise.launchMarketing} step={10000} />
            <MoneyInput name="rentDeposit" label="Rent deposit, ₽" value={franchise.rentDeposit} step={10000} />
            <MoneyInput name="contingencyAmount" label="Contingency, ₽" value={franchise.contingencyAmount} step={10000} />
            <PercentInput name="contingencyPercent" label="Contingency, %" value={franchise.contingencyPercent} />
            <MoneyInput name="loanAmount" label="Loan amount, ₽" value={franchise.loanAmount} step={10000} />
          </InputSection>

          <InputSection title="Revenue Trend">
            <NumberInput name="forecastMonths" label="Forecast months" value={franchise.forecastMonths} min={1} max={60} step={1} />
            <label>Revenue trend type
              <select name="revenueTrendType" defaultValue={franchise.revenueTrendType}>
                <option value="flat">flat</option>
                <option value="growth">growth</option>
                <option value="decline">decline</option>
                <option value="ramp_up">ramp_up</option>
                <option value="custom">custom</option>
              </select>
            </label>
            <PercentInput name="monthlyGrowthRatePercent" label="Monthly growth, %" value={franchise.monthlyGrowthRatePercent} />
            <PercentInput name="monthlyDeclineRatePercent" label="Monthly decline, %" value={franchise.monthlyDeclineRatePercent} />
            <NumberInput name="rampUpMonths" label="Ramp-up months" value={franchise.rampUpMonths} min={1} max={60} step={1} />
            <PercentInput name="rampUpStartPercent" label="Ramp-up start, %" value={franchise.rampUpStartPercent} />
            <label className="checkLine"><input type="checkbox" name="seasonalityEnabled" defaultChecked={franchise.seasonalityEnabled} /> Seasonality enabled</label>
          </InputSection>

          <div className="rowActions wideActions">
            <button className="primary" type="submit" name="action" value="save"><Save size={16} /> Сохранить</button>
            <button type="submit" name="action" value="copy_store"><Copy size={16} /> Скопировать inputs из Store Model</button>
            <button type="submit" name="action" value="demo"><Sparkles size={16} /> Demo / Base scenario</button>
          </div>
        </form>
      </section>

      <section className="band" id="charts">
        <div className="sectionHead">
          <h2>Charts</h2>
          <span>Revenue trend, EBITDA, cashflow, payback, margins и franchisor revenue</span>
        </div>
        <div className="twoCol">
          <ChartCard title="Revenue trend">
            {hasRevenueForecast ? (
              <ResponsiveContainer width="100%" height={chartHeight}>
                <LineChart data={forecast} margin={{ top: 16, right: 24, bottom: 8, left: 12 }}>
                  <XAxis dataKey="month" tickFormatter={(value) => `M${value}`} />
                  <YAxis tickFormatter={(value) => compactRub(Number(value))} width={82} />
                  <Tooltip formatter={(value: number) => rub(value)} labelFormatter={(label) => `Month ${label}`} />
                  <Legend />
                  <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#7A4E2D" strokeWidth={3} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : <EmptyState text="Заполните Franchisee Store Inputs, чтобы увидеть revenue trend." />}
          </ChartCard>

          <ChartCard title="Revenue / EBITDA / Net cashflow">
            {hasRevenueForecast ? (
              <ResponsiveContainer width="100%" height={chartHeight}>
                <ComposedChart data={forecast} margin={{ top: 16, right: 24, bottom: 8, left: 12 }}>
                  <XAxis dataKey="month" tickFormatter={(value) => `M${value}`} />
                  <YAxis tickFormatter={(value) => compactRub(Number(value))} width={82} />
                  <Tooltip formatter={(value: number) => rub(value)} labelFormatter={(label) => `Month ${label}`} />
                  <Legend />
                  <Bar dataKey="revenue" name="Revenue" fill="#D9B88F" />
                  <Line type="monotone" dataKey="ebitdaAfterFees" name="EBITDA after fees" stroke="#6F7F52" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="netOperatingCashflow" name="Net cashflow" stroke="#B23A2E" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            ) : <EmptyState text="Нет данных для графика EBITDA и cashflow." />}
          </ChartCard>
        </div>

        <div className="twoCol">
          <ChartCard title="Cumulative cashflow / payback">
            {hasPaybackData ? (
              <ResponsiveContainer width="100%" height={chartHeight}>
                <LineChart data={cashflow24} margin={{ top: 16, right: 24, bottom: 8, left: 12 }}>
                  <XAxis dataKey="month" tickFormatter={(value) => `M${value}`} />
                  <YAxis tickFormatter={(value) => compactRub(Number(value))} width={82} />
                  <Tooltip formatter={(value: number) => rub(value)} labelFormatter={(label) => `Month ${label}`} />
                  <ReferenceLine y={0} stroke="#4B2F1D" strokeDasharray="4 4" />
                  {paybackPoint && <ReferenceDot x={paybackPoint.month} y={paybackPoint.cumulativeCashflow} r={6} fill="#6F7F52" stroke="#4B2F1D" />}
                  <Line type="monotone" dataKey="cumulativeCashflow" name="Cumulative cashflow" stroke="#7A4E2D" strokeWidth={3} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : <EmptyState text="Заполните opening investment и cashflow assumptions." />}
          </ChartCard>

          <ChartCard title="Margin chart">
            {hasRevenueForecast ? (
              <ResponsiveContainer width="100%" height={chartHeight}>
                <BarChart data={franchisee.marginRows} margin={{ top: 16, right: 24, bottom: 38, left: 12 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-18} textAnchor="end" height={64} />
                  <YAxis tickFormatter={(value) => percent(Number(value))} width={78} />
                  <Tooltip formatter={(value: number) => percent(value)} />
                  <ReferenceLine y={0} stroke="#4B2F1D" />
                  <Bar dataKey="value" name="Margin">
                    {franchisee.marginRows.map((row: any, index: number) => <Cell key={index} fill={row.value < 0 ? "#B23A2E" : colors[index % colors.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyState text="Margin chart появится после расчета выручки." />}
          </ChartCard>
        </div>

        <div className="twoCol">
          <ChartCard title="Franchisor revenue structure">
            {franchisor.revenueStructure.length ? (
              <ResponsiveContainer width="100%" height={chartHeight}>
                <PieChart>
                  <Pie data={franchisor.revenueStructure} dataKey="value" nameKey="name" innerRadius={68} outerRadius={105}>
                    {franchisor.revenueStructure.map((_: any, index: number) => <Cell key={index} fill={colors[index % colors.length]} />)}
                  </Pie>
                  <Tooltip formatter={(value: number) => rub(value)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : <EmptyState text="Заполните royalty, marketing fee или monthly fixed fees." />}
          </ChartCard>

          <ChartCard title="Franchise sensitivity">
            {franchiseModel.sensitivity.length ? (
              <ResponsiveContainer width="100%" height={sensitivityHeight}>
                <BarChart data={franchiseModel.sensitivity} layout="vertical" margin={{ top: 16, right: 24, bottom: 8, left: 28 }}>
                  <XAxis type="number" tickFormatter={(value) => compactRub(Number(value))} />
                  <YAxis type="category" dataKey="factor" width={120} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value: number) => rub(value)} />
                  <ReferenceLine x={0} stroke="#4B2F1D" />
                  <Bar dataKey="ebitdaImpact" name="EBITDA impact">
                    {franchiseModel.sensitivity.map((row: any, index: number) => <Cell key={index} fill={row.ebitdaImpact < 0 ? "#B23A2E" : "#6F7F52"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyState text="Sensitivity появится после заполнения модели." />}
          </ChartCard>
        </div>
      </section>

      <section className="band" id="pnl">
        <div className="sectionHead">
          <h2>Franchisee P&L month 1 / month 12</h2>
          <span>Month 12 используется в top KPI и scenarios</span>
        </div>
        <div className="tableScroll financeTableWrap">
          <table className="financeTable">
            <thead>
              <tr>
                <th>Franchisee P&L</th>
                <th>Month 1</th>
                <th>Month 12</th>
                <th>% revenue M12</th>
              </tr>
            </thead>
            <tbody>
              {franchisee.pnlRowsMonth12.map((row: any, index: number) => {
                const month1 = franchisee.pnlRowsMonth1[index];
                return (
                  <tr key={row.key} className={`${row.kind === "total" ? "totalRow" : ""} ${row.kind === "subtotal" ? "subtotalRow" : ""} ${row.kind === "margin" ? "marginRow" : ""}`}>
                    <td>{row.label}</td>
                    <td className={valueTone(month1?.value)}>{row.kind === "margin" ? percent(month1?.value ?? 0) : rub(month1?.value ?? 0)}</td>
                    <td className={valueTone(row.value)}>{row.kind === "margin" ? percent(row.value) : rub(row.value)}</td>
                    <td className={row.margin != null ? valueTone(row.margin) : ""}>{row.margin == null ? "-" : percent(row.margin)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="band" id="cashflow">
        <div className="sectionHead">
          <h2>24M Cashflow</h2>
          <span>Month 0 включает opening investment, дальше каждый месяц считается отдельно</span>
        </div>
        <div className="tableScroll cashflowTableWrap">
          <table className="cashflowTable">
            <thead>
              <tr>
                <th>Month</th>
                <th>Revenue</th>
                <th>Orders</th>
                <th>COGS</th>
                <th>Variable</th>
                <th>Fixed</th>
                <th>EBITDA after fees</th>
                <th>Taxes</th>
                <th>Net cashflow</th>
                <th>Cumulative</th>
              </tr>
            </thead>
            <tbody>
              {cashflow24.map((row: any) => (
                <tr key={row.month} className={row.month === 0 ? "totalRow" : ""}>
                  <td>{row.label}</td>
                  <td>{rub(row.revenue)}</td>
                  <td>{num(row.orders, 0)}</td>
                  <td>{rub(row.foodCost + row.packagingCost)}</td>
                  <td>{rub(row.variableCosts)}</td>
                  <td>{rub(row.fixedCosts)}</td>
                  <td className={valueTone(row.ebitdaAfterFees)}>{rub(row.ebitdaAfterFees)}</td>
                  <td>{rub(-row.taxes)}</td>
                  <td className={valueTone(row.netOperatingCashflow)}>{rub(row.netOperatingCashflow)}</td>
                  <td className={valueTone(row.cumulativeCashflow)}>{rub(row.cumulativeCashflow)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="band" id="franchisor">
        <div className="sectionHead">
          <h2>Franchisor economics</h2>
          <span>{franchise.numberOfFranchisees} franchisee(s) in network mode</span>
        </div>
        <div className="metrics compactMetrics">
          <Metric title="Monthly revenue / franchisee" value={rub(franchisor.monthlyRevenue)} />
          <Metric title="One-time revenue" value={rub(franchisor.oneTimeRevenue)} />
          <Metric title="Allocated fixed team" value={rub(franchisor.allocatedFixedTeamCosts)} />
          <Metric title="Franchisor EBITDA / franchisee" value={rub(franchisor.ebitda)} tone={franchisor.ebitda < 0 ? "negative" : "positive"} />
          <Metric title="Total monthly EBITDA" value={rub(franchisor.totalMonthlyEBITDA)} tone={franchisor.totalMonthlyEBITDA < 0 ? "negative" : "positive"} />
          <Metric title="EBITDA margin" value={percent(franchisor.ebitdaMargin)} />
        </div>
        <div className="tableScroll">
          <table>
            <tbody>
              <SimpleRow label="Royalty" value={rub(franchisor.royalty)} />
              <SimpleRow label="Marketing fee" value={rub(franchisor.marketingFee)} />
              <SimpleRow label="Supply-chain markup revenue" value={rub(franchisor.supplyChainMarkupRevenue)} />
              <SimpleRow label="Monthly fixed fees" value={rub(franchisor.monthlyFixedFees)} />
              <SimpleRow label="Support cost / franchisee" value={rub(-franchisor.supportCostPerFranchisee)} />
              <SimpleRow label="Allocated fixed team costs" value={rub(-franchisor.allocatedFixedTeamCosts)} />
              <SimpleRow label="Franchisor EBITDA" value={rub(franchisor.ebitda)} />
            </tbody>
          </table>
        </div>
      </section>

      <section className="band" id="scenarios">
        <div className="sectionHead">
          <h2>Scenarios</h2>
          <span>Downside / Base / Upside используют независимые Franchise inputs</span>
        </div>
        <div className="tableScroll">
          <table className="financeTable">
            <thead>
              <tr>
                <th>Metric</th>
                <th>Downside</th>
                <th>Base</th>
                <th>Upside</th>
              </tr>
            </thead>
            <tbody>
              {franchiseModel.scenarios.rows.map((row: any) => (
                <tr key={row.metric}>
                  <td>{row.metric}</td>
                  <td className={valueTone(row.Downside)}>{formatScenarioValue(row.Downside, row.format)}</td>
                  <td className={valueTone(row.Base)}>{formatScenarioValue(row.Base, row.format)}</td>
                  <td className={valueTone(row.Upside)}>{formatScenarioValue(row.Upside, row.format)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="band" id="checks">
        <div className="sectionHead">
          <h2>Audit</h2>
          <span>Что ломает экономику франчайзи</span>
        </div>
        {franchiseModel.missingDataWarnings.length > 0 && (
          <div className="checks warningBlock">
            <div className="check warning">{franchiseModel.missingDataWarning}</div>
            {franchiseModel.missingDataWarnings.map((message: string) => <div className="check warning" key={message}>{message}</div>)}
          </div>
        )}
        <div className="twoCol">
          <div className="checks">
            <h3>Топ-причины</h3>
            {franchiseModel.breakers.length ? franchiseModel.breakers.map((item: string) => (
              <div className="check warning" key={item}><AlertTriangle size={16} /> {item}</div>
            )) : <div className="check info">Явных слабых мест в franchise model сейчас нет.</div>}
          </div>
          <div className="checks">
            <h3>Franchise checks</h3>
            {franchiseModel.checks.length ? franchiseModel.checks.map((check: any) => (
              <div className={`check ${check.severity}`} key={`${check.code}-${check.message}`}>
                <AlertTriangle size={16} /> {check.message}
              </div>
            )) : <div className="check info">Критичных franchise checks нет.</div>}
          </div>
        </div>
      </section>
    </Shell>
  );
}

function InputSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="inputGroup">
      <h3>{title}</h3>
      <div className="gridForm">{children}</div>
    </div>
  );
}

function NumberInput({
  label,
  name,
  value,
  min,
  max,
  step
}: {
  label: string;
  name: string;
  value: string | number;
  min?: number;
  max?: number;
  step: number;
}) {
  return (
    <label>{label}
      <input name={name} defaultValue={value} inputMode="decimal" type="number" min={min} max={max} step={step} />
    </label>
  );
}

function PercentInput({ label, name, value }: { label: string; name: string; value: string | number }) {
  return <NumberInput label={label} name={name} value={value} min={0} max={100} step={1} />;
}

function MoneyInput({ label, name, value, step }: { label: string; name: string; value: string | number; step: number }) {
  return <NumberInput label={label} name={name} value={value} min={0} step={step} />;
}

function Metric({ title, value, tone }: { title: string; value: string; tone?: "positive" | "negative" }) {
  return (
    <div className="metric">
      <span>{title}</span>
      <strong className={tone}>{value}</strong>
    </div>
  );
}

function SimpleRow({ label, value }: { label: string; value: string }) {
  return <tr><td>{label}</td><td><strong>{value}</strong></td></tr>;
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="chartPanel">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="emptyState">{text}</div>;
}

function valueTone(value: number | null | undefined) {
  if (value == null) return "";
  if (value < 0) return "negative";
  if (value > 0) return "positive";
  return "";
}

function formatScenarioValue(value: number | null, format: string) {
  if (value == null) return "n/a";
  if (format === "money") return rub(value);
  if (format === "percent") return percent(value);
  if (format === "month") return `${num(value, 0)} мес.`;
  return num(value, 1);
}

function compactRub(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${num(value / 1_000_000, 1)}M`;
  if (abs >= 1_000) return `${num(value / 1_000, 0)}k`;
  return num(value, 0);
}
