sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/ui/Device"
], function (JSONModel, Device) {
    "use strict";
    return {
        createDeviceModel: function () {
            var oModel = new JSONModel(Device);
            oModel.setDefaultBindingMode("OneWay");
            return oModel;
        },
        createScanModel: function () {
            return new JSONModel({
                currentStep: 1,         // 1=Upload 2=Extract 3=Review 4=Staged
                uploadedFile: null,
                documentUrl: "",
                vlmResult: null,        // raw VLM extraction
                editableFields: {       // operator-edited values (step 3)
                    vendor:    "", vendorId: "",
                    po:        "", delivDate: "",
                    material:  "", qty: "",
                    batch:     "", plant: "",
                    weight:    "", inco: ""
                },
                vlmConf: {              // confidence scores 0-100
                    vendor:    0, vendorId: 0,
                    po:        0, delivDate: 0,
                    material:  0, qty: 0,
                    batch:     0, plant: 0,
                    weight:    0, inco: 0
                },
                submitting: false,
                lastStagedId: "",
                lastStagedTs:  ""
            });
        }
    };
});
