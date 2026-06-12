const cds     = require('@sap/cds');
const express = require('express');

cds.on('bootstrap', app => {
    app.use(express.json({ limit: '50mb' }));
    app.use(express.text({ limit: '50mb', type: '*/*' }));
});

module.exports = cds.server;