# Interplanetary Survival Guide: Martian Map

A hyperlocal Mars EVA planning visualization for the NASA Space Apps Challenge. Explore illustrative Mount Sharp boxwork terrain or Jezero delta terrain, compare science overlays, inspect a route, and simulate a cargo rover with a paired crew. The full-viewport 3D terrain is rendered in Three.js without map servers, API keys, or remote imagery.

## Run

Requires Node 20+.

```bash
npm install
npm run dev
npm run build
npm run preview
```

Open the Vite URL printed by `npm run dev`. For Vercel, use the Vite preset, build command `npm run build`, and output directory `dist`. The preview environment accepts `.e2b.app` hosts in `vite.config.ts`.

## Use

- Switch between Mount Sharp (Gale Crater) and Jezero Crater in the mission sidebar.
- Toggle four composited terrain layers and adjust opacity: optical regolith, mobility slope classes (<10° green, 10–18° amber, ≥18° red), radiation/thermal *illustration*, and spectral-mineral *illustration*.
- Orbit and zoom the camera, recenter with ⌖, or follow the rover with ◎.
- Start, pause, reset, or scrub the EVA simulation. The dock reports estimated route distance, gain/loss, maximum slope, duration, and oxygen use.
- Run the Demo button to introduce the layers and start the traverse. The mobile menu button shows or hides the sidebar.

## Architecture

- `src/components/MarsScene.tsx`: Three.js scene, procedural height field, terrain texture painting, slope and mineral overlays, instanced boulders, route beacons, rover and astronaut meshes, camera controls, and WebGL-unavailable fallback.
- `src/data/sites.ts`: strictly typed zone definitions, waypoint routes, crater parameters, layer metadata, and simulation constants.
- `src/App.tsx`: React mission interface, layer controls, site switching, demo sequence, and telemetry dock.
- `src/style.css`: responsive floating-glass interface.
- `src/data/field-sites.geojson`: supplementary illustrative field-site reference data; not loaded by the runtime scene.

## Data integrity and limitations

HiRISE/CTX, MOLA/HiRISE DEM, RAD/THEMIS, and CRISM are **science references for the layer concepts**, not live feeds or downloaded products in this version. The route locations, crater positions, terrain heights, rock distribution, slope classes, mineral colors, radiation/thermal shading, and life-support estimates are **synthetic**, not measured NASA pixels or calibrated astronaut safety data. The 2.4 km terrain patch is generated locally from deterministic noise and modeled landforms; switching zones regenerates the patch. There are no external tile requests. The interface does not currently include a rover-photo inspector, real-time weather feed, or flight-certified route planner. Never use it for real EVA navigation or safety decisions.

Performance depends on client hardware. The renderer uses instanced rocks and a 200-segment terrain mesh, but 60 FPS is a target, **not a guaranteed benchmark**. A styled 2D tactical backdrop is provided when WebGL context creation or retention fails.
