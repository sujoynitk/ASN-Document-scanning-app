const cds = require("@sap/cds");

// ── VLM API URL ────────────────────────────────────────────────────────────
// Replace with your actual SAP Document Information Extraction / VLM endpoint
const VLM_API_URL = "https://vlm-api.example.com/extract";

module.exports = cds.service.impl(async function () {
  const { ASNStaging } = this.entities;

  // ── Generate staging ID ────────────────────────────────────────────────
  async function nextStagingId(db) {
    const result = await db.run(
      SELECT.one.from(ASNStaging).columns("count(*) as cnt")
    );
    const seq = String((result?.cnt ?? 0) + 1).padStart(4, "0");
    const yr = new Date().getFullYear();
    return `STG-${yr}-${seq}`;
  }

  // ── Before CREATE: assign stagingId, status, createdBy ────────────────
  this.before("CREATE", ASNStaging, async (req) => {
    if (!req.data.stagingId) {
      req.data.stagingId = await nextStagingId(cds.db);
    }
    if (!req.data.status)    req.data.status    = "Pending";
    if (!req.data.createdBy) {
      var sUser = req.user?.id;
      req.data.createdBy = (sUser && sUser !== "privileged") ? sUser : "system";
    }
  });

  // ── Action: extractDocument ────────────────────────────────────────────
  // Accepts the document as a base64-encoded string (sent directly from the
  // browser) together with its MIME type and original file name.
  // In development, returns mock data so the app works without a real endpoint.
  this.on("extractDocument", async (req) => {
    const { documentBase64, mimeType, fileName } = req.data;

    if (!documentBase64) {
      req.error(400, "No document content received (documentBase64 is empty)");
      return;
    }

    if (
      process.env.NODE_ENV === "production" &&
      VLM_API_URL !== "https://vlm-api.example.com/extract"
    ) {
      // ── Real VLM call ────────────────────────────────────────────────
      // Option A — JSON body with base64 (most REST/LLM vision APIs)
      const fetch = (await import("node-fetch")).default;
      const resp = await fetch(VLM_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentBase64, mimeType, fileName }),
      });

      // Option B — multipart/form-data binary upload (uncomment if needed)
      // const FormData = (await import("form-data")).default;
      // const buffer   = Buffer.from(documentBase64, "base64");
      // const form     = new FormData();
      // form.append("file", buffer, { filename: fileName, contentType: mimeType });
      // const resp = await fetch(VLM_API_URL, { method: "POST", body: form });

      if (!resp.ok) req.error(502, "VLM API error: " + resp.statusText);
      const data = await resp.json();
      return {
        asnNumber:  data.asnNumber,  asnNumberConf:  data.asnNumberConf  ?? 0,
        vendor:     data.vendor,     vendorConf:     data.vendorConf     ?? 0,
        po:         data.po,         poConf:         data.poConf         ?? 0,
        poItem:     data.poItem,     poItemConf:     data.poItemConf     ?? 0,
        material:   data.material,   materialConf:   data.materialConf   ?? 0,
        qty:        data.qty,        qtyConf:        data.qtyConf        ?? 0,
        uom:        data.uom,        uomConf:        data.uomConf        ?? 0,
        batch:      data.batch,      batchConf:      data.batchConf      ?? 0,
        delivDate:  data.delivDate,  delivDateConf:  data.delivDateConf  ?? 0,
        expiryDate: data.expiryDate, expiryDateConf: data.expiryDateConf ?? 0,
      };
    }

    // ── Mock VLM response (development / demo) ───────────────────────
    return {
      asnNumber:  "800012345",     asnNumberConf:  97,
      vendor:     "1000042",       vendorConf:     99,
      po:         "4500012876",    poConf:         97,
      poItem:     "10",            poItemConf:     95,
      material:   "88201",         materialConf:   91,
      qty:        "2400",          qtyConf:        96,
      uom:        "EA",            uomConf:        99,
      batch:      "B-20240601-A",  batchConf:      83,
      delivDate:  "2024-06-18",    delivDateConf:  94,
      expiryDate: "2025-12-31",    expiryDateConf: 78,
    };
  });
});