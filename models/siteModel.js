const mongoose = require('mongoose');

const siteSchema = new mongoose.Schema({
url: String,
title: String,
description: String,
keywords: String,
links: [String],
firstScraped: Date,
lastScraped: Date,
hasChanged: Boolean
});

const Site = mongoose.model('Site', siteSchema);

module.exports = Site;