// ============================================================
//  ESTATE ADMIN — Main Application Logic
// ============================================================

// Hard-coded credentials
const ADMIN_USER = "admin";
const ADMIN_PASS = "admin@123";

// State
let allProperties = [];
let pendingImages = []; // new property image File objects
let pendingFloorPlans = []; // new floor plan File objects
let deleteTargetId = null;
let removedExistingImages = []; // property image URLs to delete from storage
let removedExistingFloorPlans = []; // floor plan URLs to delete from storage

const MAX_IMAGES = 5;
const MAX_FLOOR_PLANS = 3;

// ─── AUTH ────────────────────────────────────────────────────
function doLogin() {
  const u = document.getElementById("loginUser").value.trim();
  const p = document.getElementById("loginPass").value.trim();
  if (u === ADMIN_USER && p === ADMIN_PASS) {
    document.getElementById("loginScreen").classList.add("hidden");
    document.getElementById("portal").classList.remove("hidden");
    loadListings();
  } else {
    document.getElementById("loginError").classList.remove("hidden");
  }
}

document.getElementById("loginPass").addEventListener("keydown", (e) => {
  if (e.key === "Enter") doLogin();
});

function doLogout() {
  document.getElementById("portal").classList.add("hidden");
  document.getElementById("loginScreen").classList.remove("hidden");
  document.getElementById("loginUser").value = "";
  document.getElementById("loginPass").value = "";
}

// ─── PAGE NAVIGATION ─────────────────────────────────────────
function showPage(name, skipReset = false) {
  document.querySelectorAll(".page").forEach((p) => p.classList.add("hidden"));
  document
    .querySelectorAll(".nav-item")
    .forEach((n) => n.classList.remove("active"));
  document.getElementById("page-" + name).classList.remove("hidden");

  if (name === "listings") {
    document
      .querySelector("[onclick=\"showPage('listings')\"]")
      .classList.add("active");
  } else if (name === "add") {
    document
      .querySelector("[onclick=\"showPage('add')\"]")
      .classList.add("active");
    if (!skipReset) {
      resetForm();
      document.getElementById("formTitle").textContent = "Add New Property";
      document.getElementById("editingId").value = "";
    }
  }
}

// ─── LISTINGS ────────────────────────────────────────────────
async function loadListings() {
  try {
    const { data, error } = await supabase
      .from("properties")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    allProperties = data || [];
    renderListings(allProperties);
  } catch (err) {
    showToast("Error loading listings: " + err.message, "error");
    document.getElementById("propertiesGrid").innerHTML =
      `<div class="empty-state"><p>⚠ Could not load properties. Check your Supabase config.</p></div>`;
  }
}

function renderListings(properties) {
  const grid = document.getElementById("propertiesGrid");
  document.getElementById("listingCount").textContent =
    `${properties.length} propert${properties.length !== 1 ? "ies" : "y"} found`;

  if (!properties.length) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-icon">🏘</div><p>No properties found</p><button class="btn-primary" onclick="showPage('add')">Add your first property</button></div>`;
    return;
  }

  grid.innerHTML = properties
    .map((p) => {
      const images = p.images || [];
      const thumb = images.length ? images[0] : null;
      const statusClass =
        p.status === "For Sale"
          ? "status-sale"
          : p.status === "For Rent"
            ? "status-rent"
            : "status-other";
      const price =
        p.status === "For Rent"
          ? `$${Number(p.price).toLocaleString()} / mo`
          : `$${Number(p.price).toLocaleString()}`;

      return `
    <div class="property-card" onclick="viewProperty('${p.id}')">
      <div class="card-image">
        ${
          thumb
            ? `<img src="${thumb}" alt="${p.title}" loading="lazy" />`
            : `<div class="no-image">🏠</div>`
        }
        <span class="status-badge ${statusClass}">${p.status || "N/A"}</span>
        <div class="card-actions" onclick="event.stopPropagation()">
          <button class="card-btn edit" onclick="editProperty('${p.id}')">✏</button>
          <button class="card-btn del" onclick="openDeleteModal('${p.id}')">🗑</button>
        </div>
      </div>
      <div class="card-body">
        <h3 class="card-title">${p.title}</h3>
        <p class="card-location">📍 ${p.location || "Location not set"}</p>
        <div class="card-specs">
          ${p.sqft ? `<span>⬜ ${p.sqft} sqft</span>` : ""}
          ${p.bedrooms ? `<span>🛏 ${String(p.bedrooms).padStart(2, "0")} bed</span>` : ""}
          ${p.bathrooms ? `<span>🚿 ${String(p.bathrooms).padStart(2, "0")} bath</span>` : ""}
          ${p.kitchens ? `<span>🍳 ${String(p.kitchens).padStart(2, "0")} kit</span>` : ""}
        </div>
        <div class="card-footer">
          <span class="card-price">${price}</span>
          <span class="card-type">${p.property_type || ""}</span>
        </div>
      </div>
    </div>`;
    })
    .join("");
}

