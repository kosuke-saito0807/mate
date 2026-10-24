/* Public-only deployment configuration. NEVER put a Turnstile secret here.
 * Fill endpoint and siteKey after Apps Script is deployed and tested.
 * Keep enabled:false until the review and staging smoke test pass.
 */
window.MATE_DIRECT_INTAKE = Object.freeze({
  enabled: false,
  endpoint: "",
  siteKey: ""
});
