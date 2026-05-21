# Formulas

## SKU Unit Economics

All percentage inputs use user-facing percent units: `1 = 1%`, `50 = 50%`. Calculations convert them with `percentDecimal = input / 100`.

```text
ingredient_cost = sum(recipe.total_ingredient_cost)
packaging_cost = sum(packaging.cost_per_unit * units)
acquiring_cost = sale_price * acquiring_rate_percent / 100
delivery_commission = sale_price * aggregator_commission_percent / 100 * aggregator_share_percent / 100 * delivery_share_percent / 100
tax_per_item = sale_price * effective_tax_rate_percent / 100
depreciation_per_item = monthly_depreciation / monthly_items_sold
direct_labor_per_item = monthly_variable_labor / monthly_items_sold

total_variable_cost =
  ingredient_cost
  + packaging_cost
  + acquiring_cost
  + delivery_commission
  + delivery_logistics_cost
  + marketing_cost_per_item
  + tax_per_item
  + direct_labor_per_item

gross_profit = sale_price - ingredient_cost - packaging_cost
gross_margin_percent = gross_profit / sale_price
contribution_margin = sale_price - total_variable_cost
contribution_margin_percent = contribution_margin / sale_price
EBITDA_per_item = contribution_margin - allocated_fixed_cost_per_item
EBITDA_margin_percent = EBITDA_per_item / sale_price
```

## Store P&L

```text
monthly_orders = avg_orders_per_day * working_days_per_month
monthly_items_sold = monthly_orders * avg_items_per_order
monthly_revenue = monthly_orders * avg_check
delivery_orders = monthly_orders * delivery_share_percent / 100
aggregator_orders = delivery_orders * aggregator_share_percent / 100

food_cost_total = sum(sku_sales * sku_ingredient_cost)
packaging_total = sum(sku_sales * sku_packaging_cost)
gross_profit = revenue - food_cost_total - packaging_total

aggregator_commission_cost = aggregator_orders * avg_check * aggregator_commission_percent / 100
acquiring_cost = monthly_revenue * acquiring_rate_percent / 100
delivery_logistics_cost = delivery_orders * logistics_per_order
marketing_cost = monthly_items_sold * marketing_per_sku

EBITDA = revenue - food_cost - packaging - variable_costs - fixed_costs
EBITDA_margin = EBITDA / revenue
tax_paid = revenue_tax + profit_tax + other_taxes

VAT is stored as a separate assumption and is not automatically included in tax paid.
```

## Cashflow

```text
operating_cashflow =
  EBITDA
  - taxes_paid
  - loan_payments
  - owner_withdrawals
  - working_capital_changes

initial_investment = sum(CAPEX where paid_before_opening = true)
cumulative_cashflow[month] = previous_cumulative_cashflow + monthly_net_cashflow
payback_month = first month where cumulative_cashflow >= 0
ROI = annual_net_profit / initial_investment
```

## Break-even

```text
average_contribution_margin_percent =
  (revenue - food_cost_total - packaging_total - variable_costs) / revenue

break_even_revenue = monthly_fixed_costs / average_contribution_margin_percent
break_even_orders = break_even_revenue / avg_check
break_even_orders_per_day = break_even_orders / working_days_per_month
```