function filterListings() {
  const search = document.getElementById("searchInput").value.toLowerCase();
  const status = document.getElementById("statusFilter").value;
  const type = document.getElementById("typeFilter").value;

  const filtered = allProperties.filter((p) => {
    const matchSearch =
      !search ||
      p.title?.toLowerCase().includes(search) ||
      p.location?.toLowerCase().includes(search);
    const matchStatus = !status || p.status === status;
    const matchType = !type || p.property_type === type;
    return matchSearch && matchStatus && matchType;
  });
  renderListings(filtered);
}

// ─── FORM RESET ───────────────────────────────────────────────
function resetForm() {
  const ids = [
    "f_title",
    "f_type",
    "f_status",
    "f_price",
    "f_location",
    "f_google_maps_url",
    "f_description",
    "f_features_desc",
    "f_sqft",
    "f_bedrooms",
    "f_bathrooms",
    "f_kitchens",
    // property details
    "pd_bedrooms",
    "pd_bathrooms",
    "pd_furnishing",
    "pd_year_built",
    "pd_floor",
    "pd_garage",
    "pd_ceiling_height",
    "pd_property_type",
    "pd_renovation",
    "pd_status",
    "pd_total_floors",
    "pd_lot_size",
    // utility features
    "uf_heating",
    "uf_ac",
    "uf_intercom",
    "uf_window_type",
    "uf_fireplace",
    "uf_cable_tv",
    "uf_elevator",
    "uf_wifi",
    "uf_ventilation",
    "uf_solar",
    "uf_smart_home",
    "uf_generator",
    // outdoor features
    "of_garage",
    "of_parking",
    "of_garden",
    "of_disabled_access",
    "of_pool",
    "of_fence",
    "of_security",
    "of_pet_friendly",
    "of_bbq",
    "of_storage",
    "of_terrace",
    "of_sports_court",
    // nearby
    "nb_school",
    "nb_grocery",
    "nb_metro",
    "nb_gym",
    "nb_university",
    "nb_hospital",
    "nb_mall",
    "nb_police",
    "nb_bus",
    "nb_river",
    "nb_market",
    "nb_restaurant",
    "nb_park",
    "nb_pharmacy",
    "nb_airport",
    // (no agent fields)
  ];

  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Reset checkboxes
  document
    .querySelectorAll('.amenities-grid input[type="checkbox"]')
    .forEach((cb) => (cb.checked = false));

  pendingImages = [];
  pendingFloorPlans = [];
  removedExistingImages = [];
  removedExistingFloorPlans = [];

  document.getElementById("imagePreviewGrid").innerHTML = "";
  document.getElementById("existingImages").innerHTML = "";
  document.getElementById("floorPreviewGrid").innerHTML = "";
  document.getElementById("existingFloorPlans").innerHTML = "";
  document.getElementById("formError").classList.add("hidden");

  updateImageCountBadge();
  updateFloorPlanCountBadge();
}

// ─── COUNT BADGES ─────────────────────────────────────────────
function updateImageCountBadge() {
  const existing = document.querySelectorAll(
    "#existingImages .preview-thumb",
  ).length;
  const total = existing + pendingImages.length;
  document.getElementById("imgCountBadge").textContent =
    `${total} / ${MAX_IMAGES}`;
}

function updateFloorPlanCountBadge() {
  const existing = document.querySelectorAll(
    "#existingFloorPlans .preview-thumb",
  ).length;
  const total = existing + pendingFloorPlans.length;
  document.getElementById("fpCountBadge").textContent =
    `${total} / ${MAX_FLOOR_PLANS}`;
}

