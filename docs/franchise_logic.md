# Franchise Logic

Franchise mode is planned as a separate financial layer above the store model.

## Franchisee

```text
franchisee_revenue = store_revenue
royalty = revenue * royalty_rate or fixed_monthly_royalty
marketing_fee = revenue * marketing_fee_rate
franchisee_EBITDA_after_fees = store_EBITDA - royalty - marketing_fee
franchisee_initial_investment = store_CAPEX + lump_sum_fee + opening_support_fee + training_fee
franchisee_payback = first month where cumulative_cashflow >= 0
```

## Franchisor

```text
franchisor_revenue =
  lump_sum_fee
  + royalties
  + marketing_fees
  + supply_chain_markup
  + training_fee
  + opening_support_fee

franchisor_costs =
  monthly_support_cost_per_franchisee
  + franchisor_fixed_team_costs
  + marketing delivery costs, if paid by franchisor

franchisor_EBITDA = franchisor_revenue - franchisor_costs
```

## Current MVP scope

MVP stores all franchise assumptions and shows a basic royalty/marketing fee bridge. Full franchisor cohort economics, franchisee scenarios and management company P&L are reserved for the next stage.
