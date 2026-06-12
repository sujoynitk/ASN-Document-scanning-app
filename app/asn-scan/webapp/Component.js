sap.ui.define([
    "sap/ui/core/UIComponent",
    "sap/ui/Device",
    "com/example/asnscan/model/models"
], function (UIComponent, Device, models) {
    "use strict";

    return UIComponent.extend("com.example.asnscan.Component", {
        metadata: { manifest: "json" },

        init: function () {
            UIComponent.prototype.init.apply(this, arguments);
            this.setModel(models.createDeviceModel(), "device");
            // scan state model shared across views
            this.setModel(models.createScanModel(), "scan");
            this.getRouter().initialize();
        }
    });
});
