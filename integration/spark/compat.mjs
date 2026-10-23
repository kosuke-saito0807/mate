/** MATE SPARK migration helpers: no network, no DB, no deployment. */
export const CURRENT_FAVORITES_KEY = "mateSparkFavIds";
export const LEGACY_REACT_FAVORITES_KEY = "naraico-favorites";
export const COMPARISON_LIMIT = 5;
const normalizeIds = (v) => Array.isArray(v) ? [...new Set(v.filter((x) => typeof x === "string" && x.length > 0 && x.length <= 120))] : [];
const parseIds = (raw) => { try { return normalizeIds(JSON.parse(raw)); } catch { return []; } };
export function migrateFavorites(storage, { dryRun = false } = {}) {
  if (!storage || typeof storage.getItem !== "function") return { ok: false, reason: "storage-unavailable" };
  try {
    const before = parseIds(storage.getItem(CURRENT_FAVORITES_KEY));
    const legacy = parseIds(storage.getItem(LEGACY_REACT_FAVORITES_KEY));
    const ids = [...new Set([...before, ...legacy])];
    const changed = ids.length !== before.length;
    if (changed && !dryRun && typeof storage.setItem === "function")
      storage.setItem(CURRENT_FAVORITES_KEY, JSON.stringify(ids));
    return { ok: true, changed, existing: before.length, legacy: legacy.length, total: ids.length, ids };
  } catch { return { ok: false, reason: "storage-access-failed" }; }
}
export function normalizeApprovedSchool(s) {
  if (!s || typeof s !== "object" || Array.isArray(s) || s.approved !== true || s.demo === true) return null;
  if (typeof s.id !== "string" || !s.id || typeof s.name !== "string" || !s.name || typeof s.region !== "string" || !s.region) return null;
  const text = (v, n) => typeof v === "string" ? v.slice(0,n) : "";
  const strings = (v) => Array.isArray(v) ? [...new Set(v.filter(x=>typeof x==="string").slice(0,20))] : [];
  const amount = (v) => Number.isInteger(v) && v >= 0 && v <= 1000000 ? v : null;
  const out = {
    id:text(s.id,120),name:text(s.name,160),prefecture:text(s.region,20),
    city:text(s.area,120),station:text(s.station,100),category:text(s.category,60),
    description:text(s.description,500),ages:strings(s.ages),weekdays:strings(s.weekdays),
    tags:strings(s.tags),website:/^https:\/\/[^<>"']+$/i.test(s.url||"")?text(s.url,500):"",
    monthlyFee:amount(s.monthlyPrice),trialFee:amount(s.trialPrice),
    ageMin:amount(s.ageMin),ageMax:amount(s.ageMax),
    acceptsTrial:s.acceptsTrial===true,verifiedAt:text(s.verifiedAt,10),
    approved:true,demo:false
  };
  if (out.ageMin!==null && out.ageMax!==null && out.ageMin>out.ageMax) return null;
  if (s.acceptsTrial===true && /^\d{4}-\d{2}-\d{2}$/.test(s.nextTrialDate||"")) out.nextTrialDate=s.nextTrialDate;
  return out;
}
export function buildApprovedPreview(rows) {
  if (!Array.isArray(rows)) throw new TypeError("Expected public JSON array");
  const seen=new Set(), result=[];
  for(const row of rows) {
    const school=normalizeApprovedSchool(row);
    if(!school) continue;
    if(seen.has(school.id)) throw new Error("Duplicate approved school id");
    seen.add(school.id);
    result.push(school);
  }
  return result;
}
