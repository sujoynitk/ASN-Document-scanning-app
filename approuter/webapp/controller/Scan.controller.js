sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/core/BusyIndicator"
], function (Controller, MessageToast, MessageBox, BusyIndicator) {
    "use strict";

    return Controller.extend("com.example.asnscan.controller.Scan", {

        // ── Lifecycle ──────────────────────────────────────────────────────
        onInit: function () {
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("scan").attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: function () {
            this._resetScan();
        },

        // ── Helpers ────────────────────────────────────────────────────────
        _getScanModel: function () {
            return this.getOwnerComponent().getModel("scan");
        },

_resetScan: function () {
    var oModel = this._getScanModel();
    oModel.setData({
        currentStep:  1,
        uploadedFiles: [],        // ← array instead of single file
        vlmResult:    null,
        editableFields: {
            asnNumber: "", vendor: "", po: "", poItem: "",
            material: "", qty: "", uom: "", batch: "",
            delivDate: "", expiryDate: ""
        },
        vlmConf: {
            asnNumber: 0, vendor: 0, po: 0, poItem: 0,
            material: 0, qty: 0, uom: 0, batch: 0,
            delivDate: 0, expiryDate: 0
        },
        submitting:   false,
        lastStagedId: "",
        lastStagedTs: ""
    });
},

// ── Take Photo (camera) ────────────────────────────────────────────────
onTakePhoto: function () {
    var oView = this.getView();

    // Fallback for very old browsers / iOS PWA without getUserMedia
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        var oFallback = document.createElement("input");
        oFallback.type = "file";
        oFallback.accept = "image/*";
        oFallback.capture = "environment";
        oFallback.onchange = (e) => this._handleFileSelection(e.target.files);
        oFallback.click();
        return;
    }

    // Build the dialog once and reuse it
    if (!this._oCameraDialog) {
        this._oCameraDialog = new sap.m.Dialog({
            title: "Take Photo",
            contentWidth: "360px",
            content: [
                new sap.ui.core.HTML({
                    content: [
                        '<div style="text-align:center;background:#000;border-radius:4px;overflow:hidden">',
                        '  <video id="asnCamVideo" autoplay playsinline muted',
                        '         style="width:100%;max-height:280px;display:block"></video>',
                        '  <canvas id="asnCamCanvas" style="display:none"></canvas>',
                        '</div>'
                    ].join("")
                })
            ],
            beginButton: new sap.m.Button({
                text: "Capture",
                type: "Emphasized",
                icon: "sap-icon://camera",
                press: this._capturePhoto.bind(this)
            }),
            endButton: new sap.m.Button({
                text: "Cancel",
                press: this._closeCameraDialog.bind(this)
            }),
            afterClose: this._stopCameraStream.bind(this)
        });
        oView.addDependent(this._oCameraDialog);
    }

    this._oCameraDialog.open();

    // Start stream after the dialog's DOM is ready
navigator.mediaDevices
    .getUserMedia({ video: { facingMode: "environment" }, audio: false })
    .then(function (stream) {
        self._oCameraStream = stream;
        var vid = document.getElementById("asnCamVideo");
        if (vid) {
            vid.srcObject = stream;
            vid.oncanplay = function () { vid.play(); };   // ensure play() is called
        }
    })
    .catch(function (err) {
        sap.m.MessageToast.show("Camera unavailable: " + err.message);
        self._closeCameraDialog();
    });
},


_capturePhoto: function () {
    var vid    = document.getElementById("asnCamVideo");
    var canvas = document.getElementById("asnCamCanvas");

    if (!vid || !canvas) {
        sap.m.MessageToast.show("Camera element not found");
        return;
    }

    var w = vid.videoWidth;
    var h = vid.videoHeight;

    // Stream not ready yet — dimensions are still 0
    if (!w || !h) {
        sap.m.MessageToast.show("Camera not ready yet — please try again");
        return;
    }

    canvas.width  = w;
    canvas.height = h;
    canvas.getContext("2d").drawImage(vid, 0, 0, w, h);

    var self = this;
    var fileName = "photo_" + Date.now() + ".jpg";

    // Primary path: toBlob (async, efficient)
    if (typeof canvas.toBlob === "function") {
        canvas.toBlob(function (blob) {
            if (!blob) {
                sap.m.MessageToast.show("Capture failed — please try again");
                return;
            }
            var file = new File([blob], fileName, { type: "image/jpeg" });
            self._handleFileSelection([file]);
            self._closeCameraDialog();
        }, "image/jpeg", 0.92);

    } else {
        // Fallback: toDataURL → Blob (synchronous, wider browser support)
        var dataUrl = canvas.toDataURL("image/jpeg", 0.92);
        var parts   = dataUrl.split(",");
        var raw     = atob(parts[1]);
        var bytes   = new Uint8Array(raw.length);
        for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
        var blob = new Blob([bytes], { type: "image/jpeg" });
        var file = new File([blob], fileName, { type: "image/jpeg" });
        self._handleFileSelection([file]);
        self._closeCameraDialog();
    }
},

_closeCameraDialog: function () {
    this._stopCameraStream();
    if (this._oCameraDialog) this._oCameraDialog.close();
},

_stopCameraStream: function () {
    if (this._oCameraStream) {
        this._oCameraStream.getTracks().forEach((t) => t.stop());
        this._oCameraStream = null;
    }
},

        // ── Tab navigation ─────────────────────────────────────────────────
        onTabSelect: function (oEvent) {
            var sKey = oEvent.getParameter("selectedKey");
            if (sKey === "controltower") {
                this.byId("mainTabBar").setSelectedKey("scan");
                this.getOwnerComponent().getRouter().navTo("controltower");
            } else {
                this._resetScan();
            }
        },

// ── Upload Documents (any type, multiple) ─────────────────────────────
onBrowseFile: function () {
    var self = this;
    var oInput = document.createElement("input");
    oInput.type = "file";
    oInput.accept = "image/*,application/pdf,.xlsx,.xls,.doc,.docx";
    oInput.multiple = true;
    oInput.onchange = function (e) {
        self._handleFileSelection(e.target.files);  // pass FileList, not event
    };
    oInput.click();
},

// ── Shared file handler ────────────────────────────────────────────────
_handleFileSelection: function (files) {
    var oModel = this.getView().getModel("scan");

    Array.from(files).forEach(function (file) {
        var oReader = new FileReader();
        oReader.onload = function (e) {
            // Always read CURRENT array from model inside the callback
            // (not a stale reference captured before async ops started)
            var aExisting = oModel.getProperty("/uploadedFiles") || [];
            aExisting.push({
                name:    file.name,
                type:    file.type,
                size:    file.size,
                dataUrl: e.target.result
            });
            oModel.setProperty("/uploadedFiles", aExisting);
            oModel.refresh(true);   // force expression bindings to re-evaluate
        };
        oReader.readAsDataURL(file);
    });
},

// ── Remove a file ──────────────────────────────────────────────────────
onRemoveFile: function (oEvent) {
    var oModel  = this._getScanModel();
    var aFiles  = oModel.getProperty("/uploadedFiles").slice();
    var oItem   = oEvent.getSource().getParent();
    var iIndex  = oItem.getParent().indexOfItem(oItem);
    aFiles.splice(iIndex, 1);
    oModel.setProperty("/uploadedFiles", aFiles);
},


// ── Extract ───────────────────────────────────────────────────────────
onExtract: function () {
    var oModel = this._getScanModel();
    var aFiles = oModel.getProperty("/uploadedFiles");
    if (!aFiles || aFiles.length === 0) {
        MessageBox.warning(this._i18n("msgNoFile"));
        return;
    }

    var oFirstFile = aFiles[0];
    if (!oFirstFile.dataUrl) {
        MessageBox.warning("File is still loading, please try again.");
        return;
    }

    var sBase64   = oFirstFile.dataUrl.split(",")[1];
    var sMimeType = oFirstFile.type || "application/octet-stream";
    var sFileName = oFirstFile.name || "document";
    var that      = this;

    BusyIndicator.show(0);

    // Fetch CSRF token first, then call the action directly (bypasses $batch)
    fetch("/asn/", { method: "HEAD", headers: { "X-CSRF-Token": "Fetch" } })
        .then(function (r) {
            var sToken = r.headers.get("X-CSRF-Token") || "unsafe";
            return fetch("/asn/extractDocument", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRF-Token": sToken
                },
                body: JSON.stringify({
                    documentBase64: sBase64,
                    mimeType:       sMimeType,
                    fileName:       sFileName
                })
            });
        })
        .then(function (r) {
            if (!r.ok) {
                return r.text().then(function (t) {
                    throw new Error("HTTP " + r.status + ": " + t);
                });
            }
            return r.json();
        })
        .then(function (oData) {
            // CAP OData v4 action response is wrapped in "value"
            var oResult = oData.value || oData;
            BusyIndicator.hide();
            oModel.setProperty("/vlmResult", oResult);
            oModel.setProperty("/vlmConf", {
                asnNumber:  oResult.asnNumberConf,
                vendor:     oResult.vendorConf,
                po:         oResult.poConf,
                poItem:     oResult.poItemConf,
                material:   oResult.materialConf,
                qty:        oResult.qtyConf,
                uom:        oResult.uomConf,
                batch:      oResult.batchConf,
                delivDate:  oResult.delivDateConf,
                expiryDate: oResult.expiryDateConf
            });
            oModel.setProperty("/editableFields", {
                asnNumber:  oResult.asnNumber,
                vendor:     oResult.vendor,
                po:         oResult.po,
                poItem:     oResult.poItem,
                material:   oResult.material,
                qty:        oResult.qty,
                uom:        oResult.uom,
                batch:      oResult.batch,
                delivDate:  oResult.delivDate,
                expiryDate: oResult.expiryDate
            });
            oModel.setProperty("/currentStep", 2);
        })
        .catch(function (oErr) {
            BusyIndicator.hide();
            MessageBox.error(that._i18n("msgExtractError") + "\n" + oErr.message);
        });
},

        // ── Step navigation ────────────────────────────────────────────────
        onBackToStep1: function () {
            this._getScanModel().setProperty("/currentStep", 1);
        },
        onGoToReview: function () {
            this._getScanModel().setProperty("/currentStep", 3);
        },
        onBackToStep2: function () {
            this._getScanModel().setProperty("/currentStep", 2);
        },

        // ── Step 3: Submit ─────────────────────────────────────────────────
onSubmit: function () {
    var oScanModel = this._getScanModel();
    var oFields    = oScanModel.getProperty("/editableFields");

    if (!oFields.asnNumber || !oFields.vendor || !oFields.po || !oFields.material) {
        MessageBox.warning("ASN Number, Vendor, Reference PO and Material are required.");
        return;
    }

    // Read first uploaded file for document storage
    var aFiles       = oScanModel.getProperty("/uploadedFiles") || [];
    var oFirstFile   = aFiles[0] || {};
    var sDocumentUrl = oFirstFile.name    || "";   // filename as reference
    var sDocumentData = oFirstFile.dataUrl || "";  // base64 for viewing

    oScanModel.setProperty("/submitting", true);
    BusyIndicator.show(0);

    var oPayload = {
        asnNumber:    oFields.asnNumber,
        vendor:       oFields.vendor,
        po:           oFields.po,
        poItem:       oFields.poItem,
        material:     oFields.material,
        qty:          oFields.qty,
        uom:          oFields.uom,
        batch:        oFields.batch,
        delivDate:    oFields.delivDate,
        expiryDate:   oFields.expiryDate,
        documentUrl:  sDocumentUrl,    // e.g. "delivery_note.pdf"
        documentData: sDocumentData,   // base64 dataUrl
        status:       "Pending"
    };

    fetch("/asn/", { method: "HEAD", headers: { "X-CSRF-Token": "Fetch" } })
        .then(function (r) {
            var sToken = r.headers.get("X-CSRF-Token") || "unsafe";
            return fetch("/asn/ASNStaging", {
                method:  "POST",
                headers: { "Content-Type": "application/json", "X-CSRF-Token": sToken },
                body: JSON.stringify(oPayload)
            });
        })
        .then(function (r) {
            if (!r.ok) {
                return r.text().then(function (t) { throw new Error("HTTP " + r.status + ":\n" + t); });
            }
            return r.json();
        })
        .then(function (oData) {
            BusyIndicator.hide();
            oScanModel.setProperty("/lastStagedId", oData.stagingId || "—");
            oScanModel.setProperty("/lastStagedTs",
                new Date().toISOString().replace("T", " ").substring(0, 19) + " UTC");
            oScanModel.setProperty("/submitting", false);
            oScanModel.setProperty("/currentStep", 4);
        })
        .catch(function (oErr) {
            BusyIndicator.hide();
            oScanModel.setProperty("/submitting", false);
            MessageBox.error("Submit failed:\n" + (oErr.message || String(oErr)));
        });
},        
        // ── Step 4: Actions ────────────────────────────────────────────────
        onNewScan: function () {
            this._resetScan();
        },

        onNavToControlTower: function () {
            this.getOwnerComponent().getRouter().navTo("controltower");
        },

        // ── i18n helper ────────────────────────────────────────────────────
        _i18n: function (sKey) {
            return this.getOwnerComponent()
                       .getModel("i18n")
                       .getResourceBundle()
                       .getText(sKey);
        }
    });
});