# Data Dictionary

## Product / SKU

`id`, `category`, `name`, `description`, `sale_price`, `image_url`, `product_url`, `is_active`, `tax_rate`, `delivery_available`, `source`, `created_at`, `updated_at`.

## Recipe / BOM

`product_id`, `ingredient_id`, `ingredient_name`, `gross_weight_grams`, `net_weight_grams`, `yield_loss_percent`, `unit_purchase_price`, `unit_measure`, `cost_per_unit`, `total_ingredient_cost`, `source`.

## Ingredient

`id`, `name`, `supplier`, `purchase_price`, `purchase_unit`, `edible_yield_percent`, `storage_loss_percent`, `category`, `source`, `last_updated_at`.

## Packaging

`id`, `name`, `cost_per_unit`, `used_for_category`, `supplier`, `source`.

## Store Inputs

`location`, `format_type`, `area_m2`, `seats_count`, `working_days_per_month`, `working_hours_per_day`, `avg_orders_per_day`, `avg_items_per_order`, `avg_check`, `delivery_share`, `aggregator_share`, `own_delivery_share`, `pickup_share`, `acquiring_rate`, `aggregator_commission_rate`.

## OPEX

`category`, `amount`, `behavior`, `driver`, `comment`, `source`.

## CAPEX

`category`, `amount`, `useful_life_months`, `supplier_comment`, `required`, `paid_before_opening`, `source`.

## Tax Settings

`tax_system`, `revenue_tax_rate`, `profit_tax_rate`, `payroll_tax_rate`, `vat_rate`, `other_taxes`, `source`.

## Franchise Settings

`lump_sum_fee`, `royalty_type`, `royalty_rate`, `fixed_monthly_royalty`, `marketing_fee_rate`, `supply_chain_markup`, `training_fee`, `opening_support_fee`, `monthly_support_cost_per_franchisee`, `franchisor_fixed_team_costs`.
