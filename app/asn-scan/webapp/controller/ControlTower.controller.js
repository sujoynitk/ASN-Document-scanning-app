sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/core/BusyIndicator",
    "sap/ui/layout/form/SimpleForm"
], function (Controller, JSONModel, Filter, FilterOperator, MessageToast, MessageBox, BusyIndicator, SimpleForm) {
    "use strict";

    // Must match column order in ControlTower.view.xml exactly
    var COLUMNS = [
        { key: "stagingId",  label: "Staging ID",       visible: true  },
        { key: "asnNumber",  label: "ASN Number",       visible: true  },
        { key: "vendor",     label: "Vendor",           visible: true  },
        { key: "po",         label: "Reference PO",     visible: true  },
        { key: "poItem",     label: "PO Item",          visible: false },
        { key: "material",   label: "Material",         visible: true  },
        { key: "qty",        label: "Qty",              visible: true  },
        { key: "uom",        label: "UoM",              visible: false },
        { key: "batch",      label: "Batch",            visible: false },
        { key: "delivDate",  label: "Del. Date",        visible: true  },
        { key: "expiryDate", label: "Expiry Date",      visible: false },
        { key: "createdAt",  label: "Staged At (UTC)",  visible: true  },
        { key: "createdBy",  label: "Staged By",        visible: false },
        { key: "status",     label: "Status",           visible: true  },
        { key: "documentUrl", label: "Document",        visible: false },
    ];

    return Controller.extend("com.example.asnscan.controller.ControlTower", {

        // ── Formatters ─────────────────────────────────────────────────────
        formatter: {
            formatTimestamp: function (sIso) {
                if (!sIso) return "";
                return sIso.replace("T", " ").substring(0, 19) + " UTC";
            },
            statusState: function (sStatus) {
                var mStates = {
                    "Pending":      "Information",
                    "Processed":    "Success",
                    "Under Review": "Warning",
                    "Error":        "Error"
                };
                return mStates[sStatus] || "None";
            }
        },

        // ── Lifecycle ──────────────────────────────────────────────────────
        onInit: function () {
            this._aColumns = COLUMNS.map(function (c) {
                return { key: c.key, label: c.label, visible: c.visible };
            });

            var oCTModel = new JSONModel({
                kpi: { total: 0, pending: 0, processed: 0, review: 0, error: 0 },
                recordCountText: "",
                columns: this._aColumns
            });
            this.getView().setModel(oCTModel, "ct");

            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("controltower").attachPatternMatched(this._onRouteMatched, this);

            this.getView().addEventDelegate({
                onAfterRendering: this._attachKpiClicks.bind(this)
            });
        },

        _attachKpiClicks: function () {
            var that = this;
            var aCards = [
                { id: "kpiCardAll",       key: "" },
                { id: "kpiCardPending",   key: "Pending" },
                { id: "kpiCardProcessed", key: "Processed" },
                { id: "kpiCardReview",    key: "Under Review" },
                { id: "kpiCardError",     key: "Error" }
            ];
            aCards.forEach(function (o) {
                var oCtrl = that.byId(o.id);
                if (oCtrl) {
                    oCtrl.$().off("click.kpi").on("click.kpi", function () {
                        that._filterByKpi(o.key);
                    });
                }
            });
        },

        _filterByKpi: function (sKey) {
            var oSelect = this.byId("ctStatusFilter");
            if (oSelect) { oSelect.setSelectedKey(sKey); }
            this._applyFilters();
            this._setActiveKpiCard(sKey);
        },

        _setActiveKpiCard: function (sKey) {
            var that = this;
            var aMap = [
                { id: "kpiCardAll",       key: "" },
                { id: "kpiCardPending",   key: "Pending" },
                { id: "kpiCardProcessed", key: "Processed" },
                { id: "kpiCardReview",    key: "Under Review" },
                { id: "kpiCardError",     key: "Error" }
            ];
            aMap.forEach(function (o) {
                var oCtrl = that.byId(o.id);
                if (oCtrl) {
                    oCtrl.$().toggleClass("asnKpiCardActive", o.key === sKey);
                }
            });
        },

        _onRouteMatched: function () {
            var oTabBar = this.byId("ctTabBar");
            if (oTabBar) { oTabBar.setSelectedKey("controltower"); }

            var oSearch = this.byId("ctSearch");
            if (oSearch) { oSearch.setValue(""); }
            var oSelect = this.byId("ctStatusFilter");
            if (oSelect) { oSelect.setSelectedKey(""); }
            this._setActiveKpiCard("");

            this._refreshTable();
        },

        // ── Refresh / load ─────────────────────────────────────────────────
        onRefresh: function () {
            this._refreshTable();
            MessageToast.show("Refreshed");
        },

        _refreshTable: function () {
            var oTable = this.byId("ctTable");
            if (!oTable) { return; }
            var oBinding = oTable.getBinding("items");
            if (!oBinding) { return; }
            this._bFilterActive = false;
            oBinding.filter([]);
            oBinding.refresh();
        },

        onTableUpdateFinished: function () {
            if (!this._bFilterActive) {
                this._updateKpis();
            }
            this._applyColumnVisibility();
        },

        _updateKpis: function () {
            var oTable = this.byId("ctTable");
            if (!oTable) { return; }
            var aItems = oTable.getItems();
            var oKpi = { total: 0, pending: 0, processed: 0, review: 0, error: 0 };
            aItems.forEach(function (oItem) {
                var sStatus = oItem.getBindingContext("asn").getProperty("status");
                oKpi.total++;
                if (sStatus === "Pending")      { oKpi.pending++; }
                if (sStatus === "Processed")    { oKpi.processed++; }
                if (sStatus === "Under Review") { oKpi.review++; }
                if (sStatus === "Error")        { oKpi.error++; }
            });
            var oCTModel = this.getView().getModel("ct");
            oCTModel.setProperty("/kpi", oKpi);
            oCTModel.setProperty("/recordCountText",
                aItems.length + " record" + (aItems.length !== 1 ? "s" : ""));
        },

        // ── Column visibility ──────────────────────────────────────────────
        _applyColumnVisibility: function () {
            var oTable = this.byId("ctTable");
            if (!oTable) { return; }
            var aTableCols = oTable.getColumns();
            this._aColumns.forEach(function (oColDef, i) {
                if (aTableCols[i]) {
                    aTableCols[i].setVisible(oColDef.visible);
                }
            });
        },

onColumnSettings: function () {
    var that      = this;
    var oCTModel  = this.getView().getModel("ct");

    if (!this._oColDialog) {
        this._oColDialog = new sap.m.Dialog({
            title: "Show / Hide Columns",
            contentWidth: "22rem",
            beginButton: new sap.m.Button({
                text: "Apply",
                type: "Emphasized",
                press: function () {
                    that._applyColumnVisibility();
                    that._oColDialog.close();
                }
            }),
            endButton: new sap.m.Button({
                text: "Cancel",
                press: function () { that._oColDialog.close(); }
            }),
            content: [
                // ── Select All / Deselect All toolbar ──────────────────
                new sap.m.Toolbar({
                    style: "Clear",
                    content: [
                        new sap.m.CheckBox({
                            id: that.createId("chkSelectAll"),
                            text: "Select All",
                            select: function (oEvt) {
                                var bChecked = oEvt.getParameter("selected");
                                var aCols    = oCTModel.getProperty("/columns");
                                aCols.forEach(function (c) { c.visible = bChecked; });
                                oCTModel.setProperty("/columns", aCols.slice());
                                // clear partial state
                                oEvt.getSource().setPartiallySelected(false);
                            }
                        })
                    ]
                }),
                new sap.m.List({
                    showSeparators: "Inner",
                    items: {
                        path: "ct>/columns",
                        template: new sap.m.CustomListItem({
                            content: [
                                new sap.m.CheckBox({
                                    text:     "{ct>label}",
                                    selected: "{ct>visible}",
                                    select: function (oEvt) {
                                        var oCtx = oEvt.getSource().getBindingContext("ct");
                                        oCTModel.setProperty(
                                            oCtx.getPath() + "/visible",
                                            oEvt.getParameter("selected")
                                        );
                                        that._syncSelectAll(oCTModel);
                                    }
                                })
                            ]
                        })
                    }
                })
            ]
        });
        this.getView().addDependent(this._oColDialog);
    }

    // Sync the Select All checkbox state every time dialog opens
    this._syncSelectAll(oCTModel);
    this._oColDialog.open();
},

// ── Keep "Select All" checkbox in sync with individual selections ──────
_syncSelectAll: function (oCTModel) {
    var oChk  = this.byId("chkSelectAll");
    if (!oChk) return;
    var aCols       = oCTModel.getProperty("/columns");
    var nVisible    = aCols.filter(function (c) { return c.visible; }).length;
    var bAll        = nVisible === aCols.length;
    var bPartial    = nVisible > 0 && !bAll;
    oChk.setSelected(bAll);
    oChk.setPartiallySelected(bPartial);
},

        // ── Search & filter ────────────────────────────────────────────────
        onSearch: function () {
            this._applyFilters();
        },

        onStatusFilter: function () {
            this._applyFilters();
        },

        _applyFilters: function () {
            var oTable = this.byId("ctTable");
            if (!oTable) { return; }
            this._bFilterActive = true;
            var aFilters = [];

            var sQuery = this.byId("ctSearch").getValue().trim();
            if (sQuery) {
                aFilters.push(new Filter({
                    filters: [
                        new Filter("stagingId",  FilterOperator.Contains, sQuery),
                        new Filter("asnNumber",  FilterOperator.Contains, sQuery),
                        new Filter("vendor",     FilterOperator.Contains, sQuery),
                        new Filter("po",         FilterOperator.Contains, sQuery),
                        new Filter("material",   FilterOperator.Contains, sQuery)
                    ],
                    and: false
                }));
            }

            var sStatus = this.byId("ctStatusFilter").getSelectedKey();
            if (sStatus) {
                aFilters.push(new Filter("status", FilterOperator.EQ, sStatus));
            }

            var oCombined = aFilters.length > 1
                ? new Filter({ filters: aFilters, and: true })
                : (aFilters[0] || []);

            oTable.getBinding("items").filter(oCombined);
        },

// ── Row press → fetch full record then open dialog ─────────────────
onRowPress: function (oEvent) {
    var oCtx      = oEvent.getSource().getBindingContext("asn");
    var oListData = oCtx.getObject();
    var sPath     = oCtx.getPath();   // e.g. "/ASNStaging(STG-2024-0001)"
                                       // works with any key — ID, stagingId, etc.
    var that = this;
    BusyIndicator.show(0);

    this.getOwnerComponent().getModel("asn")
        .bindContext(sPath)
        .requestObject()
        .then(function (oFullData) {
            BusyIndicator.hide();
            that._openDetailDialog(oFullData);
        })
        .catch(function () {
            BusyIndicator.hide();
            that._openDetailDialog(oListData);  // fallback
        });
},

        // ── Build / populate detail dialog ─────────────────────────────────
        _openDetailDialog: function (oData) {
            if (!this._oDetailDialog) {
                this._oDetailDialog = new sap.m.Dialog({
                    title: "Record Detail",
                    contentWidth: "36rem",
                    resizable: true,
                    draggable: true,
                    content: [
                        new SimpleForm({
                            id: this.createId("detailForm"),
                            editable: false,
                            layout: "ResponsiveGridLayout",
                            labelSpanL: 4, labelSpanM: 4, labelSpanS: 12,
                            columnsL: 2, columnsM: 2
                        })
                    ]
                });
                this.getView().addDependent(this._oDetailDialog);
            }

            var oForm = this.byId("detailForm");
            oForm.destroyContent();

            var aFields = [
                ["Staging ID",      oData.stagingId],
                ["Status",          oData.status],
                ["ASN Number",      oData.asnNumber],
                ["Vendor (LIFNR)",  oData.vendor],
                ["Reference PO",    oData.po],
                ["PO Item",         oData.poItem],
                ["Material",        oData.material],
                ["Quantity",        oData.qty],
                ["Unit of Measure", oData.uom],
                ["Batch Number",    oData.batch],
                ["Delivery Date",   oData.delivDate],
                ["Expiry Date",     oData.expiryDate],
                ["Staged At (UTC)", this.formatter.formatTimestamp(oData.createdAt)],
                ["Staged By",       oData.createdBy],
                ["Document",        oData.documentUrl || "—"]
            ];
            aFields.forEach(function (aF) {
                oForm.addContent(new sap.m.Label({ text: aF[0], design: "Bold" }));
                oForm.addContent(new sap.m.Text({ text: aF[1] || "—" }));
            });

            // Rebuild buttons for this record
            this._oDetailDialog.removeAllButtons();
            this._oDetailDialog.setEndButton(
                new sap.m.Button({
                    text: "Close",
                    press: function () { this._oDetailDialog.close(); }.bind(this)
                })
            );

            // if (oData.documentData) {
            //     this._sCurrentDocumentData = oData.documentData;
            //     this._oDetailDialog.setBeginButton(
            //         new sap.m.Button({
            //             text: "View Document",
            //             icon: "sap-icon://document",
            //             type: "Emphasized",
            //             press: this.onViewDocument.bind(this)
            //         })
            //     );
            // } else {
            //     this._oDetailDialog.destroyBeginButton();
            // }

            this._oDetailDialog.open();
        },

_openDataUrl: function (sDataUrl) {
    // Browsers block direct navigation to data: URLs — use a Blob URL instead
    var sParts  = sDataUrl.split(",");
    var sMime   = sParts[0].match(/:(.*?);/)[1];
    var sRaw    = atob(sParts[1]);
    var aBytes  = new Uint8Array(sRaw.length);
    for (var i = 0; i < sRaw.length; i++) {
        aBytes[i] = sRaw.charCodeAt(i);
    }
    var oBlob   = new Blob([aBytes], { type: sMime });
    var sBlobUrl = URL.createObjectURL(oBlob);
    window.open(sBlobUrl, "_blank");
    // Release memory after the tab has had time to load
    setTimeout(function () { URL.revokeObjectURL(sBlobUrl); }, 10000);
},

        // ── Open stored document in new tab ────────────────────────────────
onViewDocument: function () {
    var sData = this._sCurrentDocumentData;
    if (!sData) {
        MessageToast.show("No document stored for this record.");
        return;
    }
    this._openDataUrl(sData);
},

onViewDocumentFromTable: function (oEvent) {
    var oCtx  = oEvent.getSource().getBindingContext("asn");
    var sPath = oCtx.getPath();
    var sName = oCtx.getProperty("documentUrl");

    if (!sName) {
        MessageToast.show("No document for this record.");
        return;
    }

    BusyIndicator.show(0);
    var that = this;

    // Fetch full record to get documentData (not in list response)
    this.getOwnerComponent().getModel("asn")
        .bindContext(sPath)
        .requestObject()
.then(function (oFullData) {
    BusyIndicator.hide();
    if (oFullData.documentData) {
        that._openDataUrl(oFullData.documentData);
    } else {
        MessageToast.show("Document data not stored for this record.");
    }
})
        .catch(function () {
            BusyIndicator.hide();
            MessageToast.show("Failed to load document.");
        });
},

        // ── Navigation ────────────────────────────────────────────────────
        onNavToScan: function () {
            this.getOwnerComponent().getRouter().navTo("scan");
        },

        onTabSelect: function (oEvent) {
            var sKey = oEvent.getParameter("selectedKey");
            if (sKey === "scan") {
                var oTabBar = this.byId("ctTabBar");
                if (oTabBar) { oTabBar.setSelectedKey("controltower"); }
                this.getOwnerComponent().getRouter().navTo("scan");
            }
        }
    });
});