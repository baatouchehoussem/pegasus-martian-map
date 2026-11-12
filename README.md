# Interplanetary Survival Guide: Martian Map

A tactical, hyperlocal Marswalk planning experience for the NASA Space Apps Challenge. Global planetary browsers answer *where on Mars?* This application asks *which ridge, which approach, how much suit margin, and what does the crew see on arrival?* It combines a Mars-radius Cesium globe, selectable science overlays, obstacle-aware EVA routing, robotic-companion simulation, rover-context inspection, and an astronaut visor mode.

## Run

```bash
npm install
npm run dev
npm run build
npm run preview
```

Requires Node 20+. Vite serves on `0.0.0.0`; deploy the built `dist` directory to Vercel (framework preset: Vite, build command: `npm run build`). No tokens or API keys are required. Cesium Workers/Assets/Widgets/ThirdParty are copied into `/cesium` at build time.

## Mission workflow

1. Select **Mount Sharp / Gale Crater** or **Jezero / Neretva Vallis** in the mission-area selector.
2. Toggle optical, mobility, weather, and mineral layers; adjust their opacity and scrub local sol time.
3. Click a waypoint for geology, arrival notes, and a NASA-hosted rover *context* photo. Click near the mission zone on the globe to insert a custom waypoint. Hazard avoidance inserts lateral detours around modeled boulder and steep-slope zones.
4. Play the EVA to follow two crew members and a cargo rover; inspect estimated range, elevation, duration, consumables, and radiation. The lightning button injects a solar particle event.
5. Switch to Visor HUD or launch the guided demo (scripted ~22-second compressed walkthrough, designed for a three-minute narrated pitch).

## Data provenance and scientific integrity

| Reference | Role | Runtime behavior |
|---|---|---|
| HiRISE (MRO), CTX (MRO) | Optical-resolution and obstacle interpretation | Referenced layer; procedural textured globe always available |
| MOLA (Mars Global Surveyor), HiRISE DEM | Elevation and mobility concepts | Modeled contour and hazard overlays; not a fetched DEM |
| RAD (Curiosity), THEMIS (Mars Odyssey) | Radiation and surface thermal context | Illustrative sol-time temperature, dust and dose model |
| CRISM (MRO) | Hydrated-mineral context | Curated candidate target overlay, not pixel-level spectra |
| Curiosity / Perseverance | Rover ground truth | NASA-hosted contextual surface images with an offline-unavailable state |

The landing regions and scientifically interesting geology are real; **the waypoint coordinates, hazard radii, contour geometry, mineral assignments, rover offsets, solar event, and consumables are illustrative planning-scale simulations**, not measured local science products. NASA imagery is *contextual*, not claimed to be captured at the displayed waypoint. Remote image links may change or be unavailable; the globe and mission controls do not depend on them. No live NASA WMTS or WMS service is used: this avoids misrepresenting arbitrary map tiles as a calibrated Mars basemap and ensures a keyless, CORS-independent globe on Vercel. The procedural surface is a deterministic Mars-colored global raster on a Mars ellipsoid, not a true HiRISE image or high-resolution DEM. Local hazard annotations are stored in `src/data/zones.ts` and `src/data/field-sites.geojson`.

**Never use this application for real EVA safety decisions.** The slope legend follows the requested operational thresholds (<10° safe, 10–18° caution, >18° extreme), but slope and route values here derive from modeled waypoint elevation differences; they are not a HiRISE slope raster. Route distances use a 3,389.5 km spherical Mars approximation; consumption and dose rates are explanatory planning assumptions, not flight-system limits. Alerts use illustrative thresholds of 75% O₂ and 1 mSv cumulative dose.

## Architecture

- `src/components/MarsScene.tsx`: Cesium Viewer lifecycle, Mars ellipsoid, deterministic basemap, entities, click picking, camera transitions, companion avatars.
- `src/data/zones.ts` and `src/data/field-sites.geojson`: two region-specific planning datasets, target mineral notes, hazards and photo references.
- `src/utils/mission.ts`: great-circle distance, segment-to-hazard detection, detours and EVA estimate calculations.
- `src/types/mission.ts`: strictly typed geographic, route and science-layer interfaces.
- `src/App.tsx`: mission-control UI, time scrubber, waypoint inspector, alerts, guided sequence and visor.

The stack is React 18, TypeScript, Vite, CesiumJS, Tailwind and Lucide. The deterministic basemap has no external runtime dependency; NASA-hosted context photographs and Google Fonts are optional enhancements. For an operational successor, replace the illustrative products with vetted, georeferenced HiRISE/CTX tile pyramids, calibrated DEMs, CRISM spectral cubes and mission-validated dose forecasting, with provenance and uncertainty attached to each derived pixel.