// ─── PROPERTY IMAGE HANDLING ──────────────────────────────────
function handleImageSelect(e) {
  const files = Array.from(e.target.files);
  const existingCount = document.querySelectorAll(
    "#existingImages .preview-thumb",
  ).length;
  const remaining = MAX_IMAGES - existingCount - pendingImages.length;

  if (remaining <= 0) {
    showToast(`Maximum ${MAX_IMAGES} images allowed per property.`, "error");
    e.target.value = "";
    return;
  }

  const allowed = files.slice(0, remaining);
  if (files.length > remaining) {
    showToast(
      `Only ${remaining} more image(s) allowed. ${files.length - remaining} skipped.`,
      "info",
    );
  }

  allowed.forEach((file) => {
    pendingImages.push(file);
    const idx = pendingImages.length - 1;
    const reader = new FileReader();
    reader.onload = (ev) =>
      addImagePreview(ev.target.result, idx, "p", "imagePreviewGrid", "image");
    reader.readAsDataURL(file);
  });
  e.target.value = "";
}

// ─── FLOOR PLAN HANDLING ──────────────────────────────────────
function handleFloorPlanSelect(e) {
  const files = Array.from(e.target.files);
  const existingCount = document.querySelectorAll(
    "#existingFloorPlans .preview-thumb",
  ).length;
  const remaining = MAX_FLOOR_PLANS - existingCount - pendingFloorPlans.length;

  if (remaining <= 0) {
    showToast(`Maximum ${MAX_FLOOR_PLANS} floor plans allowed.`, "error");
    e.target.value = "";
    return;
  }

  const allowed = files.slice(0, remaining);
  if (files.length > remaining) {
    showToast(
      `Only ${remaining} more floor plan(s) allowed. ${files.length - remaining} skipped.`,
      "info",
    );
  }

  allowed.forEach((file) => {
    pendingFloorPlans.push(file);
    const idx = pendingFloorPlans.length - 1;
    const reader = new FileReader();
    reader.onload = (ev) =>
      addImagePreview(
        ev.target.result,
        idx,
        "p",
        "floorPreviewGrid",
        "floorplan",
      );
    reader.readAsDataURL(file);
  });
  e.target.value = "";
}

function addImagePreview(src, idx, type, gridId, kind) {
  const grid = document.getElementById(gridId);
  const wrapper = document.createElement("div");
  wrapper.className = "preview-thumb";
  wrapper.id = `prev-${kind}-${type}-${idx}`;
  wrapper.innerHTML = `
    <img src="${src}" alt="preview" />
    <button class="remove-img" onclick="removePendingItem('${kind}', ${idx})">✕</button>
  `;
  grid.appendChild(wrapper);
  kind === "image" ? updateImageCountBadge() : updateFloorPlanCountBadge();
}

function removePendingItem(kind, idx) {
  if (kind === "image") {
    pendingImages.splice(idx, 1);
    // Re-render all pending image previews
    document.getElementById("imagePreviewGrid").innerHTML = "";
    pendingImages.forEach((file, i) => {
      const reader = new FileReader();
      reader.onload = (ev) =>
        addImagePreview(ev.target.result, i, "p", "imagePreviewGrid", "image");
      reader.readAsDataURL(file);
    });
    updateImageCountBadge();
  } else {
    pendingFloorPlans.splice(idx, 1);
    document.getElementById("floorPreviewGrid").innerHTML = "";
    pendingFloorPlans.forEach((file, i) => {
      const reader = new FileReader();
      reader.onload = (ev) =>
        addImagePreview(
          ev.target.result,
          i,
          "p",
          "floorPreviewGrid",
          "floorplan",
        );
      reader.readAsDataURL(file);
    });
    updateFloorPlanCountBadge();
  }
}

function removeExistingImage(url, idx) {
  removedExistingImages.push(url);
  const el = document.getElementById(`prev-image-e-${idx}`);
  if (el) el.remove();
  updateImageCountBadge();
}

function removeExistingFloorPlan(url, idx) {
  removedExistingFloorPlans.push(url);
  const el = document.getElementById(`prev-floorplan-e-${idx}`);
  if (el) el.remove();
  updateFloorPlanCountBadge();
}

// ─── STORAGE ──────────────────────────────────────────────────
async function uploadImage(file, folder) {
  const ext = file.name.split(".").pop();
  const filename = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(filename, file, { cacheControl: "3600", upsert: false });

  if (error) throw error;

  const { data: urlData } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(filename);

  return urlData.publicUrl;
}

async function deleteImageFromStorage(url) {
  try {
    const path = url.split(`/${STORAGE_BUCKET}/`)[1];
    if (path) await supabase.storage.from(STORAGE_BUCKET).remove([path]);
  } catch (e) {
    console.warn("Could not delete image from storage:", e);
  }
}

