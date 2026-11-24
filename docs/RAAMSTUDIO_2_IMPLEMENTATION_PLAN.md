# RAAMSTUDIO 2.0 — Implementatieplan (fase 1)

## Doel

Raamstudio 2.0 in de verkoopapp (Next.js), naast het bestaande `/crm/raamstudio`. Geen AGPL-besmetting, geen mock-maten, geen dode knoppen.

## Fasen

| Fase | Inhoud | Status |
| --- | --- | --- |
| 1 | Analysedocumenten (dit bestand + siblings), master spec placeholder | bezig |
| 2 start | Navigatie Verkoop → Raamstudio 2.0, dossierselector (nummer, klant, project, werf, verkoper, status), plannen uit map Plannen, calculatiepoort: verderwerken of nieuw project in bestaand RaamStudio | klaar |
| 2 vervolg | Eigen werkruimte in `/crm/raamstudio-2`: tekeningen, grondplan, gevels, maten, raaminfo, opslag als `.rs2` | klaar |
| 3 | PDF-kwaliteit, self-learning, installatie zonder verkoopapp te breken | gepland |

## Randvoorwaarden

- Dossier via bestaand offertedossier-id (`crm_Opportunities` met `is_dossier`).
- Plannen alleen uit bestaande documentmappen (Plannen, Calculatie-PDF); originele upload overschrijven nooit.
- Raamnummers als string (`0.1` ≠ `0.10`).
- Gevelvolgorde: voorgevel → rechtergevel → achtergevel → linkergevel (tegen de klok), per verdieping opnieuw nummeren vanaf 1.
- Prijzen, verkopers, formules en `crm_ExternalQuotes` onaangeroerd.

## Technische ankers

- Bestaand: `RaamstudioWorkspace`, `workspace-model.ts`, `dossier-plans.ts`, `actions/crm/raamstudio/actions.ts`.
- Nieuw: `/crm/raamstudio-2` (shell), `lib/raamstudio/facade-order.ts`.