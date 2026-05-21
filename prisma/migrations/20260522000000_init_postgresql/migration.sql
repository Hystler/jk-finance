-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "salePrice" DOUBLE PRECISION NOT NULL,
    "imageUrl" TEXT,
    "productUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "taxRate" DOUBLE PRECISION,
    "deliveryAvailable" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "sourceNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ingredient" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "supplier" TEXT,
    "purchasePrice" DOUBLE PRECISION NOT NULL,
    "purchaseUnit" TEXT NOT NULL,
    "edibleYieldPercent" DOUBLE PRECISION,
    "storageLossPercent" DOUBLE PRECISION,
    "category" TEXT,
    "comment" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ingredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeItem" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "ingredientId" TEXT,
    "ingredientName" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION,
    "unit" TEXT,
    "grossWeightGrams" DOUBLE PRECISION,
    "netWeightGrams" DOUBLE PRECISION,
    "yieldLossPercent" DOUBLE PRECISION,
    "unitPurchasePrice" DOUBLE PRECISION,
    "unitMeasure" TEXT,
    "costPerUnit" DOUBLE PRECISION,
    "totalIngredientCost" DOUBLE PRECISION,
    "comment" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',

    CONSTRAINT "RecipeItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Packaging" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "costPerUnit" DOUBLE PRECISION NOT NULL,
    "usedForCategory" TEXT,
    "supplier" TEXT,
    "comment" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',

    CONSTRAINT "Packaging_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductPackaging" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "packagingId" TEXT NOT NULL,
    "units" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "comment" TEXT,

    CONSTRAINT "ProductPackaging_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreInput" (
    "id" TEXT NOT NULL,
    "location" TEXT,
    "formatType" TEXT NOT NULL DEFAULT 'delivery',
    "areaM2" DOUBLE PRECISION,
    "seatsCount" INTEGER,
    "workingDaysPerMonth" INTEGER NOT NULL DEFAULT 0,
    "workingHoursPerDay" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgOrdersPerDay" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgItemsPerOrder" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgCheck" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deliveryShare" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "aggregatorShare" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ownDeliveryShare" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pickupShare" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "acquiringRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "aggregatorCommissionRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deliveryLogisticsCostPerOrder" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "marketingCostPerItem" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ownerWithdrawalsMonthly" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "loanPaymentsMonthly" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "workingCapitalChangeMonthly" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'ASSUMPTION',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreInput_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpexItem" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "behavior" TEXT NOT NULL DEFAULT 'FIXED',
    "driver" TEXT NOT NULL DEFAULT 'FIXED',
    "comment" TEXT,
    "source" TEXT NOT NULL DEFAULT 'ASSUMPTION',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpexItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CapexItem" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "usefulLifeMonths" INTEGER,
    "supplierComment" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "paidBeforeOpening" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT NOT NULL DEFAULT 'ASSUMPTION',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CapexItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxSettings" (
    "id" TEXT NOT NULL,
    "taxSystem" TEXT,
    "revenueTaxRate" DOUBLE PRECISION,
    "profitTaxRate" DOUBLE PRECISION,
    "payrollTaxRate" DOUBLE PRECISION,
    "vatRate" DOUBLE PRECISION,
    "otherTaxes" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'ASSUMPTION',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FranchiseSettings" (
    "id" TEXT NOT NULL,
    "lumpSumFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "royaltyType" TEXT NOT NULL DEFAULT 'percent_of_revenue',
    "royaltyRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fixedMonthlyRoyalty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "marketingFeeRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "supplyChainMarkup" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "trainingFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "openingSupportFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "monthlySupportCostPerFranchisee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "franchisorFixedTeamCosts" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "openingInventory" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "launchMarketing" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rentDeposit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "contingencyAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "contingencyPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "loanAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "loanPaymentsMonthly" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ownerWithdrawalsMonthly" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "numberOfFranchisees" INTEGER NOT NULL DEFAULT 1,
    "monthlyFixedFees" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "franchiseWorkingDaysPerMonth" INTEGER NOT NULL DEFAULT 0,
    "franchiseAvgOrdersPerDay" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "franchiseAvgItemsPerOrder" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "franchiseAvgCheck" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "franchiseDeliverySharePercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "franchiseAggregatorSharePercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "franchiseAcquiringRatePercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "franchiseAggregatorCommissionPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "franchiseLogisticsPerOrder" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "franchiseMarketingPerSku" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "franchiseRevenueTaxRatePercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "franchiseProfitTaxRatePercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "franchiseVatRatePercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "franchiseOtherTaxesPerMonth" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "franchiseLoanPaymentsPerMonth" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "franchiseOwnerWithdrawalsPerMonth" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "franchiseRent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "franchisePayroll" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "franchiseUtilities" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "franchiseSoftware" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "franchiseAccounting" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "franchiseRepairs" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "franchiseOtherFixedOpex" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "forecastMonths" INTEGER NOT NULL DEFAULT 24,
    "revenueTrendType" TEXT NOT NULL DEFAULT 'flat',
    "monthlyGrowthRatePercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "monthlyDeclineRatePercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rampUpMonths" INTEGER NOT NULL DEFAULT 6,
    "rampUpStartPercent" DOUBLE PRECISION NOT NULL DEFAULT 60,
    "seasonalityEnabled" BOOLEAN NOT NULL DEFAULT false,
    "franchiseInputsCopiedFromStore" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'ASSUMPTION',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FranchiseSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assumption" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "field" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "unit" TEXT,
    "source" TEXT NOT NULL DEFAULT 'ASSUMPTION',
    "note" TEXT,
    "productId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assumption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Product_productUrl_key" ON "Product"("productUrl");

-- CreateIndex
CREATE UNIQUE INDEX "Product_category_name_key" ON "Product"("category", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Ingredient_name_key" ON "Ingredient"("name");

-- AddForeignKey
ALTER TABLE "RecipeItem" ADD CONSTRAINT "RecipeItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeItem" ADD CONSTRAINT "RecipeItem_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductPackaging" ADD CONSTRAINT "ProductPackaging_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductPackaging" ADD CONSTRAINT "ProductPackaging_packagingId_fkey" FOREIGN KEY ("packagingId") REFERENCES "Packaging"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assumption" ADD CONSTRAINT "Assumption_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

