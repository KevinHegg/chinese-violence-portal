# The John Crow Project (Chinese Violence Portal)

The John Crow Project is a digital archive and visualization of anti-Chinese violence in the United States (c. 1850–1915).  
It combines narrative case records, primary-source newspaper scans, and interactive charts/maps to make a neglected history legible and researchable.

Live site: https://johncrow.org

---

## Overview

The site lets users:

- Explore **lynching records** with narrative, structured metadata, and linked sources.
- Browse **digitized newspaper articles** with transcripts and citations.
- Download a **living dataset** synchronized from Google Sheets.
- Visualize patterns of violence over time and space via **timelines, charts, and maps**.
- Take a guided **tour** and a **digital docent** walkthrough that ties evidence to argument.

This repository contains the Astro codebase, data ingestion scripts, and documentation for maintaining and extending the project.

---

## Tech Stack

- **Framework**: [Astro](https://astro.build) (SSR + static output)
- **Frontend**: Tailwind CSS + custom CSS, minimal React where needed
- **Visualizations**: ECharts, Mapbox GL JS, Turf.js
- **Data pipeline**:
  - Google Sheets as the primary data source
  - Node scripts to sync sheets → JSON in `public/` / `src/data/`
- **Deployment**: Netlify (production at `https://johncrow.org`)

---

## Data Sources

Core datasets and sources include:

- **Chinese lynching master dataset** (Google Sheets) – used for records, charts, and map.
- **Newspaper article index** (Google Sheets) – drives article metadata and article scans.
- **Publication exports**:
  - Chart data exported via `scripts/export-publication-charts.mjs`
  - Map imagery / overlays via corresponding export scripts.

For details on how these wire together, see:

- `docs/setup/google-sheets-setup.md`
- `docs/operations/data-and-assets.md`
- `docs/reviews/site-review-2026.md` (high-level architecture summary)

---

## Getting Started (Local Development)

### 1. Install dependencies

```sh
npm install
```

### 2. Run the dev server

```sh
npm run dev
```

By default the site runs at `http://localhost:4321`.

Some routes depend on live Google Sheets data; see `docs/setup/google-sheets-setup.md` if you need to point to different sheets or credentials.

### 3. Build for production

```sh
npm run build
```

The static/SSR output is written to `dist/`. You can preview the production build locally:

```sh
npm run preview
```

### 4. Testing

- Manual/feature test checklist: `docs/setup/testing-guide.md`
- Many flows (maps, charts, docent, dataset exports) are best validated in a real browser against `localhost:4321`.

---

## Documentation Map

To reduce markdown sprawl, project docs are organized under `docs/`:

- **Setup (`docs/setup/`)** – how to get a working environment
  - `docs/setup/google-sheets-setup.md` – connect to the Google Sheets data sources
  - `docs/setup/google-apps-script-setup.md` – Apps Script integration for sheets/automation
  - `docs/setup/testing-guide.md` – testing and QA workflow

- **Operations (`docs/operations/`)** – ongoing data and content operations
  - `docs/operations/data-and-assets.md` – column mappings, data export scripts, fallback image handling, and source-column fixes

- **Reviews & Snapshots (`docs/reviews/`)** – dated audits and review documents
  - `docs/reviews/accessibility-audit-2026.md` – WCAG 2.2 / Section 508 audit
  - `docs/reviews/seo-summary-2026.md` – SEO implementation summary
  - `docs/reviews/design-review-2026.md` – visual/UX review
  - `docs/reviews/site-review-2026.md` – pre-thesis comprehensive site review
  - `docs/reviews/recommendations.md` – review-driven recommendations and backlog notes

Other in-place docs:

- `src/data/DEPRECATED_LYNCHINGS.md` – note about deprecated JSON data
- `public/article-scans/README.md` – guidance for managing article scan assets

---

## Contributing / Maintenance Notes

- For **new features or bug fixes**, prefer updating the relevant doc under `docs/` rather than creating new top-level `.md` files.
- When you perform a new **formal review** (accessibility, SEO, design, etc.), add a dated file under `docs/reviews/` instead of editing the 2026 snapshots.
- Keep `README.md` focused on:
  - What the project is
  - How to run it
  - Where to find deeper docs
