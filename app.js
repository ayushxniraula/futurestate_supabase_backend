// ============================================================
//  ESTATE ADMIN — Application Logic (v3 — with Sell Requests)
// ============================================================

const ADMIN_USER = "admin";
const ADMIN_PASS = "admin@123";
const SESSION_KEY = "ea_session";

// State
let allProperties = [];
let currentView = "grid"; // 'grid' | 'list'
let pendingImages = [];
let pendingFloorPlans = [];
let deleteTargetId = null;
let removedExistingImages = [];
let removedExistingFloorPlans = [];

const MAX_IMAGES = 5;
const MAX_FLOOR_PLANS = 3;

// ─── AUTH ─────────────────────────────────────────────────────
function doLogin() {
  const u = document.getElementById("loginUser").value.trim();
  const p = document.getElementById("loginPass").value.trim();
  const remember = document.getElementById("rememberMe").checked;

  if (u === ADMIN_USER && p === ADMIN_PASS) {
    if (remember) {
      localStorage.setItem(
        SESSION_KEY,
        JSON.stringify({ user: u, ts: Date.now() }),
      );
    } else {
      sessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify({ user: u, ts: Date.now() }),
      );
    }
    enterPortal();
  } else {
    document.getElementById("loginError").classList.remove("hidden");
    document.getElementById("loginPass").value = "";
  }
}

function checkSession() {
  document.getElementById("loginScreen").classList.add("hidden");
  document.getElementById("portal").classList.add("hidden");

  const stored =
    localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
  if (stored) {
    try {
      const s = JSON.parse(stored);
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;
      if (s.user === ADMIN_USER && Date.now() - s.ts < thirtyDays) {
        enterPortal();
        return;
      }
    } catch (e) {}
  }
  document.getElementById("loginScreen").classList.remove("hidden");
}

function enterPortal() {
  document.getElementById("loginScreen").classList.add("hidden");
  document.getElementById("portal").classList.remove("hidden");
  loadListings();
}

function doLogout() {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  document.getElementById("portal").classList.add("hidden");
  document.getElementById("loginScreen").classList.remove("hidden");
  document.getElementById("loginUser").value = "";
  document.getElementById("loginPass").value = "";
  document.getElementById("loginError").classList.add("hidden");
}

document.getElementById("loginPass").addEventListener("keydown", (e) => {
  if (e.key === "Enter") doLogin();
});
document.getElementById("loginUser").addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("loginPass").focus();
});

// ─── KEYBOARD SHORTCUTS ───────────────────────────────────────
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeDeleteModal();
    closeLightbox();
    closeSellModal();
  }
});

// ─── VIEW TOGGLE ──────────────────────────────────────────────
function setView(mode) {
  currentView = mode;
  document
    .getElementById("gridViewBtn")
    .classList.toggle("active", mode === "grid");
  document
    .getElementById("listViewBtn")
    .classList.toggle("active", mode === "list");
  filterListings();
}

// ─── PAGE NAVIGATION ──────────────────────────────────────────
function showPage(name, skipReset = false) {
  document.querySelectorAll(".page").forEach((p) => p.classList.add("hidden"));
  document
    .querySelectorAll(".nav-item")
    .forEach((n) => n.classList.remove("active"));

  const page = document.getElementById("page-" + name);
  if (page) page.classList.remove("hidden");

  const navMap = {
    listings: "[onclick=\"showPage('listings');return false;\"]",
    add: "[onclick=\"showPage('add');return false;\"]",
    contacts: "[onclick=\"showPage('contacts');return false;\"]",
    sell: "[onclick=\"showPage('sell');return false;\"]",
  };
  if (navMap[name]) {
    const el = document.querySelector(navMap[name]);
    if (el) el.classList.add("active");
  }

  if (name === "add" && !skipReset) {
    resetForm();
    document.getElementById("formTitle").textContent = "Add New Property";
    document.getElementById("editingId").value = "";
  }

  if (name === "contacts") loadContacts();
  if (name === "sell") loadSellRequests();
}

// ─── LISTINGS ─────────────────────────────────────────────────
async function loadListings() {
  try {
    const { data, error } = await supabase
      .from("properties")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    allProperties = data || [];
    updateStats();
    filterListings();
  } catch (err) {
    showToast("Error loading listings: " + err.message, "error");
    document.getElementById("propertiesGrid").innerHTML =
      `<div class="empty-state"><div class="empty-icon">⚠</div><p>Could not load properties. Check your Supabase config.</p></div>`;
  }
}

function updateStats() {
  const total = allProperties.length;
  const forSale = allProperties.filter((p) => p.status === "For Sale").length;
  const forRent = allProperties.filter((p) => p.status === "For Rent").length;
  const totalValue = allProperties
    .filter((p) => p.status === "For Sale" || p.status === "For Rent")
    .reduce((sum, p) => sum + (Number(p.price) || 0), 0);

  document.getElementById("statTotal").textContent = total;
  document.getElementById("statSale").textContent = forSale;
  document.getElementById("statRent").textContent = forRent;

  let valStr;
  if (totalValue >= 1_000_000)
    valStr = "$" + (totalValue / 1_000_000).toFixed(1) + "M";
  else if (totalValue >= 1_000)
    valStr = "$" + (totalValue / 1_000).toFixed(0) + "K";
  else valStr = "$" + totalValue;
  document.getElementById("statValue").textContent = valStr;
}

function filterListings() {
  const search = document.getElementById("searchInput").value.toLowerCase();
  const status = document.getElementById("statusFilter").value;
  const type = document.getElementById("typeFilter").value;
  const sort = document.getElementById("sortFilter").value;

  let filtered = allProperties.filter((p) => {
    const matchSearch =
      !search ||
      p.title?.toLowerCase().includes(search) ||
      p.location?.toLowerCase().includes(search);
    const matchStatus = !status || p.status === status;
    const matchType = !type || p.property_type === type;
    return matchSearch && matchStatus && matchType;
  });

  filtered = filtered.slice().sort((a, b) => {
    switch (sort) {
      case "oldest":
        return new Date(a.created_at) - new Date(b.created_at);
      case "price_asc":
        return (a.price || 0) - (b.price || 0);
      case "price_desc":
        return (b.price || 0) - (a.price || 0);
      default:
        return new Date(b.created_at) - new Date(a.created_at);
    }
  });

  renderListings(filtered);
}

