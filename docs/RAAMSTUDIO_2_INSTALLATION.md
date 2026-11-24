# RAAMSTUDIO 2.0 — Installatie

`pdf-lib` staat in `package.json`. De planweergave gebruikt de al aanwezige Poppler-programma's `pdfinfo` en `pdftocairo`, met pdf.js als reserve. Er worden geen modelgewichten gedownload.

De plananalyse draait in `services/raamstudio-vision`. Eenmalig: `sh services/raamstudio-vision/install.sh`. Daarvoor is het pakket `python3-venv` nodig, en Tesseract met `nld`, `fra` en `eng`. De map `.venv` wordt niet gecommit.

# RAAMSTUDIO 2.0 — Installatie (fase 1)

## Ontwikkelaar

Alleen `pnpm install` in `nextcrm-app`; geen Python-venv in de app-container.

## Productie

Geen extra services op deze tak. Desktop RaamStudio blijft optioneel voor werf/projectleiding.

## Documentatie

- Master spec: `docs/RAAMSTUDIO_2_MASTER_SPEC.md` (verbatim zodra coordinator-bestand klaar).
- Integratieplan: project store `docs/raamstudio-integratieplan.md`.