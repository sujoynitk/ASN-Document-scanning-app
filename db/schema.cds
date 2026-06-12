namespace com.example.asnscan;

/*
  HANA Table: COM_EXAMPLE_ASNSCAN_ASNSTAGING
  (CDS auto-generates the HANA artefact from this definition)
*/
entity ASNStaging {
  key stagingId   : String(20);
      asnNumber   : String(20);       // VBELN – ASN / delivery document number
      vendor      : String(20);       // LIFNR – Co-packer vendor number (BP master)
      po          : String(20);       // EBELN – Reference Purchase Order number
      poItem      : String(10);       // EBELP – PO line item (10, 20, 30…)
      material    : String(40);       // MATNR – SAP material number / Monster SKU
      qty         : String(20);       // LFIMG – Delivery quantity
      uom         : String(10);       // MEINS/BSTME – Unit of measure
      batch       : String(30);       // CHARG – Production batch / lot number
      delivDate   : String(10);       // LFDAT – Planned delivery date YYYY-MM-DD
      expiryDate  : String(10);       // VFDAT – Best-before / expiry date YYYY-MM-DD
      documentUrl : String(500);      // Object Store URL of scanned document
      documentData : LargeString;   // stores base64 dataUrl for viewing
      status      : String(20) default 'Pending';
                                      // Pending | Processed | Under Review | Error
      createdAt   : Timestamp @cds.on.insert: $now;
      createdBy   : String(100);      // Staged By – user who submitted the scan
      modifiedAt  : Timestamp @cds.on.update: $now;
}