function renderListings(properties) {
  const grid = document.getElementById("propertiesGrid");
  document.getElementById("listingCount").textContent =
    `${properties.length} propert${properties.length !== 1 ? "ies" : "y"} found`;

  grid.className =
    currentView === "list" ? "properties-list" : "properties-grid";

  if (!properties.length) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-icon">🏘</div><p>No properties found</p><button class="btn-primary" style="margin-top:8px" onclick="showPage('add')">Add your first property</button></div>`;
    return;
  }

  if (currentView === "list") {
    grid.innerHTML = properties.map((p) => renderListItem(p)).join("");
  } else {
    grid.innerHTML = properties.map((p) => renderCard(p)).join("");
  }
}

function renderCard(p) {
  const thumb = (p.images || [])[0];
  const statusClass = getStatusClass(p.status);
  const price = formatPrice(p);

  return `
    <div class="property-card" onclick="viewProperty('${p.id}')">
      <div class="card-image">
        ${thumb ? `<img src="${thumb}" alt="${escHtml(p.title)}" loading="lazy" />` : `<div class="no-image">🏠</div>`}
        <span class="status-badge ${statusClass}">${p.status || "N/A"}</span>
        <div class="card-actions" onclick="event.stopPropagation()">
          <button class="card-btn copy" onclick="copyPropertyId('${p.id}')" title="Copy ID">⎘</button>
          <button class="card-btn edit" onclick="editProperty('${p.id}')" title="Edit">✏</button>
          <button class="card-btn del"  onclick="openDeleteModal('${p.id}')" title="Delete">🗑</button>
        </div>
      </div>
      <div class="card-body">
        <h3 class="card-title">${escHtml(p.title)}</h3>
        <p class="card-location">📍 ${escHtml(p.location || "Location not set")}</p>
        <div class="card-specs">
          ${p.sqft ? `<span>⬜ ${p.sqft.toLocaleString()} sqft</span>` : ""}
          ${p.bedrooms ? `<span>🛏 ${String(p.bedrooms).padStart(2, "0")}</span>` : ""}
          ${p.bathrooms ? `<span>🚿 ${String(p.bathrooms).padStart(2, "0")}</span>` : ""}
          ${p.kitchens ? `<span>🍳 ${String(p.kitchens).padStart(2, "0")}</span>` : ""}
        </div>
        <div class="card-footer">
          <span class="card-price">${price}</span>
          <span class="card-type">${escHtml(p.property_type || "")}</span>
        </div>
      </div>
    </div>`;
}

function renderListItem(p) {
  const thumb = (p.images || [])[0];
  const statusClass = getStatusClass(p.status);
  const price = formatPrice(p);

  return `
    <div class="property-list-item" onclick="viewProperty('${p.id}')">
      <div class="list-thumb">
        ${thumb ? `<img src="${thumb}" alt="" />` : "🏠"}
      </div>
      <div class="list-info">
        <div class="list-title">${escHtml(p.title)}</div>
        <div class="list-location">📍 ${escHtml(p.location || "Location not set")}</div>
        <div class="list-specs">
          ${p.sqft ? `<span>⬜ ${p.sqft.toLocaleString()} sqft</span>` : ""}
          ${p.bedrooms ? `<span>🛏 ${p.bedrooms} bed</span>` : ""}
          ${p.bathrooms ? `<span>🚿 ${p.bathrooms} bath</span>` : ""}
        </div>
      </div>
      <div class="list-status"><span class="status-badge ${statusClass}">${p.status || "N/A"}</span></div>
      <div class="list-price">${price}</div>
      <div class="list-actions" onclick="event.stopPropagation()">
        <button class="card-btn edit" onclick="editProperty('${p.id}')" title="Edit">✏</button>
        <button class="card-btn del"  onclick="openDeleteModal('${p.id}')" title="Delete">🗑</button>
      </div>
    </div>`;
}

function getStatusClass(status) {
  const map = {
    "For Sale": "status-sale",
    "For Rent": "status-rent",
    Sold: "status-sold",
    Rented: "status-rented",
  };
  return map[status] || "status-other";
}

function formatPrice(p) {
  const n = Number(p.price).toLocaleString();
  return p.status === "For Rent" ? `$${n}/mo` : `$${n}`;
}

function escHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function copyPropertyId(id) {
  try {
    await navigator.clipboard.writeText(id);
    showToast("Property ID copied to clipboard", "info");
  } catch {
    showToast("Could not copy: " + id, "info");
  }
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
    "ag_name",
    "ag_title",
    "ag_email",
    "ag_phone",
    "ag_location",
  ];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
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

// ─── IMAGE HANDLING ───────────────────────────────────────────
function handleImageSelect(e) {
  const files = Array.from(e.target.files);
  const existingCount = document.querySelectorAll(
    "#existingImages .preview-thumb",
  ).length;
  const remaining = MAX_IMAGES - existingCount - pendingImages.length;
  if (remaining <= 0) {
    showToast(`Maximum ${MAX_IMAGES} images allowed.`, "error");
    e.target.value = "";
    return;
  }
  const allowed = files.slice(0, remaining);
  if (files.length > remaining)
    showToast(
      `Only ${remaining} more image(s) allowed. ${files.length - remaining} skipped.`,
      "info",
    );
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
  if (files.length > remaining)
    showToast(`Only ${remaining} more floor plan(s) allowed.`, "info");
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
  wrapper.innerHTML = `<img src="${src}" alt="preview" /><button class="remove-img" onclick="removePendingItem('${kind}', ${idx})">✕</button>`;
  grid.appendChild(wrapper);
  kind === "image" ? updateImageCountBadge() : updateFloorPlanCountBadge();
}

function removePendingItem(kind, idx) {
  if (kind === "image") {
    pendingImages.splice(idx, 1);
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
    console.warn("Could not delete image:", e);
  }
}

// ─── FORM DATA ────────────────────────────────────────────────
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
    agent: {
      name: getVal("ag_name"),
      title: getVal("ag_title"),
      email: getVal("ag_email"),
      phone: getVal("ag_phone"),
      location: getVal("ag_location"),
    },
  };
}