// ─── COLLECT FORM DATA ────────────────────────────────────────
function getVal(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : "";
}

function collectFormData() {
  const amenityMap = {
    am_ac_heating: "A/C & Heating",
    am_garages: "Garages",
    am_garden: "Garden",
    am_disabled_access: "Disabled Access",
    am_pool: "Swimming Pool",
    am_parking: "Parking",
    am_wifi: "WiFi",
    am_pet: "Pet Friendly",
    am_ceiling: "Ceiling Height",
    am_fireplace: "Fireplace",
    am_playground: "Play Ground",
    am_elevator: "Elevator",
    am_bbq: "BBQ Area",
    am_storage: "Storage Room",
    am_terrace: "Terrace",
    am_laundry: "Laundry Room",
    am_gym: "Gym / Fitness",
    am_solar: "Solar Panels",
  };

  const amenities = [];
  Object.entries(amenityMap).forEach(([id, label]) => {
    if (document.getElementById(id)?.checked) amenities.push(label);
  });

  return {
    title: getVal("f_title"),
    property_type: getVal("f_type"),
    status: getVal("f_status"),
    price: parseFloat(getVal("f_price")) || 0,
    location: getVal("f_location"),
    google_maps_url: getVal("f_google_maps_url"),
    description: getVal("f_description"),
    features_description: getVal("f_features_desc"),
    sqft: parseInt(getVal("f_sqft")) || null,
    bedrooms: parseInt(getVal("f_bedrooms")) || null,
    bathrooms: parseInt(getVal("f_bathrooms")) || null,
    kitchens: parseInt(getVal("f_kitchens")) || null,

    property_details: {
      bedrooms: getVal("pd_bedrooms"),
      bathrooms: getVal("pd_bathrooms"),
      furnishing: getVal("pd_furnishing"),
      year_built: getVal("pd_year_built"),
      floor: getVal("pd_floor"),
      garage: getVal("pd_garage"),
      ceiling_height: getVal("pd_ceiling_height"),
      property_type: getVal("pd_property_type"),
      renovation: getVal("pd_renovation"),
      status: getVal("pd_status"),
      total_floors: getVal("pd_total_floors"),
      lot_size: getVal("pd_lot_size"),
    },

    utility_features: {
      heating: getVal("uf_heating"),
      ac: getVal("uf_ac"),
      intercom: getVal("uf_intercom"),
      window_type: getVal("uf_window_type"),
      fireplace: getVal("uf_fireplace"),
      cable_tv: getVal("uf_cable_tv"),
      elevator: getVal("uf_elevator"),
      wifi: getVal("uf_wifi"),
      ventilation: getVal("uf_ventilation"),
      solar: getVal("uf_solar"),
      smart_home: getVal("uf_smart_home"),
      generator: getVal("uf_generator"),
    },

    outdoor_features: {
      garage: getVal("of_garage"),
      parking: getVal("of_parking"),
      garden: getVal("of_garden"),
      disabled_access: getVal("of_disabled_access"),
      pool: getVal("of_pool"),
      fence: getVal("of_fence"),
      security: getVal("of_security"),
      pet_friendly: getVal("of_pet_friendly"),
      bbq: getVal("of_bbq"),
      storage: getVal("of_storage"),
      terrace: getVal("of_terrace"),
      sports_court: getVal("of_sports_court"),
    },

    amenities,

    whats_nearby: {
      school: getVal("nb_school"),
      grocery: getVal("nb_grocery"),
      metro: getVal("nb_metro"),
      gym: getVal("nb_gym"),
      university: getVal("nb_university"),
      hospital: getVal("nb_hospital"),
      mall: getVal("nb_mall"),
      police: getVal("nb_police"),
      bus: getVal("nb_bus"),
      river: getVal("nb_river"),
      market: getVal("nb_market"),
      restaurant: getVal("nb_restaurant"),
      park: getVal("nb_park"),
      pharmacy: getVal("nb_pharmacy"),
      airport: getVal("nb_airport"),
    },
  };
}

