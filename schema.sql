-- ============================================================
--  EstateAdmin — Full Table Schema (Run this in Supabase SQL Editor)
-- ============================================================

-- Drop existing table if you want a fresh start (CAREFUL: deletes all data)
-- DROP TABLE IF EXISTS properties;

-- Create the properties table
CREATE TABLE IF NOT EXISTS properties (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now(),

  -- Basic Info
  title               TEXT NOT NULL,
  property_type       TEXT,
  status              TEXT,         -- 'For Sale' | 'For Rent' | 'Sold' | 'Rented'
  price               NUMERIC,
  location            TEXT,         -- Full address e.g. "3891 Ranchview Dr. Richardson, California"
  google_maps_url     TEXT,         -- Google Maps link or embed URL

  -- Descriptions
  description         TEXT,         -- Overview description
  features_description TEXT,        -- Property features description

  -- Specs
  sqft                INTEGER,
  bedrooms            INTEGER,
  bathrooms           INTEGER,
  kitchens            INTEGER,

  -- Media
  images              TEXT[],       -- Array of image URLs (max 5)
  floor_plans         TEXT[],       -- Array of floor plan image URLs (max 3) ← NEW (was floor_plan TEXT)
  floor_plan          TEXT,         -- Keep for backward compat (single floor plan)

  -- JSON blobs
  property_details    JSONB,
  utility_features    JSONB,
  outdoor_features    JSONB,
  amenities           TEXT[],
  whats_nearby        JSONB,
  agent               JSONB
);

-- If your table already exists, run these ALTER statements instead:
-- ALTER TABLE properties ADD COLUMN IF NOT EXISTS google_maps_url TEXT;
-- ALTER TABLE properties ADD COLUMN IF NOT EXISTS floor_plans TEXT[];
-- ALTER TABLE properties ADD COLUMN IF NOT EXISTS kitchens INTEGER;

-- Enable Row Level Security (optional but recommended)
-- ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow all for anon" ON properties FOR ALL TO anon USING (true) WITH CHECK (true);

-- ─── property_details JSONB shape ────────────────────────────
-- {
--   "floor": "Ground",
--   "furnishing": "Semi Furnished",
--   "year_built": "2010",
--   "garage": "3",
--   "ceiling_height": "3.2m",
--   "property_type": "Apartment",
--   "renovation": "3.2m"
-- }

-- ─── utility_features JSONB shape ────────────────────────────
-- {
--   "heating": "Natural gas",
--   "ac": "Yes",
--   "intercom": "Yes",
--   "window_type": "Aluminum frame",
--   "fireplace": "--",
--   "cable_tv": "--",
--   "elevator": "Yes",
--   "wifi": "Yes",
--   "ventilation": "Yes"
-- }

-- ─── outdoor_features JSONB shape ────────────────────────────
-- {
--   "garage": "Yes",
--   "parking": "Yes",
--   "garden": "30m2",
--   "disabled_access": "Ramp",
--   "pool": "--",
--   "fence": "--",
--   "security": "3 Cameras",
--   "pet_friendly": "Yes",
--   "bbq_area": "--",
--   "storage": "--",
--   "terrace": "--"
-- }

-- ─── amenities TEXT[] values ──────────────────────────────────
-- "A/C & Heating", "Garages", "Garden", "Disabled Access",
-- "Swimming Pool", "Parking", "WiFi", "Pet Friendly",
-- "Ceiling Height", "Fireplace", "Play Ground", "Elevator",
-- "BBQ Area", "Storage Room", "Terrace", "Laundry Room", "Gym"

-- ─── whats_nearby JSONB shape ─────────────────────────────────
-- {
--   "school": "0.9km",
--   "grocery": "0.2km",
--   "metro": "0.7km",
--   "gym": "2.3km",
--   "university": "2.7km",
--   "hospital": "1.7km",
--   "mall": "1.1km",
--   "police": "1.2km",
--   "bus": "1.1km",
--   "river": "3.1km",
--   "market": "0.5km",
--   "restaurant": "",
--   "park": "",
--   "pharmacy": "",
--   "airport": ""
-- }

-- ─── agent JSONB shape ────────────────────────────────────────
-- {
--   "name": "John Doe",
--   "title": "Property Agent & Broker",
--   "email": "agent@email.com",
--   "phone": "+1234567890",
--   "location": "Spain, Barcelona"
-- }