// ─── SAVE ─────────────────────────────────────────────────────
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
  btnText.textContent = "Saving…";

  try {
    const editId = document.getElementById("editingId").value;
    let newImageUrls = [];
    let newFloorPlanUrls = [];

    if (pendingImages.length > 0) {
      showToast("Uploading images…", "info");
      for (const file of pendingImages)
        newImageUrls.push(await uploadImage(file, "listings"));
    }
    if (pendingFloorPlans.length > 0) {
      showToast("Uploading floor plans…", "info");
      for (const file of pendingFloorPlans)
        newFloorPlanUrls.push(await uploadImage(file, "floorplans"));
    }

    for (const url of removedExistingImages) await deleteImageFromStorage(url);
    for (const url of removedExistingFloorPlans)
      await deleteImageFromStorage(url);

    if (editId) {
      const existing = allProperties.find((p) => p.id === editId);
      const keptImages = (existing?.images || []).filter(
        (u) => !removedExistingImages.includes(u),
      );
      const keptFloors = (existing?.floor_plans || []).filter(
        (u) => !removedExistingFloorPlans.includes(u),
      );

      const mergeObj = (existing = {}, incoming = {}) => {
        const result = { ...existing };
        Object.entries(incoming).forEach(([k, v]) => {
          if (v !== null && v !== undefined && v !== "") result[k] = v;
        });
        return result;
      };

      const patch = {};
      [
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
      ].forEach((k) => {
        const v = data[k];
        if (v !== null && v !== undefined && v !== "") patch[k] = v;
      });

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
      patch.agent = mergeObj(existing?.agent, data.agent);
      patch.amenities = data.amenities;
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

// ─── EDIT ─────────────────────────────────────────────────────
function editProperty(id) {
  const p = allProperties.find((x) => x.id === id);
  if (!p) return;

  resetForm();
  document.getElementById("editingId").value = id;

  const setVal = (elId, val) => {
    const el = document.getElementById(elId);
    if (el && val !== undefined && val !== null) el.value = val;
  };

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

  const ag = p.agent || {};
  setVal("ag_name", ag.name);
  setVal("ag_title", ag.title);
  setVal("ag_email", ag.email);
  setVal("ag_phone", ag.phone);
  setVal("ag_location", ag.location);

  const existingImgGrid = document.getElementById("existingImages");
  (p.images || []).forEach((url, i) => {
    const wrapper = document.createElement("div");
    wrapper.className = "preview-thumb";
    wrapper.id = `prev-image-e-${i}`;
    wrapper.innerHTML = `<img src="${url}" alt="image ${i}" /><button class="remove-img" onclick="removeExistingImage('${url}', ${i})">✕</button>`;
    existingImgGrid.appendChild(wrapper);
  });

  const existingFpGrid = document.getElementById("existingFloorPlans");
  const floorPlans = p.floor_plans || (p.floor_plan ? [p.floor_plan] : []);
  floorPlans.forEach((url, i) => {
    const wrapper = document.createElement("div");
    wrapper.className = "preview-thumb";
    wrapper.id = `prev-floorplan-e-${i}`;
    wrapper.innerHTML = `<img src="${url}" alt="floor plan ${i}" /><button class="remove-img" onclick="removeExistingFloorPlan('${url}', ${i})">✕</button>`;
    existingFpGrid.appendChild(wrapper);
  });

  updateImageCountBadge();
  updateFloorPlanCountBadge();
  showPage("add", true);
  document.getElementById("formTitle").textContent = "Edit Property";
}

// ─── VIEW ──────────────────────────────────────────────────────
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
  const ag = p.agent || {};
  const floorPlans = p.floor_plans || (p.floor_plan ? [p.floor_plan] : []);

  const imgHtml = (p.images || []).length
    ? `<div class="view-images">${p.images.map((u) => `<img src="${u}" alt="" onclick="openLightbox('${u}')" />`).join("")}</div>`
    : "";

  const dr = (k, v) =>
    v
      ? `<div class="detail-row"><span class="detail-key">${k}</span><span class="detail-val">${v}</span></div>`
      : "";
  const nr = (icon, k, v) =>
    v
      ? `<div class="nearby-item"><span class="nearby-icon">${icon}</span><span>${k}</span><strong>${v}</strong></div>`
      : "";

  const createdDate = p.created_at
    ? new Date(p.created_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—";
  const updatedDate = p.updated_at
    ? new Date(p.updated_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—";

  document.getElementById("viewContent").innerHTML = `
    ${imgHtml}
    <div class="view-stats">
      ${p.sqft ? `<div class="stat-pill">⬜ ${Number(p.sqft).toLocaleString()} sqft</div>` : ""}
      ${p.bedrooms ? `<div class="stat-pill">🛏 ${p.bedrooms} Bed</div>` : ""}
      ${p.bathrooms ? `<div class="stat-pill">🚿 ${p.bathrooms} Bath</div>` : ""}
      ${p.kitchens ? `<div class="stat-pill">🍳 ${p.kitchens} Kitchen</div>` : ""}
      <div class="stat-pill price-pill">$${Number(p.price).toLocaleString()}</div>
      ${p.status ? `<div class="stat-pill">${p.status}</div>` : ""}
    </div>
    ${p.google_maps_url ? `<a href="${p.google_maps_url}" target="_blank" class="btn-map">📍 View on Google Maps</a>` : ""}
    <div class="view-grid">
      <div class="view-main">
        ${p.description ? `<div class="view-section"><h4>Overview</h4><p>${p.description}</p></div>` : ""}
        ${p.features_description ? `<div class="view-section"><h4>Property Features</h4><p>${p.features_description}</p></div>` : ""}
        <div class="view-section">
          <h4>Property Details</h4>
          <div class="detail-grid">
            ${dr("Bedrooms", pd.bedrooms || p.bedrooms)} ${dr("Furnishing", pd.furnishing)}
            ${dr("Bathrooms", pd.bathrooms || p.bathrooms)} ${dr("Year Built", pd.year_built)}
            ${dr("Floor", pd.floor)} ${dr("Garage", pd.garage)}
            ${dr("Ceiling Height", pd.ceiling_height)} ${dr("Property Type", pd.property_type || p.property_type)}
            ${dr("Renovation", pd.renovation)} ${dr("Status", pd.status || p.status)}
            ${dr("Total Floors", pd.total_floors)} ${dr("Lot Size", pd.lot_size)}
          </div>
        </div>
        <div class="view-section">
          <h4>Utility Features</h4>
          <div class="detail-grid">
            ${dr("Heating", uf.heating)} ${dr("Intercom", uf.intercom)}
            ${dr("Air Condition", uf.ac)} ${dr("Window Type", uf.window_type)}
            ${dr("Fireplace", uf.fireplace)} ${dr("Cable TV", uf.cable_tv)}
            ${dr("Elevator", uf.elevator)} ${dr("WiFi", uf.wifi)}
            ${dr("Ventilation", uf.ventilation)} ${dr("Solar Panels", uf.solar)}
            ${dr("Smart Home", uf.smart_home)} ${dr("Generator", uf.generator)}
          </div>
        </div>
        <div class="view-section">
          <h4>Outdoor Features</h4>
          <div class="detail-grid">
            ${dr("Garage", of_.garage)} ${dr("Parking", of_.parking)}
            ${dr("Garden", of_.garden)} ${dr("Disabled Access", of_.disabled_access)}
            ${dr("Swimming Pool", of_.pool)} ${dr("Fence", of_.fence)}
            ${dr("Security", of_.security)} ${dr("Pet Friendly", of_.pet_friendly)}
            ${dr("BBQ Area", of_.bbq)} ${dr("Storage Room", of_.storage)}
            ${dr("Terrace", of_.terrace)} ${dr("Sports Court", of_.sports_court)}
          </div>
        </div>
        ${(p.amenities || []).length ? `<div class="view-section"><h4>Amenities</h4><div class="amenity-tags">${p.amenities.map((a) => `<span class="amenity-tag">✓ ${a}</span>`).join("")}</div></div>` : ""}
        ${floorPlans.length ? `<div class="view-section"><h4>Floor Plans</h4><div class="floor-plans-grid">${floorPlans.map((url, i) => `<img src="${url}" alt="Floor Plan ${i + 1}" onclick="openLightbox('${url}')" style="cursor:zoom-in" />`).join("")}</div></div>` : ""}
        <div class="view-section">
          <h4>What's Nearby</h4>
          <div class="nearby-grid">
            ${nr("🏫", "School & College", nb.school)} ${nr("🛒", "Grocery", nb.grocery)}
            ${nr("🚇", "Metro Station", nb.metro)}     ${nr("💪", "Gym", nb.gym)}
            ${nr("🎓", "University", nb.university)}   ${nr("🏥", "Hospital", nb.hospital)}
            ${nr("🛍", "Shopping Mall", nb.mall)}      ${nr("🚔", "Police Station", nb.police)}
            ${nr("🚌", "Bus Station", nb.bus)}         ${nr("🏞", "River", nb.river)}
            ${nr("🏪", "Market", nb.market)}           ${nr("🍽", "Restaurant", nb.restaurant)}
            ${nr("🌳", "Park", nb.park)}               ${nr("💊", "Pharmacy", nb.pharmacy)}
            ${nr("✈", "Airport", nb.airport)}
          </div>
        </div>
      </div>
      <div class="view-sidebar">
        ${
          ag.name
            ? `
        <div class="agent-card">
          <div class="agent-avatar-lg">${ag.name.charAt(0).toUpperCase()}</div>
          <h4>${ag.name}</h4>
          <div class="agent-role">${ag.title || "Property Agent"}</div>
          <div class="agent-info">
            ${ag.email ? `<div class="agent-detail">✉ <strong>${ag.email}</strong></div>` : ""}
            ${ag.phone ? `<div class="agent-detail">📞 <strong>${ag.phone}</strong></div>` : ""}
            ${ag.location ? `<div class="agent-detail">📍 <strong>${ag.location}</strong></div>` : ""}
          </div>
        </div>`
            : ""
        }
        <div class="quick-info-card">
          <h4>Listing Info</h4>
          <div class="quick-row"><span>Listed</span><strong>${createdDate}</strong></div>
          <div class="quick-row"><span>Updated</span><strong>${updatedDate}</strong></div>
          <div class="quick-row"><span>Type</span><strong>${p.property_type || "—"}</strong></div>
          <div class="quick-row"><span>Status</span><strong>${p.status || "—"}</strong></div>
          <div class="quick-row"><span>Price</span><strong>$${Number(p.price).toLocaleString()}</strong></div>
          ${p.sqft ? `<div class="quick-row"><span>Size</span><strong>${Number(p.sqft).toLocaleString()} sqft</strong></div>` : ""}
        </div>
      </div>
    </div>`;

  showPage("view");
}

// ─── LIGHTBOX ─────────────────────────────────────────────────
function openLightbox(url) {
  const existing = document.getElementById("lightboxOverlay");
  if (existing) existing.remove();
  const lb = document.createElement("div");
  lb.className = "lightbox";
  lb.id = "lightboxOverlay";
  lb.innerHTML = `<img src="${url}" alt="Preview" />`;
  lb.onclick = closeLightbox;
  document.body.appendChild(lb);
}
function closeLightbox() {
  const lb = document.getElementById("lightboxOverlay");
  if (lb) lb.remove();
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

// ─── TOAST / ERRORS ───────────────────────────────────────────
function showToast(msg, type = "info") {
  const t = document.getElementById("toast");
  const icons = { success: "✓", error: "✕", info: "ℹ" };
  t.innerHTML = `<span>${icons[type] || "ℹ"}</span> ${msg}`;
  t.className = `toast toast-${type}`;
  t.classList.remove("hidden");
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add("hidden"), 3500);
}

function showFormError(msg) {
  const el = document.getElementById("formError");
  el.textContent = msg;
  el.classList.remove("hidden");
  el.scrollIntoView({ behavior: "smooth", block: "center" });
}

// ─── CONTACTS PAGE ────────────────────────────────────────────
let allContacts = [];
let contactSortField = "created_at";
let contactSortDir = "desc";

const CONTACT_STATUS_LABELS = {
  new: { label: "New", class: "cs-new" },
  contacted: { label: "Contacted", class: "cs-contacted" },
  qualified: { label: "Qualified", class: "cs-qualified" },
  viewing_scheduled: { label: "Viewing Scheduled", class: "cs-viewing" },
  negotiating: { label: "Negotiating", class: "cs-negotiating" },
  closed: { label: "Closed ✓", class: "cs-closed" },
  lost: { label: "Lost", class: "cs-lost" },
};

const CONTACT_PRIORITY_LABELS = {
  low: { label: "Low", class: "cp-low" },
  normal: { label: "Normal", class: "cp-normal" },
  high: { label: "High", class: "cp-high" },
  urgent: { label: "Urgent", class: "cp-urgent" },
};

async function loadContacts() {
  try {
    const { data, error } = await supabase
      .from("contacts")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    allContacts = data || [];
    updateContactStats();
    renderContacts(allContacts);
  } catch (err) {
    showToast("Error loading contacts: " + err.message, "error");
    document.getElementById("contactsTable").innerHTML =
      `<tr><td colspan="7" class="empty-state"><div class="empty-icon">⚠</div><p>Could not load contacts.</p></td></tr>`;
  }
}

function updateContactStats() {
  const total = allContacts.length;
  const newC = allContacts.filter((c) => c.status === "new").length;
  const inProgress = allContacts.filter((c) =>
    ["qualified", "viewing_scheduled", "negotiating"].includes(c.status),
  ).length;
  const closed = allContacts.filter((c) => c.status === "closed").length;

  document.getElementById("cStatTotal").textContent = total;
  document.getElementById("cStatNew").textContent = newC;
  document.getElementById("cStatInProgress").textContent = inProgress;
  document.getElementById("cStatClosed").textContent = closed;
}

function filterContacts() {
  const search = document.getElementById("contactSearch").value.toLowerCase();
  const status = document.getElementById("contactStatusFilter").value;
  const priority = document.getElementById("contactPriorityFilter").value;
  const type = document.getElementById("contactTypeFilter").value;

  let filtered = allContacts.filter((c) => {
    const matchSearch =
      !search ||
      c.name?.toLowerCase().includes(search) ||
      c.email?.toLowerCase().includes(search) ||
      c.phone?.toLowerCase().includes(search) ||
      c.message?.toLowerCase().includes(search) ||
      c.property_name?.toLowerCase().includes(search);
    const matchStatus = !status || c.status === status;
    const matchPriority = !priority || c.priority === priority;
    const matchType = !type || c.inquiry_type === type;
    return matchSearch && matchStatus && matchPriority && matchType;
  });

  filtered.sort((a, b) => {
    let va = a[contactSortField] ?? "";
    let vb = b[contactSortField] ?? "";
    if (contactSortField === "created_at") {
      va = new Date(va);
      vb = new Date(vb);
    }
    if (va < vb) return contactSortDir === "asc" ? -1 : 1;
    if (va > vb) return contactSortDir === "asc" ? 1 : -1;
    return 0;
  });

  renderContacts(filtered);
}

function setContactSort(field) {
  if (contactSortField === field) {
    contactSortDir = contactSortDir === "asc" ? "desc" : "asc";
  } else {
    contactSortField = field;
    contactSortDir = "desc";
  }
  filterContacts();
}

function renderContacts(contacts) {
  const tbody = document.getElementById("contactsTable");
  document.getElementById("contactCount").textContent =
    `${contacts.length} lead${contacts.length !== 1 ? "s" : ""}`;

  if (!contacts.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:60px;color:var(--text-muted)">No contacts found</td></tr>`;
    return;
  }

  tbody.innerHTML = contacts
    .map((c) => {
      const st = CONTACT_STATUS_LABELS[c.status] || {
        label: c.status,
        class: "cs-new",
      };
      const pr = CONTACT_PRIORITY_LABELS[c.priority] || {
        label: c.priority,
        class: "cp-normal",
      };
      const date = c.created_at
        ? new Date(c.created_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : "—";
      const budget =
        c.budget_min || c.budget_max
          ? `$${(c.budget_min || 0).toLocaleString()} – $${(c.budget_max || "?").toLocaleString()}`
          : "—";

      return `
    <tr class="contact-row-item" onclick="openContactModal('${c.id}')">
      <td>
        <div class="contact-name-cell">
          <div class="contact-avatar">${(c.name || "?").charAt(0).toUpperCase()}</div>
          <div>
            <div class="contact-name">${escHtml(c.name)}</div>
            <div class="contact-email">${escHtml(c.email)}</div>
          </div>
        </div>
      </td>
      <td><span class="contact-type-badge">${escHtml(c.inquiry_type || "—")}</span></td>
      <td>${escHtml(c.property_name || "—")}</td>
      <td>${budget}</td>
      <td><span class="contact-status-badge ${st.class}">${st.label}</span></td>
      <td><span class="contact-priority-badge ${pr.class}">${pr.label}</span></td>
      <td class="contact-date">${date}</td>
      <td onclick="event.stopPropagation()">
        <select class="contact-status-select" onchange="quickUpdateStatus('${c.id}', this.value)">
          ${Object.entries(CONTACT_STATUS_LABELS)
            .map(
              ([v, s]) =>
                `<option value="${v}" ${c.status === v ? "selected" : ""}>${s.label}</option>`,
            )
            .join("")}
        </select>
      </td>
    </tr>`;
    })
    .join("");
}

async function quickUpdateStatus(id, newStatus) {
  try {
    const { error } = await supabase
      .from("contacts")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    const idx = allContacts.findIndex((c) => c.id === id);
    if (idx !== -1) allContacts[idx].status = newStatus;
    updateContactStats();
    showToast("Status updated", "success");
    filterContacts();
  } catch (err) {
    showToast("Error: " + err.message, "error");
  }
}

function openContactModal(id) {
  const c = allContacts.find((x) => x.id === id);
  if (!c) return;

  const st = CONTACT_STATUS_LABELS[c.status] || {
    label: c.status,
    class: "cs-new",
  };
  const pr = CONTACT_PRIORITY_LABELS[c.priority] || {
    label: c.priority,
    class: "cp-normal",
  };
  const date = c.created_at
    ? new Date(c.created_at).toLocaleString("en-US")
    : "—";
  const budget =
    c.budget_min || c.budget_max
      ? `$${Number(c.budget_min || 0).toLocaleString()} – $${Number(c.budget_max || 0).toLocaleString()}`
      : "Not specified";

  document.getElementById("contactModalContent").innerHTML = `
    <div class="cmodal-header">
      <div class="contact-avatar lg">${(c.name || "?").charAt(0).toUpperCase()}</div>
      <div class="cmodal-title">
        <h3>${escHtml(c.name)}</h3>
        <div class="cmodal-sub">${escHtml(c.email)}${c.phone ? ` · ${escHtml(c.phone)}` : ""}</div>
      </div>
      <div class="cmodal-badges">
        <span class="contact-status-badge ${st.class}">${st.label}</span>
        <span class="contact-priority-badge ${pr.class}">${pr.label}</span>
      </div>
    </div>
    <div class="cmodal-grid">
      <div class="cmodal-section">
        <h4>Inquiry Details</h4>
        <div class="cmodal-row"><span>Type</span><strong>${escHtml(c.inquiry_type || "—")}</strong></div>
        <div class="cmodal-row"><span>Subject</span><strong>${escHtml(c.subject || "—")}</strong></div>
        <div class="cmodal-row"><span>Property</span><strong>${escHtml(c.property_name || "—")}</strong></div>
        <div class="cmodal-row"><span>Budget</span><strong>${budget}</strong></div>
        <div class="cmodal-row"><span>Timeline</span><strong>${escHtml(c.move_timeline || "—")}</strong></div>
        <div class="cmodal-row"><span>Submitted</span><strong>${date}</strong></div>
      </div>
      <div class="cmodal-section">
        <h4>Contact Preferences</h4>
        <div class="cmodal-row"><span>Preferred Contact</span><strong>${escHtml(c.preferred_contact || "Any")}</strong></div>
        <div class="cmodal-row"><span>Best Time</span><strong>${escHtml(c.preferred_time || "Anytime")}</strong></div>
        ${c.whatsapp ? `<div class="cmodal-row"><span>WhatsApp</span><strong>${escHtml(c.whatsapp)}</strong></div>` : ""}
        <div class="cmodal-row"><span>Source</span><strong>${escHtml(c.source || "website")}</strong></div>
      </div>
    </div>
    <div class="cmodal-section cmodal-full">
      <h4>Message</h4>
      <p class="cmodal-message">${escHtml(c.message || "—")}</p>
    </div>
    <div class="cmodal-section cmodal-full">
      <h4>Update Status & Priority</h4>
      <div class="cmodal-actions-row">
        <div class="form-group" style="flex:1">
          <label>Status</label>
          <select id="cm_status" onchange="updateContactField('${c.id}', 'status', this.value)">
            ${Object.entries(CONTACT_STATUS_LABELS)
              .map(
                ([v, s]) =>
                  `<option value="${v}" ${c.status === v ? "selected" : ""}>${s.label}</option>`,
              )
              .join("")}
          </select>
        </div>
        <div class="form-group" style="flex:1">
          <label>Priority</label>
          <select id="cm_priority" onchange="updateContactField('${c.id}', 'priority', this.value)">
            ${Object.entries(CONTACT_PRIORITY_LABELS)
              .map(
                ([v, p]) =>
                  `<option value="${v}" ${c.priority === v ? "selected" : ""}>${p.label}</option>`,
              )
              .join("")}
          </select>
        </div>
      </div>
    </div>
    <div class="cmodal-section cmodal-full">
      <h4>Admin Notes</h4>
      <textarea id="cm_notes" rows="3" placeholder="Add internal notes…" style="width:100%;background:var(--dark3);border:1px solid var(--border);color:var(--text);padding:9px 12px;border-radius:var(--radius-sm);font-family:'DM Sans',sans-serif;font-size:13px;resize:vertical;outline:none;">${escHtml(c.admin_notes || "")}</textarea>
      <button class="btn-primary" style="margin-top:8px" onclick="saveContactNotes('${c.id}')">Save Notes</button>
    </div>`;

  document.getElementById("contactModal").classList.remove("hidden");
}

async function updateContactField(id, field, value) {
  try {
    const { error } = await supabase
      .from("contacts")
      .update({ [field]: value, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    const idx = allContacts.findIndex((c) => c.id === id);
    if (idx !== -1) allContacts[idx][field] = value;
    updateContactStats();
    showToast("Updated", "success");
  } catch (err) {
    showToast("Error: " + err.message, "error");
  }
}

async function saveContactNotes(id) {
  const notes = document.getElementById("cm_notes").value;
  await updateContactField(id, "admin_notes", notes);
}

function closeContactModal() {
  document.getElementById("contactModal").classList.add("hidden");
  loadContacts();
}

// ─── SELL REQUESTS ────────────────────────────────────────────
let allSellRequests = [];
let filteredSellRequests = [];

async function loadSellRequests() {
  const tbody = document.getElementById("sellRequestsTable");
  if (!tbody) return;
  tbody.innerHTML = `
    <tr><td colspan="8" style="text-align:center;padding:60px;color:var(--text-muted)">
      <div class="spinner" style="margin:0 auto 12px"></div>Loading…
    </td></tr>`;

  try {
    const { data, error } = await supabase
      .from("sell_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    allSellRequests = data || [];
    updateSellStats(allSellRequests);
    filterSellRequests();
    updateSellBadge(allSellRequests);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:40px;color:#e84545">
      ⚠ ${err.message}</td></tr>`;
  }
}

function updateSellStats(list) {
  const sTotal = document.getElementById("sStatTotal");
  const sPending = document.getElementById("sStatPending");
  const sReviewed = document.getElementById("sStatReviewed");
  const sApproved = document.getElementById("sStatApproved");
  const sCount = document.getElementById("sellCount");

  if (sTotal) sTotal.textContent = list.length;
  if (sPending)
    sPending.textContent = list.filter(
      (r) => r.review_status === "pending",
    ).length;
  if (sReviewed)
    sReviewed.textContent = list.filter(
      (r) => r.review_status === "reviewed",
    ).length;
  if (sApproved)
    sApproved.textContent = list.filter(
      (r) => r.review_status === "approved",
    ).length;
  if (sCount)
    sCount.textContent = `${list.length} total sell request${list.length !== 1 ? "s" : ""}`;
}

function updateSellBadge(list) {
  const pending = list.filter((r) => r.review_status === "pending").length;
  const badge = document.getElementById("sellNewBadge");
  if (!badge) return;
  if (pending > 0) {
    badge.textContent = pending;
    badge.classList.remove("hidden");
  } else badge.classList.add("hidden");
}

function filterSellRequests() {
  const q = (document.getElementById("sellSearch")?.value || "").toLowerCase();
  const statusF = document.getElementById("sellStatusFilter")?.value || "";
  const typeF = document.getElementById("sellTypeFilter")?.value || "";

  filteredSellRequests = allSellRequests.filter((r) => {
    const matchQ =
      !q ||
      r.contact_name?.toLowerCase().includes(q) ||
      r.contact_email?.toLowerCase().includes(q) ||
      r.title?.toLowerCase().includes(q) ||
      r.location?.toLowerCase().includes(q);
    const matchStatus = !statusF || r.review_status === statusF;
    const matchType = !typeF || r.property_type === typeF;
    return matchQ && matchStatus && matchType;
  });

  renderSellTable(filteredSellRequests);
}

function renderSellTable(list) {
  const tbody = document.getElementById("sellRequestsTable");
  if (!tbody) return;

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:60px;color:var(--text-muted)">No sell requests found.</td></tr>`;
    return;
  }

  const statusColors = {
    pending: "#ff9800",
    reviewed: "#2196f3",
    approved: "#4caf50",
    rejected: "#e84545",
  };

  tbody.innerHTML = list
    .map((r) => {
      const color = statusColors[r.review_status] || "#888";
      const date = new Date(r.created_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      const price = r.price ? "$" + Number(r.price).toLocaleString() : "—";
      return `
      <tr style="cursor:pointer" onclick="openSellModal('${r.id}')">
        <td>
          <div style="font-weight:600;font-size:13.5px">${escHtml(r.contact_name || "—")}</div>
          <div style="font-size:12px;color:var(--text-muted)">${escHtml(r.contact_email || "")}</div>
          <div style="font-size:12px;color:var(--text-muted)">${escHtml(r.contact_phone || "")}</div>
        </td>
        <td style="max-width:200px">
          <div style="font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
            ${escHtml(r.title || "—")}
          </div>
        </td>
        <td><span style="font-size:12px;background:var(--dark3);padding:3px 9px;border-radius:6px">${escHtml(r.property_type || "—")}</span></td>
        <td style="font-weight:700">${price}</td>
        <td style="font-size:12.5px;color:var(--text-muted)">${escHtml(r.location || "—")}</td>
        <td>
          <span style="display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:20px;
            background:${color}22;color:${color};font-size:11px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase">
            <span style="width:6px;height:6px;border-radius:50%;background:${color};display:inline-block"></span>
            ${r.review_status}
          </span>
        </td>
        <td style="font-size:12px;color:var(--text-muted)">${date}</td>
        <td onclick="event.stopPropagation()">
          <div style="display:flex;gap:6px">
            <button class="btn-secondary" style="padding:5px 10px;font-size:12px" onclick="openSellModal('${r.id}')">View</button>
            <button class="btn-primary"   style="padding:5px 10px;font-size:12px" onclick="approveSellRequest('${r.id}')">→ Add</button>
          </div>
        </td>
      </tr>`;
    })
    .join("");
}

function openSellModal(id) {
  const r = allSellRequests.find((x) => x.id === id);
  if (!r) return;

  if (r.review_status === "pending") {
    supabase
      .from("sell_requests")
      .update({ review_status: "reviewed" })
      .eq("id", id)
      .then(() => {
        r.review_status = "reviewed";
        updateSellBadge(allSellRequests);
        renderSellTable(filteredSellRequests);
      });
  }

  const statusColors = {
    pending: "#ff9800",
    reviewed: "#2196f3",
    approved: "#4caf50",
    rejected: "#e84545",
  };
  const color = statusColors[r.review_status] || "#888";
  const price = r.price ? "$" + Number(r.price).toLocaleString() : "—";

  const renderKV = (obj) => {
    if (!obj || Object.keys(obj).length === 0)
      return "<em style='color:var(--text-muted);font-size:12px'>None provided</em>";
    return Object.entries(obj)
      .filter(([, v]) => v)
      .map(
        ([k, v]) => `
      <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border);font-size:13px">
        <span style="color:var(--text-muted);text-transform:capitalize">${k.replace(/_/g, " ")}</span>
        <span style="font-weight:600;color:var(--text)">${escHtml(String(v))}</span>
      </div>`,
      )
      .join("");
  };

  const imgHtml =
    (r.images || []).length > 0
      ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">${r.images.map((url) => `<img src="${url}" style="width:90px;height:70px;object-fit:cover;border-radius:7px;border:1px solid var(--border)" onclick="openLightbox('${url}')" style="cursor:zoom-in" />`).join("")}</div>`
      : "<em style='color:var(--text-muted);font-size:12px'>No images uploaded</em>";

  document.getElementById("sellModalContent").innerHTML = `
    <div style="padding:8px 0">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:22px">
        <div style="width:48px;height:48px;border-radius:12px;background:linear-gradient(135deg,#e84545,#1a1a1a);
          display:flex;align-items:center;justify-content:center;color:#fff;font-size:1.3rem;font-weight:700;flex-shrink:0">
          ${(r.contact_name || "?")[0].toUpperCase()}
        </div>
        <div>
          <div style="font-size:17px;font-weight:800;color:var(--text)">${escHtml(r.contact_name || "—")}</div>
          <div style="font-size:13px;color:var(--text-muted)">${escHtml(r.contact_email || "")} · ${escHtml(r.contact_phone || "")}</div>
        </div>
        <span style="margin-left:auto;padding:5px 14px;border-radius:20px;background:${color}22;
          color:${color};font-size:11px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase">
          ${r.review_status}
        </span>
      </div>

      <div style="display:flex;gap:8px;margin-bottom:22px">
        <a href="mailto:${encodeURIComponent(r.contact_email || "")}?subject=Your property listing: ${encodeURIComponent(r.title || "")}"
          style="flex:1;padding:10px;border-radius:9px;background:var(--gold);color:#000;
            text-align:center;text-decoration:none;font-size:13px;font-weight:700">
          ✉ Email Seller
        </a>
        <a href="tel:${encodeURIComponent(r.contact_phone || "")}"
          style="flex:1;padding:10px;border-radius:9px;background:var(--dark3);color:var(--text);
            text-align:center;text-decoration:none;font-size:13px;font-weight:700;border:1px solid var(--border)">
          📞 Call Seller
        </a>
        <button onclick="approveSellRequest('${r.id}')"
          style="flex:1;padding:10px;border-radius:9px;background:#4caf50;color:#fff;
            border:none;font-size:13px;font-weight:700;cursor:pointer">
          ✓ Add to Listings
        </button>
      </div>

      <div style="background:var(--dark3);border-radius:12px;padding:18px;margin-bottom:18px;border:1px solid var(--border)">
        <div style="font-size:11px;font-weight:700;color:var(--text-muted);letter-spacing:0.7px;text-transform:uppercase;margin-bottom:12px">Property Summary</div>
        <div style="font-size:18px;font-weight:800;color:var(--text);margin-bottom:6px">${escHtml(r.title || "—")}</div>
        <div style="font-size:13px;color:var(--text-muted);margin-bottom:14px">📍 ${escHtml(r.location || "—")}</div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;text-align:center">
          ${[
            ["Price", price],
            ["Type", r.property_type || "—"],
            ["Status", r.status || "—"],
            ["sqft", r.sqft ? r.sqft.toLocaleString() : "—"],
          ]
            .map(
              ([l, v]) => `
            <div style="background:var(--dark2);border-radius:8px;border:1px solid var(--border);padding:10px 6px">
              <div style="font-size:10px;color:var(--text-muted);font-weight:700;letter-spacing:0.5px;text-transform:uppercase">${l}</div>
              <div style="font-size:14px;font-weight:700;color:var(--text);margin-top:3px">${v}</div>
            </div>`,
            )
            .join("")}
        </div>
      </div>

      ${
        r.description
          ? `
        <div style="margin-bottom:18px">
          <div style="font-size:11px;font-weight:700;color:var(--text-muted);letter-spacing:0.7px;text-transform:uppercase;margin-bottom:8px">Description</div>
          <p style="font-size:13.5px;color:var(--text-muted);line-height:1.7;margin:0">${escHtml(r.description)}</p>
        </div>`
          : ""
      }

      ${
        Object.keys(r.property_details || {}).length
          ? `
        <div style="margin-bottom:18px">
          <div style="font-size:11px;font-weight:700;color:var(--text-muted);letter-spacing:0.7px;text-transform:uppercase;margin-bottom:8px">Property Details</div>
          ${renderKV(r.property_details)}
        </div>`
          : ""
      }

      ${
        Object.keys(r.whats_nearby || {}).length
          ? `
        <div style="margin-bottom:18px">
          <div style="font-size:11px;font-weight:700;color:var(--text-muted);letter-spacing:0.7px;text-transform:uppercase;margin-bottom:8px">What's Nearby</div>
          ${renderKV(r.whats_nearby)}
        </div>`
          : ""
      }

      ${
        (r.amenities || []).length
          ? `
        <div style="margin-bottom:18px">
          <div style="font-size:11px;font-weight:700;color:var(--text-muted);letter-spacing:0.7px;text-transform:uppercase;margin-bottom:8px">Amenities</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px">
            ${r.amenities.map((a) => `<span style="padding:5px 12px;border-radius:20px;background:var(--dark3);border:1px solid var(--border);font-size:12px;font-weight:600;color:var(--text)">${escHtml(a)}</span>`).join("")}
          </div>
        </div>`
          : ""
      }

      <div style="margin-bottom:18px">
        <div style="font-size:11px;font-weight:700;color:var(--text-muted);letter-spacing:0.7px;text-transform:uppercase;margin-bottom:8px">Images</div>
        ${imgHtml}
      </div>

      <div style="background:var(--dark3);border-radius:12px;padding:16px;margin-top:8px;border:1px solid var(--border)">
        <div style="font-size:11px;font-weight:700;color:var(--text-muted);letter-spacing:0.7px;text-transform:uppercase;margin-bottom:10px">Admin Notes & Status</div>
        <textarea id="sellAdminNotes_${r.id}" rows="3"
          style="width:100%;padding:10px 13px;border-radius:8px;border:1px solid var(--border);
            font-size:13px;background:var(--dark2);outline:none;resize:vertical;font-family:inherit;color:var(--text)"
          placeholder="Add notes about this listing…">${escHtml(r.admin_notes || "")}</textarea>
        <div style="display:flex;gap:8px;margin-top:10px">
          ${["reviewed", "approved", "rejected"]
            .map(
              (s) => `
            <button onclick="updateSellStatus('${r.id}','${s}')"
              style="flex:1;padding:9px;border-radius:8px;border:1px solid var(--border);background:var(--dark2);
                font-size:12px;font-weight:700;cursor:pointer;color:var(--text-muted);transition:all 0.2s"
              onmouseover="this.style.background='var(--gold)';this.style.color='#000'"
              onmouseout="this.style.background='var(--dark2)';this.style.color='var(--text-muted)'">
              ${s.charAt(0).toUpperCase() + s.slice(1)}
            </button>`,
            )
            .join("")}
        </div>
      </div>
    </div>`;

  document.getElementById("sellModal").classList.remove("hidden");
}

function closeSellModal() {
  document.getElementById("sellModal").classList.add("hidden");
}

async function updateSellStatus(id, status) {
  const notes = document.getElementById(`sellAdminNotes_${id}`)?.value || "";
  const { error } = await supabase
    .from("sell_requests")
    .update({ review_status: status, admin_notes: notes })
    .eq("id", id);

  if (error) {
    showToast("Failed to update: " + error.message, "error");
    return;
  }

  const r = allSellRequests.find((x) => x.id === id);
  if (r) {
    r.review_status = status;
    r.admin_notes = notes;
  }
  updateSellStats(allSellRequests);
  updateSellBadge(allSellRequests);
  filterSellRequests();
  showToast(`Status updated to "${status}"`);
  closeSellModal();
}

async function approveSellRequest(id) {
  const r = allSellRequests.find((x) => x.id === id);
  if (!r) return;

  const confirmed = confirm(
    `Add "${r.title}" to the live property listings?\n\nThis will copy it to the Properties table and mark this request as Approved.`,
  );
  if (!confirmed) return;

  const payload = {
    title: r.title,
    property_type: r.property_type,
    status: r.status,
    price: r.price,
    location: r.location,
    sqft: r.sqft,
    bedrooms: r.bedrooms,
    bathrooms: r.bathrooms,
    kitchens: r.kitchens,
    description: r.description,
    features_description: r.features_description,
    property_details: r.property_details,
    utility_features: r.utility_features,
    outdoor_features: r.outdoor_features,
    whats_nearby: r.whats_nearby,
    amenities: r.amenities,
    images: r.images,
    floor_plans: r.floor_plans,
    agent: {
      name: r.contact_name,
      email: r.contact_email,
      phone: r.contact_phone,
    },
  };

  const { error: insertErr } = await supabase
    .from("properties")
    .insert([payload]);
  if (insertErr) {
    showToast("Failed to add property: " + insertErr.message, "error");
    return;
  }

  const { error: updateErr } = await supabase
    .from("sell_requests")
    .update({ review_status: "approved" })
    .eq("id", id);
  if (updateErr) showToast("Property added but status update failed.", "info");
  else {
    r.review_status = "approved";
    showToast(`✓ "${r.title}" added to live listings!`, "success");
  }

  updateSellStats(allSellRequests);
  updateSellBadge(allSellRequests);
  filterSellRequests();
  closeSellModal();
}

// ─── INIT ──────────────────────────────────────────────────────
checkSession();
