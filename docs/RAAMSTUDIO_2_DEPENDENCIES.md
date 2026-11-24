# RAAMSTUDIO 2.0 — Afhankelijkheden

## Blijft in de verkoopapp (MIT/Apache-achtig)

| Pakket | Rol |
| --- | --- |
| `next`, `react` | UI |
| `pdfjs-dist` / bestaande PDF-route | Plannen renderen |
| `@/lib/raamstudio/*` | Project JSON, clips, maten |

## Desktop RaamStudio (referentie, niet in runtime)

PySide6, PyMuPDF, Pillow, **pytesseract**, opencv-python-headless — alleen in `internal/RaamStudio_Calculatie_Verkoop.zip`. Geen AGPL in de Next-app; OCR eventueel later via server-side service zonder AGPL-copyleft in de frontend-bundle.

## Niet installeren op deze tak

- Geen extra AGPL-Python in de Node-app.
- Geen packages die `next build` of bestaande CRM-tests breken.

## Integratie met TILO-dossier

- `listDossiers`, `getDossier`, `raamstudioPlansForDossier`.
- Opslag werkbestand: `.tc-raam` via bestaande documentflow (zip-extensie uitbreiding later, niet op deze stap).