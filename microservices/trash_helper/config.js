// SPDX-License-Identifier: AGPL-3.0-or-later
// Deployment settings. The map background is configurable so a deployment can point to a
// tile server whose terms fit its traffic (OSM's public tiles are for light use only:
// https://operations.osmfoundation.org/policies/tiles/). Nothing is pre-fetched.
"use strict";
window.TH_CONFIG = {
  tiles: {
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "© OpenStreetMap contributors",
    maxZoom: 19,
  },
};
