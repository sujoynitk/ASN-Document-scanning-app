using com.example.asnscan as db from '../db/schema';

service ASNService @(path: '/asn') {

  @Capabilities.Insertable: true
  @Capabilities.Updatable:  true
  @Capabilities.Deletable:  false
  entity ASNStaging as projection on db.ASNStaging;

  /*
    Action: call VLM API to extract fields from uploaded document.
    Accepts the document as a base64-encoded string so the browser can
    send file bytes directly without needing a publicly accessible URL.
    mimeType : MIME type of the file  (e.g. "image/jpeg", "application/pdf")
    fileName : original filename      (e.g. "asn_delivery_note.pdf")
    Returns extracted fields + confidence scores (0-100).
  */
  action extractDocument(
    documentBase64 : String,
    mimeType       : String,
    fileName       : String
  ) returns {
    asnNumber   : String; asnNumberConf   : Integer;
    vendor      : String; vendorConf      : Integer;
    po          : String; poConf          : Integer;
    poItem      : String; poItemConf      : Integer;
    material    : String; materialConf    : Integer;
    qty         : String; qtyConf         : Integer;
    uom         : String; uomConf         : Integer;
    batch       : String; batchConf       : Integer;
    delivDate   : String; delivDateConf   : Integer;
    expiryDate  : String; expiryDateConf  : Integer;
  };
}