// ─── SAVE PROPERTY ────────────────────────────────────────────
async function saveProperty() {
  const data = collectFormData();

  if (!data.title) {
    showFormError("Property name is required.");
    return;
  }
  if (!data.price) {
    showFormError("Property price is required.");
    return;
  }

  const btn = document.getElementById("saveBtn");
  const btnText = document.getElementById("saveBtnText");
  btn.disabled = true;
  btnText.textContent = "Saving...";

  try {
    const editId = document.getElementById("editingId").value;
    let newImageUrls = [];
    let newFloorPlanUrls = [];

    // Upload new property images
    if (pendingImages.length > 0) {
      showToast("Uploading images...", "info");
      for (const file of pendingImages) {
        newImageUrls.push(await uploadImage(file, "listings"));
      }
    }

    // Upload new floor plans
    if (pendingFloorPlans.length > 0) {
      showToast("Uploading floor plans...", "info");
      for (const file of pendingFloorPlans) {
        newFloorPlanUrls.push(await uploadImage(file, "floorplans"));
      }
    }

    // Delete removed images from storage
    for (const url of removedExistingImages) await deleteImageFromStorage(url);
    for (const url of removedExistingFloorPlans)
      await deleteImageFromStorage(url);

    if (editId) {
      // EDIT — deep merge: start from existing record, overlay only non-empty form values
      const existing = allProperties.find((p) => p.id === editId);
      const keptImages = (existing?.images || []).filter(
        (u) => !removedExistingImages.includes(u),
      );
      const keptFloors = (existing?.floor_plans || []).filter(
        (u) => !removedExistingFloorPlans.includes(u),
      );

      // Helper: merge two objects, keeping existing value when new value is empty/null/undefined
      const mergeObj = (existing = {}, incoming = {}) => {
        const result = { ...existing };
        Object.entries(incoming).forEach(([k, v]) => {
          if (v !== null && v !== undefined && v !== "") result[k] = v;
        });
        return result;
      };

      // Build the patch — scalar fields
      const patch = {};
      const scalarKeys = [
        "title",
        "property_type",
        "status",
        "price",
        "location",
        "google_maps_url",
        "description",
        "features_description",
        "sqft",
        "bedrooms",
        "bathrooms",
        "kitchens",
      ];
      scalarKeys.forEach((k) => {
        const v = data[k];
        // for numbers, 0 is falsy but valid; use null check
        if (v !== null && v !== undefined && v !== "") patch[k] = v;
      });

      // Deep-merge JSONB blobs
      patch.property_details = mergeObj(
        existing?.property_details,
        data.property_details,
      );
      patch.utility_features = mergeObj(
        existing?.utility_features,
        data.utility_features,
      );
      patch.outdoor_features = mergeObj(
        existing?.outdoor_features,
        data.outdoor_features,
      );
      patch.whats_nearby = mergeObj(existing?.whats_nearby, data.whats_nearby);

      // Amenities: only update if at least one checkbox was touched (array length > 0 OR user cleared all)
      // We always write amenities since checkboxes are always visible and reflect user intent
      patch.amenities = data.amenities;

      // Images
      patch.images = [...keptImages, ...newImageUrls];
      patch.floor_plans = [...keptFloors, ...newFloorPlanUrls];
      patch.floor_plan = patch.floor_plans[0] || existing?.floor_plan || null;
      patch.updated_at = new Date().toISOString();

      const { error } = await supabase
        .from("properties")
        .update(patch)
        .eq("id", editId);
      if (error) throw error;
      showToast("Property updated successfully!", "success");
    } else {
      // ADD
      data.images = newImageUrls;
      data.floor_plans = newFloorPlanUrls;
      data.floor_plan = newFloorPlanUrls[0] || null;
      data.created_at = new Date().toISOString();

      const { error } = await supabase.from("properties").insert([data]);
      if (error) throw error;
      showToast("Property added successfully!", "success");
    }

    await loadListings();
    showPage("listings");
  } catch (err) {
    showFormError("Error saving property: " + err.message);
    console.error(err);
  } finally {
    btn.disabled = false;
    btnText.textContent = "💾 Save Property";
  }
}

