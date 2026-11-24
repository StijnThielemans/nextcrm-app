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

## Geselecteerd en geïnstalleerd

| Pakket | Licentie | Gebruik |
| --- | --- | --- |
| `pdf-lib` 1.17.1 | MIT | Projectnotities.pdf: originele PDF-pagina's kopiëren en vectortekst toevoegen |
| `pdfjs-dist` via `pdf-parse` | Apache-2.0 | Tekstlaag van een plan lezen. Geen raamdetectie |
| Poppler `pdfinfo` / `pdftocairo` | GPL-2.0 als los systeemprogramma, niet in de JS-bundle | Bestaande scherpe planweergave |

## Afgewezen

| Pakket | Reden |
| --- | --- |
| Ultralytics YOLO | AGPL-3.0, besmet de applicatie |
| PyMuPDF | AGPL/commerciële licentie, niet in de Next-app |
| RF-DETR, Detectron2, PaddleOCR, SAM, Grounding DINO | Geen getrainde gewichten voor Belgische plannen. Installeren zonder gewichten zou geen echte detectie geven |

## Integratie met TILO-dossier

- `listDossiers`, `getDossier`, `raamstudioPlansForDossier`.
- Werkbestand: `Raamstudio 2.0.raamstudio` in Calculatie. Geen `.tc-raam`.
- Einddocument: `Projectnotities.pdf` in Calculatie, opgebouwd uit de originele plan-PDF's.