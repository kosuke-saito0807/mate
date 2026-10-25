/* Public-only deployment configuration. NEVER put a Turnstile secret here.
 * Fill endpoint and siteKey after Apps Script is deployed and tested.
 * Do not merge until SPARK live origin end-to-end QA is verified.
 */
window.MATE_DIRECT_INTAKE = Object.freeze({
  enabled: true,
  endpoint: "https://script.google.com/macros/s/AKfycbxpUkZ4tS5sZbZo6aan5urZF_p3eGAUPRRsZIw_H-ogz3wP3s9_vqKx5dWce_psf3iK/exec",
  siteKey: "0x4AAAAAAFj7hqLVxtwrjKAM"
});