// ─── EDIT PROPERTY ────────────────────────────────────────────
function editProperty(id) {
  const p = allProperties.find((x) => x.id === id);
  if (!p) return;

  resetForm();
  document.getElementById("editingId").value = id;

  const setVal = (elId, val) => {
    const el = document.getElementById(elId);
    if (el && val !== undefined && val !== null) el.value = val;
  };

  // Basic
  setVal("f_title", p.title);
  setVal("f_type", p.property_type);
  setVal("f_status", p.status);
  setVal("f_price", p.price);
  setVal("f_location", p.location);
  setVal("f_google_maps_url", p.google_maps_url);
  setVal("f_description", p.description);
  setVal("f_features_desc", p.features_description);
  setVal("f_sqft", p.sqft);
  setVal("f_bedrooms", p.bedrooms);
  setVal("f_bathrooms", p.bathrooms);
  setVal("f_kitchens", p.kitchens);

  // Property details
  const pd = p.property_details || {};
  setVal("pd_bedrooms", pd.bedrooms);
  setVal("pd_bathrooms", pd.bathrooms);
  setVal("pd_furnishing", pd.furnishing);
  setVal("pd_year_built", pd.year_built);
  setVal("pd_floor", pd.floor);
  setVal("pd_garage", pd.garage);
  setVal("pd_ceiling_height", pd.ceiling_height);
  setVal("pd_property_type", pd.property_type);
  setVal("pd_renovation", pd.renovation);
  setVal("pd_status", pd.status);
  setVal("pd_total_floors", pd.total_floors);
  setVal("pd_lot_size", pd.lot_size);

  // Utility
  const uf = p.utility_features || {};
  setVal("uf_heating", uf.heating);
  setVal("uf_ac", uf.ac);
  setVal("uf_intercom", uf.intercom);
  setVal("uf_window_type", uf.window_type);
  setVal("uf_fireplace", uf.fireplace);
  setVal("uf_cable_tv", uf.cable_tv);
  setVal("uf_elevator", uf.elevator);
  setVal("uf_wifi", uf.wifi);
  setVal("uf_ventilation", uf.ventilation);
  setVal("uf_solar", uf.solar);
  setVal("uf_smart_home", uf.smart_home);
  setVal("uf_generator", uf.generator);

  // Outdoor
  const of_ = p.outdoor_features || {};
  setVal("of_garage", of_.garage);
  setVal("of_parking", of_.parking);
  setVal("of_garden", of_.garden);
  setVal("of_disabled_access", of_.disabled_access);
  setVal("of_pool", of_.pool);
  setVal("of_fence", of_.fence);
  setVal("of_security", of_.security);
  setVal("of_pet_friendly", of_.pet_friendly);
  setVal("of_bbq", of_.bbq);
  setVal("of_storage", of_.storage);
  setVal("of_terrace", of_.terrace);
  setVal("of_sports_court", of_.sports_court);

  // Amenities
  const amMapReverse = {
    "A/C & Heating": "am_ac_heating",
    Garages: "am_garages",
    Garden: "am_garden",
    "Disabled Access": "am_disabled_access",
    "Swimming Pool": "am_pool",
    Parking: "am_parking",
    WiFi: "am_wifi",
    "Pet Friendly": "am_pet",
    "Ceiling Height": "am_ceiling",
    Fireplace: "am_fireplace",
    "Play Ground": "am_playground",
    Elevator: "am_elevator",
    "BBQ Area": "am_bbq",
    "Storage Room": "am_storage",
    Terrace: "am_terrace",
    "Laundry Room": "am_laundry",
    "Gym / Fitness": "am_gym",
    "Solar Panels": "am_solar",
  };
  (p.amenities || []).forEach((a) => {
    const el = document.getElementById(amMapReverse[a]);
    if (el) el.checked = true;
  });

  // Nearby
  const nb = p.whats_nearby || {};
  setVal("nb_school", nb.school);
  setVal("nb_grocery", nb.grocery);
  setVal("nb_metro", nb.metro);
  setVal("nb_gym", nb.gym);
  setVal("nb_university", nb.university);
  setVal("nb_hospital", nb.hospital);
  setVal("nb_mall", nb.mall);
  setVal("nb_police", nb.police);
  setVal("nb_bus", nb.bus);
  setVal("nb_river", nb.river);
  setVal("nb_market", nb.market);
  setVal("nb_restaurant", nb.restaurant);
  setVal("nb_park", nb.park);
  setVal("nb_pharmacy", nb.pharmacy);
  setVal("nb_airport", nb.airport);

  // Existing property images
  const existingImgGrid = document.getElementById("existingImages");
  (p.images || []).forEach((url, i) => {
    const wrapper = document.createElement("div");
    wrapper.className = "preview-thumb";
    wrapper.id = `prev-image-e-${i}`;
    wrapper.innerHTML = `
      <img src="${url}" alt="image ${i}" />
      <button class="remove-img" onclick="removeExistingImage('${url}', ${i})">✕</button>
    `;
    existingImgGrid.appendChild(wrapper);
  });

  // Existing floor plans (support both new array and legacy single)
  const existingFpGrid = document.getElementById("existingFloorPlans");
  const floorPlans = p.floor_plans || (p.floor_plan ? [p.floor_plan] : []);
  floorPlans.forEach((url, i) => {
    const wrapper = document.createElement("div");
    wrapper.className = "preview-thumb";
    wrapper.id = `prev-floorplan-e-${i}`;
    wrapper.innerHTML = `
      <img src="${url}" alt="floor plan ${i}" />
      <button class="remove-img" onclick="removeExistingFloorPlan('${url}', ${i})">✕</button>
    `;
    existingFpGrid.appendChild(wrapper);
  });

  updateImageCountBadge();
  updateFloorPlanCountBadge();

  showPage("add", true);
  document.getElementById("formTitle").textContent = "Edit Property";
}

