# ============================================================

# ESTATE ADMIN — Supabase Setup Guide + API Reference

# ============================================================

## ─── STEP 1: CREATE SUPABASE PROJECT ───────────────────────

1. Go to https://supabase.com and sign in (or create an account)
2. Click "New Project"
3. Fill in: Name, Database Password, Region → Click "Create Project"
4. Wait ~2 minutes for setup

## ─── STEP 2: GET YOUR CREDENTIALS ──────────────────────────

In your project dashboard:
→ Settings → API

Copy:

- Project URL → put in config.js as SUPABASE_URL
- anon (public) key → put in config.js as SUPABASE_ANON_KEY

## ─── STEP 3: RUN THIS SQL IN SUPABASE ──────────────────────

Go to: SQL Editor → New Query → Paste all of the below → Run

---

-- PROPERTIES TABLE
CREATE TABLE properties (
id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
title TEXT NOT NULL,
property_type TEXT,
status TEXT,
price NUMERIC,
location TEXT,
description TEXT,
features_description TEXT,
sqft INTEGER,
bedrooms INTEGER,
bathrooms INTEGER,
kitchens INTEGER,
images TEXT[], -- array of public image URLs
floor_plan TEXT, -- single floor plan image URL

-- JSONB columns for structured data
property_details JSONB DEFAULT '{}',
utility_features JSONB DEFAULT '{}',
outdoor_features JSONB DEFAULT '{}',
amenities TEXT[] DEFAULT '{}',
whats_nearby JSONB DEFAULT '{}',
agent JSONB DEFAULT '{}',

created_at TIMESTAMPTZ DEFAULT now(),
updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security but allow all reads (public listings)
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

-- Allow all operations with anon key (since you're using admin-only portal)
CREATE POLICY "Allow all" ON properties
FOR ALL USING (true) WITH CHECK (true);

---

## ─── STEP 4: CREATE STORAGE BUCKET ─────────────────────────

1. In Supabase dashboard → Storage → New Bucket
2. Name: "property-images"
3. Check: Public bucket ✅
4. Click Create

Then set bucket policy — go to Storage → property-images → Policies:
Add policy: "Allow all uploads"

- For INSERT, SELECT, UPDATE, DELETE
- Using: (true)

Or run this SQL:

CREATE POLICY "Public read" ON storage.objects
FOR SELECT USING (bucket_id = 'property-images');

CREATE POLICY "Allow uploads" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'property-images');

CREATE POLICY "Allow updates" ON storage.objects
FOR UPDATE USING (bucket_id = 'property-images');

CREATE POLICY "Allow deletes" ON storage.objects
FOR DELETE USING (bucket_id = 'property-images');

## ─── STEP 5: UPDATE config.js ───────────────────────────────

Open config.js and replace:
SUPABASE_URL → your project URL (e.g. https://abcxyz.supabase.co)
SUPABASE_ANON_KEY → your anon key

## ─── STEP 6: OPEN THE PORTAL ────────────────────────────────

Open index.html in your browser (or serve with any static file server).
Login: admin / admin@123

================================================================
FRONTEND API REFERENCE
(Use these in your public-facing frontend)
================================================================

## JavaScript Setup (same for any frontend)

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
'https://YOUR_PROJECT_ID.supabase.co',
'YOUR_ANON_PUBLIC_KEY'
)

## ─── READ OPERATIONS ─────────────────────────────────────────

### Get all properties (for listing page)

const { data, error } = await supabase
.from('properties')
.select('\*')
.order('created_at', { ascending: false })

### Get properties for sale only

const { data } = await supabase
.from('properties')
.select('\*')
.eq('status', 'For Sale')
.order('created_at', { ascending: false })

### Get properties for rent only

const { data } = await supabase
.from('properties')
.select('\*')
.eq('status', 'For Rent')

### Get single property by ID (for detail page)

const { data } = await supabase
.from('properties')
.select('\*')
.eq('id', propertyId)
.single()

### Filter by type

const { data } = await supabase
.from('properties')
.select('\*')
.eq('property_type', 'Villa') // Apartment, Villa, Loft, Home, etc.

### Filter by price range

const { data } = await supabase
.from('properties')
.select('\*')
.gte('price', 10000)
.lte('price', 100000)

### Filter by bedrooms

const { data } = await supabase
.from('properties')
.select('\*')
.gte('bedrooms', 3)

### Full-text search by title/location

const { data } = await supabase
.from('properties')
.select('\*')
.or(`title.ilike.%${searchQuery}%,location.ilike.%${searchQuery}%`)

### Get only summary fields (for cards — faster)

const { data } = await supabase
.from('properties')
.select('id, title, location, price, status, property_type, sqft, bedrooms, bathrooms, images')

### Paginate (9 per page)

const { data, count } = await supabase
.from('properties')
.select('\*', { count: 'exact' })
.range(0, 8) // page 1: 0-8, page 2: 9-17, etc.

### Combine filters

const { data } = await supabase
.from('properties')
.select('\*')
.eq('status', 'For Sale')
.eq('property_type', 'Apartment')
.gte('bedrooms', 2)
.lte('price', 50000)
.order('price', { ascending: true })

## ─── DATA STRUCTURE ──────────────────────────────────────────

Each property object returned looks like:

{
id: "uuid-...",
title: "Blueberry Villa",
property_type: "Villa",
status: "For Sale", // "For Sale" | "For Rent" | "Sold" | "Rented"
price: 42500,
location: "110015, Taluk, New Delhi, India",
description: "...",
features_description: "...",
sqft: 1570,
bedrooms: 4,
bathrooms: 4,
kitchens: 1,
images: [
"https://YOUR.supabase.co/storage/v1/object/public/property-images/listings/...",
"https://..."
],
floor_plan: "https://...",
property_details: {
floor: "Ground",
furnishing: "Semi Furnished",
year_built: "2010",
garage: "3",
ceiling_height: "3.2m",
renovation: "3.2m"
},
utility_features: {
heating: "Natural gas",
ac: "Yes",
intercom: "Yes",
window_type: "Aluminum frame",
fireplace: "--",
cable_tv: "--",
elevator: "Yes",
wifi: "Yes",
ventilation: "Yes"
},
outdoor_features: {
garage: "Yes",
parking: "Yes",
garden: "30m2",
disabled_access: "Ramp",
pool: "--",
fence: "--",
security: "3 Cameras",
pet_friendly: "Yes"
},
amenities: ["A/C & Heating", "Garages", "Garden", "WiFi"],
whats_nearby: {
school: "0.9km",
grocery: "0.2km",
metro: "0.7km",
gym: "2.3km",
university: "2.7km",
hospital: "1.7km",
mall: "1.1km",
police: "1.2km",
bus: "1.1km",
river: "3.1km",
market: "0.5km"
},
agent: {
name: "Rashed Kabir",
title: "Property Agent & Broker",
email: "akabir770@gmail.com",
phone: "+12347687565",
location: "Spain, Barcelona"
},
created_at: "2024-01-15T10:30:00Z",
updated_at: "2024-01-15T12:00:00Z"
}

## ─── REACT EXAMPLE (listing page) ───────────────────────────

import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

export default function Listings() {
const [properties, setProperties] = useState([])
const [loading, setLoading] = useState(true)

    useEffect(() => {
      async function load() {
        const { data } = await supabase
          .from('properties')
          .select('id, title, location, price, status, property_type, sqft, bedrooms, bathrooms, images')
          .order('created_at', { ascending: false })
        setProperties(data || [])
        setLoading(false)
      }
      load()
    }, [])

    if (loading) return <div>Loading...</div>

    return (
      <div className="grid">
        {properties.map(p => (
          <div key={p.id} className="card">
            <img src={p.images?.[0]} alt={p.title} />
            <h3>{p.title}</h3>
            <p>{p.location}</p>
            <span>${p.price.toLocaleString()}</span>
          </div>
        ))}
      </div>
    )

}
