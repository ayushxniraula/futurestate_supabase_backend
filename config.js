// ============================================================
//  EstateAdmin — Supabase Config (database only — images moved to cPanel)
// ============================================================

const SUPABASE_URL = "https://afwvbftvfubboorpiszu.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFmd3ZiZnR2ZnViYm9vcnBpc3p1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExNjg4MzksImV4cCI6MjA5Njc0NDgzOX0.vw7hvZMrNeS_vqU7By6C69F1SsN_mWY6gSs2ipliLZY";

const STORAGE_BUCKET = "FutureState"; // no longer used for images, kept in case other code references it

const { createClient } = window.supabase;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================================
//  cPanel Image Upload Config
// ============================================================
// Point these at the upload.php / delete.php files you uploaded
// to your cPanel hosting (see setup instructions).
const CPANEL_UPLOAD_URL = "https://futurestateagency.com/upload.php";
const CPANEL_DELETE_URL = "https://futurestateagency.com/delete.php";

// Must match $UPLOAD_SECRET in upload.php / delete.php.
// Leave as "" if you left the PHP secret blank too.
const CPANEL_UPLOAD_SECRET = "";