// ─── VIEW PROPERTY ────────────────────────────────────────────
function viewProperty(id) {
  const p = allProperties.find((x) => x.id === id);
  if (!p) return;

  document.getElementById("viewTitle").textContent = p.title;
  document.getElementById("viewLocation").textContent = p.location || "";
  document
    .getElementById("editFromViewBtn")
    .setAttribute("onclick", `editProperty('${id}')`);

  const pd = p.property_details || {};
  const uf = p.utility_features || {};
  const of_ = p.outdoor_features || {};
  const nb = p.whats_nearby || {};

  const floorPlans = p.floor_plans || (p.floor_plan ? [p.floor_plan] : []);

  const imgHtml = (p.images || []).length
    ? `<div class="view-images">${p.images.map((u) => `<img src="${u}" alt="" />`).join("")}</div>`
    : "";

  const dr = (k, v) =>
    v
      ? `<div class="detail-row"><span class="detail-key">${k}</span><span class="detail-val">${v}</span></div>`
      : "";
  const nr = (icon, k, v) =>
    v
      ? `<div class="nearby-item"><span class="nearby-icon">${icon}</span><span>${k}</span><strong>${v}</strong></div>`
      : "";

  document.getElementById("viewContent").innerHTML = `
    ${imgHtml}

    <div class="view-stats">
      ${p.sqft ? `<div class="stat-pill">⬜ ${p.sqft} sqft</div>` : ""}
      ${p.bedrooms ? `<div class="stat-pill">🛏 ${p.bedrooms} Bed</div>` : ""}
      ${p.bathrooms ? `<div class="stat-pill">🚿 ${p.bathrooms} Bath</div>` : ""}
      ${p.kitchens ? `<div class="stat-pill">🍳 ${p.kitchens} Kitchen</div>` : ""}
      <div class="stat-pill price-pill">$${Number(p.price).toLocaleString()}</div>
      <div class="stat-pill">${p.status || ""}</div>
    </div>

    ${
      p.google_maps_url
        ? `
    <div class="view-map-btn-wrap">
      <a href="${p.google_maps_url}" target="_blank" class="btn-map">📍 View on Google Maps</a>
    </div>`
        : ""
    }

    <div class="view-grid">
      <div class="view-main">

        ${p.description ? `<div class="view-section"><h4>Overview</h4><p>${p.description}</p></div>` : ""}
        ${p.features_description ? `<div class="view-section"><h4>Property Feature Description</h4><p>${p.features_description}</p></div>` : ""}

        <div class="view-section">
          <h4>Property Details</h4>
          <div class="detail-grid">
            ${dr("Bedrooms", pd.bedrooms || p.bedrooms)}
            ${dr("Furnishing", pd.furnishing)}
            ${dr("Bathrooms", pd.bathrooms || p.bathrooms)}
            ${dr("Year Built", pd.year_built)}
            ${dr("Floor", pd.floor)}
            ${dr("Garage", pd.garage)}
            ${dr("Ceiling Height", pd.ceiling_height)}
            ${dr("Property Type", pd.property_type || p.property_type)}
            ${dr("Renovation", pd.renovation)}
            ${dr("Status", pd.status || p.status)}
            ${dr("Total Floors", pd.total_floors)}
            ${dr("Lot Size", pd.lot_size)}
          </div>
        </div>

        <div class="view-section">
          <h4>Utility Features</h4>
          <div class="detail-grid">
            ${dr("Heating", uf.heating)}
            ${dr("Intercom", uf.intercom)}
            ${dr("Air Condition", uf.ac)}
            ${dr("Window Type", uf.window_type)}
            ${dr("Fireplace", uf.fireplace)}
            ${dr("Cable TV", uf.cable_tv)}
            ${dr("Elevator", uf.elevator)}
            ${dr("WiFi", uf.wifi)}
            ${dr("Ventilation", uf.ventilation)}
            ${dr("Solar Panels", uf.solar)}
            ${dr("Smart Home", uf.smart_home)}
            ${dr("Generator", uf.generator)}
          </div>
        </div>

        <div class="view-section">
          <h4>Outdoor Features</h4>
          <div class="detail-grid">
            ${dr("Garage", of_.garage)}
            ${dr("Parking", of_.parking)}
            ${dr("Garden", of_.garden)}
            ${dr("Disabled Access", of_.disabled_access)}
            ${dr("Swimming Pool", of_.pool)}
            ${dr("Fence", of_.fence)}
            ${dr("Security", of_.security)}
            ${dr("Pet Friendly", of_.pet_friendly)}
            ${dr("BBQ Area", of_.bbq)}
            ${dr("Storage Room", of_.storage)}
            ${dr("Terrace", of_.terrace)}
            ${dr("Sports Court", of_.sports_court)}
          </div>
        </div>

        ${
          (p.amenities || []).length
            ? `
        <div class="view-section">
          <h4>Amenities</h4>
          <div class="amenity-tags">
            ${p.amenities.map((a) => `<span class="amenity-tag">✓ ${a}</span>`).join("")}
          </div>
        </div>`
            : ""
        }

        ${
          floorPlans.length
            ? `
        <div class="view-section">
          <h4>Floor Plans</h4>
          <div class="floor-plans-grid">
            ${floorPlans.map((url, i) => `<img src="${url}" alt="Floor Plan ${i + 1}" />`).join("")}
          </div>
        </div>`
            : ""
        }

        <div class="view-section">
          <h4>What's Nearby</h4>
          <div class="nearby-grid">
            ${nr("🏫", "School & College", nb.school)}
            ${nr("🛒", "Grocery Center", nb.grocery)}
            ${nr("🚇", "Metro Station", nb.metro)}
            ${nr("💪", "Gym", nb.gym)}
            ${nr("🎓", "University", nb.university)}
            ${nr("🏥", "Hospital", nb.hospital)}
            ${nr("🛍", "Shopping Mall", nb.mall)}
            ${nr("🚔", "Police Station", nb.police)}
            ${nr("🚌", "Bus Station", nb.bus)}
            ${nr("🏞", "River", nb.river)}
            ${nr("🏪", "Market", nb.market)}
            ${nr("🍽", "Restaurant", nb.restaurant)}
            ${nr("🌳", "Park", nb.park)}
            ${nr("💊", "Pharmacy", nb.pharmacy)}
            ${nr("✈", "Airport", nb.airport)}
          </div>
        </div>

      </div>

    </div>
  `;

  showPage("view");
}

