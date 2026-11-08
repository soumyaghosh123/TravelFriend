-- CreateEnum
CREATE TYPE "PricedMode" AS ENUM ('train', 'bus', 'flight', 'hotel');

-- CreateEnum
CREATE TYPE "TransportMode" AS ENUM ('train', 'bus', 'flight');

-- CreateEnum
CREATE TYPE "ProviderMode" AS ENUM ('train', 'bus', 'flight', 'hotel', 'calendar', 'weather');

-- CreateEnum
CREATE TYPE "ProviderKind" AS ENUM ('mock', 'affiliate', 'api');

-- CreateEnum
CREATE TYPE "FareType" AS ENUM ('free', 'half', 'full');

-- CreateEnum
CREATE TYPE "DaySlot" AS ENUM ('morning', 'afternoon', 'evening');

-- CreateEnum
CREATE TYPE "ItineraryKind" AS ENUM ('attraction', 'meal', 'transfer', 'hotel');

-- CreateEnum
CREATE TYPE "CalendarEventKind" AS ENUM ('festival', 'holiday', 'longWeekend', 'school', 'season', 'local');

-- CreateEnum
CREATE TYPE "VegType" AS ENUM ('veg', 'nonveg', 'both');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "name" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trip" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "inputs" JSONB NOT NULL,
    "selectedPlan" TEXT,
    "startDate" DATE,
    "plans" JSONB,
    "shareSlug" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Trip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripDay" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "dayIndex" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "baseId" TEXT,
    "activeMinutes" INTEGER NOT NULL,
    "estSpend" INTEGER NOT NULL,

    CONSTRAINT "TripDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItineraryItem" (
    "id" TEXT NOT NULL,
    "tripDayId" TEXT NOT NULL,
    "slot" "DaySlot" NOT NULL,
    "kind" "ItineraryKind" NOT NULL,
    "refId" TEXT,
    "startTime" TEXT NOT NULL,
    "durationMin" INTEGER NOT NULL,
    "cost" INTEGER NOT NULL,

    CONSTRAINT "ItineraryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Destination" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'India',
    "isRegion" BOOLEAN NOT NULL DEFAULT false,
    "hubLat" DOUBLE PRECISION NOT NULL,
    "hubLng" DOUBLE PRECISION NOT NULL,
    "seasons" JSONB NOT NULL,
    "candidateBases" TEXT[],

    CONSTRAINT "Destination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Landmark" (
    "id" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Landmark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hotel" (
    "id" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "stars" INTEGER,
    "guestRating" DOUBLE PRECISION,
    "reviewCount" INTEGER,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "amenities" TEXT[],
    "childPolicy" JSONB,
    "restaurantInfo" TEXT,

    CONSTRAINT "Hotel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HotelPrice" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "price" INTEGER NOT NULL,
    "taxes" INTEGER NOT NULL DEFAULT 0,
    "fetchedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HotelPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransportOption" (
    "id" TEXT NOT NULL,
    "mode" "TransportMode" NOT NULL,
    "providerId" TEXT NOT NULL,
    "fromCode" TEXT NOT NULL,
    "toCode" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "depart" TEXT NOT NULL,
    "arrive" TEXT NOT NULL,
    "durationMin" INTEGER NOT NULL,
    "class" TEXT NOT NULL,
    "fare" INTEGER NOT NULL,
    "availability" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransportOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocalTransportOption" (
    "id" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "legType" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "fareMin" INTEGER NOT NULL,
    "fareMax" INTEGER NOT NULL,
    "timeMin" INTEGER NOT NULL,
    "bookingInfo" TEXT,
    "tips" TEXT,

    CONSTRAINT "LocalTransportOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attraction" (
    "id" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "openingHours" JSONB NOT NULL,
    "closedDays" TEXT[],
    "entryFee" INTEGER NOT NULL DEFAULT 0,
    "avgDurationMin" INTEGER NOT NULL,
    "bestTime" TEXT,
    "rating" DOUBLE PRECISION,
    "footfall" TEXT,
    "isOffbeat" BOOLEAN NOT NULL DEFAULT false,
    "roadCondition" TEXT,
    "networkCoverage" TEXT,
    "permitNote" TEXT,

    CONSTRAINT "Attraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Restaurant" (
    "id" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "costForTwo" INTEGER NOT NULL,
    "rating" DOUBLE PRECISION,
    "reviewCount" INTEGER,
    "hours" TEXT,
    "vegType" "VegType" NOT NULL,

    CONSTRAINT "Restaurant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dish" (
    "id" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "vegType" "VegType" NOT NULL,
    "typicalPrice" INTEGER,

    CONSTRAINT "Dish_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shop" (
    "id" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "whatToBuy" TEXT[],
    "priceRange" TEXT,
    "bargaining" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT[],
    "rating" DOUBLE PRECISION,
    "hours" TEXT,
    "closedDays" TEXT[],

    CONSTRAINT "Shop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DosAndDonts" (
    "id" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "lastVerifiedOn" DATE NOT NULL,

    CONSTRAINT "DosAndDonts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarEvent" (
    "id" TEXT NOT NULL,
    "destinationId" TEXT,
    "name" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "kind" "CalendarEventKind" NOT NULL,
    "priceImpact" DOUBLE PRECISION,

    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricingRule" (
    "id" TEXT NOT NULL,
    "mode" "PricedMode" NOT NULL,
    "providerId" TEXT,
    "minAge" INTEGER NOT NULL,
    "maxAge" INTEGER,
    "multiplier" DOUBLE PRECISION NOT NULL,
    "fareType" "FareType" NOT NULL,

    CONSTRAINT "PricingRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceAlert" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "thresholdAmount" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastNotifiedAt" TIMESTAMP(3),

    CONSTRAINT "PriceAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Provider" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mode" "ProviderMode" NOT NULL,
    "kind" "ProviderKind" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "commission" DOUBLE PRECISION,
    "brandingNotes" TEXT,

    CONSTRAINT "Provider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingChecklistItem" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "booked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "BookingChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClickEvent" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "tripId" TEXT,
    "offerRef" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClickEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Trip_shareSlug_key" ON "Trip"("shareSlug");

-- CreateIndex
CREATE INDEX "Trip_userId_idx" ON "Trip"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TripDay_tripId_dayIndex_key" ON "TripDay"("tripId", "dayIndex");

-- CreateIndex
CREATE INDEX "ItineraryItem_tripDayId_idx" ON "ItineraryItem"("tripDayId");

-- CreateIndex
CREATE UNIQUE INDEX "Destination_slug_key" ON "Destination"("slug");

-- CreateIndex
CREATE INDEX "Landmark_destinationId_idx" ON "Landmark"("destinationId");

-- CreateIndex
CREATE INDEX "Hotel_destinationId_idx" ON "Hotel"("destinationId");

-- CreateIndex
CREATE UNIQUE INDEX "HotelPrice_hotelId_providerId_date_key" ON "HotelPrice"("hotelId", "providerId", "date");

-- CreateIndex
CREATE INDEX "TransportOption_fromCode_toCode_date_mode_idx" ON "TransportOption"("fromCode", "toCode", "date", "mode");

-- CreateIndex
CREATE INDEX "LocalTransportOption_destinationId_idx" ON "LocalTransportOption"("destinationId");

-- CreateIndex
CREATE INDEX "Attraction_destinationId_idx" ON "Attraction"("destinationId");

-- CreateIndex
CREATE INDEX "Restaurant_destinationId_idx" ON "Restaurant"("destinationId");

-- CreateIndex
CREATE INDEX "Dish_destinationId_idx" ON "Dish"("destinationId");

-- CreateIndex
CREATE INDEX "Shop_destinationId_idx" ON "Shop"("destinationId");

-- CreateIndex
CREATE INDEX "DosAndDonts_destinationId_idx" ON "DosAndDonts"("destinationId");

-- CreateIndex
CREATE INDEX "CalendarEvent_destinationId_startDate_idx" ON "CalendarEvent"("destinationId", "startDate");

-- CreateIndex
CREATE INDEX "PricingRule_mode_providerId_idx" ON "PricingRule"("mode", "providerId");

-- CreateIndex
CREATE UNIQUE INDEX "BookingChecklistItem_tripId_itemKey_key" ON "BookingChecklistItem"("tripId", "itemKey");

-- CreateIndex
CREATE INDEX "ClickEvent_providerId_createdAt_idx" ON "ClickEvent"("providerId", "createdAt");

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripDay" ADD CONSTRAINT "TripDay_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItineraryItem" ADD CONSTRAINT "ItineraryItem_tripDayId_fkey" FOREIGN KEY ("tripDayId") REFERENCES "TripDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Landmark" ADD CONSTRAINT "Landmark_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hotel" ADD CONSTRAINT "Hotel_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelPrice" ADD CONSTRAINT "HotelPrice_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelPrice" ADD CONSTRAINT "HotelPrice_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportOption" ADD CONSTRAINT "TransportOption_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocalTransportOption" ADD CONSTRAINT "LocalTransportOption_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attraction" ADD CONSTRAINT "Attraction_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Restaurant" ADD CONSTRAINT "Restaurant_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dish" ADD CONSTRAINT "Dish_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shop" ADD CONSTRAINT "Shop_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DosAndDonts" ADD CONSTRAINT "DosAndDonts_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PricingRule" ADD CONSTRAINT "PricingRule_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceAlert" ADD CONSTRAINT "PriceAlert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceAlert" ADD CONSTRAINT "PriceAlert_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingChecklistItem" ADD CONSTRAINT "BookingChecklistItem_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClickEvent" ADD CONSTRAINT "ClickEvent_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClickEvent" ADD CONSTRAINT "ClickEvent_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE SET NULL ON UPDATE CASCADE;
