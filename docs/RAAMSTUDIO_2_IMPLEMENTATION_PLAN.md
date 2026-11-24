# RAAMSTUDIO 2.0 — Implementatieplan (fase 1)

## Doel

Raamstudio 2.0 in de verkoopapp (Next.js), naast het bestaande `/crm/raamstudio`. Geen AGPL-besmetting, geen mock-maten, geen dode knoppen.

## Fasen

| Fase | Inhoud | Status |
| --- | --- | --- |
| 1 | Analysedocumenten (dit bestand + siblings), master spec | klaar |
| 2 start | Navigatie Verkoop → Raamstudio 2.0, dossierselector, plannen uit map Plannen, calculatiepoort | klaar |
| 2 vervolg | Eigen werkruimte: tekeningen, grondplan, gevels, maten, raaminfo, ramenstaat, nummering, fluoriseren, opslag als `.raamstudio` | klaar |
| 3 | Projectnotities.pdf via pdf-lib, tekstlaag via pdf.js, PDF-kwaliteit | klaar |
| 4 | Gevelkader, schuifraam en deur volgens de tekenafspraak. Grondplanraam zonder lijnbundel nog open. Openingen blijven te controleren | bezig |

## Randvoorwaarden

- Dossier via bestaand offertedossier-id (`crm_Opportunities` met `is_dossier`).
- Plannen alleen uit bestaande documentmappen (Plannen, Calculatie-PDF); originele upload overschrijven nooit.
- Raamnummers als string (`0.1` ≠ `0.10`).
- Gevelvolgorde: voorgevel → rechtergevel → achtergevel → linkergevel (tegen de klok), per verdieping opnieuw nummeren vanaf 1.
- Prijzen, verkopers, formules en `crm_ExternalQuotes` onaangeroerd.

## Technische ankers

- Bestaand: `RaamstudioWorkspace`, `workspace-model.ts`, `dossier-plans.ts`, `actions/crm/raamstudio/actions.ts`.
- Nieuw: `/crm/raamstudio-2` (shell), `lib/raamstudio/facade-order.ts`.