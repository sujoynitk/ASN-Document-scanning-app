# ASN Co-packer Scanning — SAP BTP Application

## Project structure

```
asn-btp-app/
├── db/
│   ├── schema.cds            ← CDS entity definition (auto-creates HANA table)
│   └── T_ASN_STAGING_DDL.sql ← Manual SQL DDL (reference / non-HDI deploy)
├── srv/
│   ├── asn-service.cds       ← OData V4 service + extractDocument action
│   └── asn-service.js        ← CAP handler: VLM call + stagingId generation
├── app/
│   └── asn-scan/
│       ├── ui5.yaml
│       ├── xs-app.json       ← Approuter route config
│       └── webapp/
│           ├── index.html
│           ├── Component.js
│           ├── manifest.json
│           ├── view/
│           │   ├── App.view.xml
│           │   ├── Scan.view.xml          ← 4-step scan wizard
│           │   └── ControlTower.view.xml  ← KPI + table dashboard
│           ├── controller/
│           │   ├── App.controller.js
│           │   ├── Scan.controller.js
│           │   └── ControlTower.controller.js
│           ├── model/models.js
│           ├── i18n/i18n.properties
│           └── css/style.css
├── xs-security.json
├── mta.yaml                  ← MTA deployment descriptor
├── .cdsrc.json
└── package.json
```

## Local development (BAS)

```bash
# 1. Open in BAS — File > Open Workspace > select asn-btp-app folder
# 2. Install dependencies
npm install

# 3. Run locally with SQLite (no HANA needed)
npm run dev
# → CAP server starts at http://localhost:4004
# → UI5 app at http://localhost:4004/asn-scan/webapp/index.html
```

## Deploy to Cloud Foundry

```bash
# 1. Login to CF
cf login -a <API_ENDPOINT> -o <ORG> -s <SPACE>

# 2. Build MTA
mbt build

# 3. Deploy
cf deploy mta_archives/asn-btp-app_1.0.0.mtar
```

## VLM API configuration

The dummy VLM URL is in `srv/asn-service.js`:
```js
const VLM_API_URL = "https://vlm-api.example.com/extract";
```
Replace with your SAP Document Information Extraction endpoint or any
VLM REST API that accepts `{ documentUrl }` and returns the field schema
defined in `srv/asn-service.cds` (extractDocument action return type).

## HANA staging table

The table `COM_EXAMPLE_ASNSCAN_ASNSTAGING` is created automatically
by the HDI container during `cf deploy`.

For manual/non-HDI environments use `db/T_ASN_STAGING_DDL.sql`.

## OData endpoint (local)

- Service:  http://localhost:4004/asn
- Entities: http://localhost:4004/asn/ASNStaging
- Action:   POST http://localhost:4004/asn/extractDocument