// ─── DELETE ───────────────────────────────────────────────────
function openDeleteModal(id) {
  deleteTargetId = id;
  document.getElementById("deleteModal").classList.remove("hidden");
}

function closeDeleteModal() {
  deleteTargetId = null;
  document.getElementById("deleteModal").classList.add("hidden");
}

async function confirmDelete() {
  if (!deleteTargetId) return;
  const p = allProperties.find((x) => x.id === deleteTargetId);

  try {
    if (p) {
      for (const url of p.images || []) await deleteImageFromStorage(url);
      const fps = p.floor_plans || (p.floor_plan ? [p.floor_plan] : []);
      for (const url of fps) await deleteImageFromStorage(url);
    }

    const { error } = await supabase
      .from("properties")
      .delete()
      .eq("id", deleteTargetId);
    if (error) throw error;

    showToast("Property deleted.", "success");
    closeDeleteModal();
    await loadListings();
  } catch (err) {
    showToast("Error deleting property: " + err.message, "error");
  }
}

// ─── UTILITIES ────────────────────────────────────────────────
function showToast(msg, type = "info") {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = `toast toast-${type}`;
  t.classList.remove("hidden");
  setTimeout(() => t.classList.add("hidden"), 3500);
}

function showFormError(msg) {
  const el = document.getElementById("formError");
  el.textContent = msg;
  el.classList.remove("hidden");
  el.scrollIntoView({ behavior: "smooth", block: "center" });
}
