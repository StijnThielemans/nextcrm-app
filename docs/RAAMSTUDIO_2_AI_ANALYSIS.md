# RAAMSTUDIO 2.0 — AI / automatisering (fase 1)

## Scope nu

Geen mock-detecties. Geen verzonnen maten. De knop Tekstlaag lezen haalt cijfers en gevelwoorden uit de bestaande PDF-tekstlaag (pdf.js). Dat maakt geen ramen. Automatische raamdetectie blijft uit tot er getrainde gewichten voor Belgische plannen zijn. YOLO en PyMuPDF zijn niet geïnstalleerd wegens de AGPL-licentie.

## Later (na master spec)

| Mogelijkheid | Bron | Koppeling |
| --- | --- | --- |
| Lastenboek/EPB zoeken | `document_reports.py` (keyword hits, geen beslissing) | Server-side index op dossier-PDF’s |
| Zelf-lerend profiel | RAAMSTUDIO_2_SELF_LEARNING.md | opt-in, geen prijsimpact |
| Meetvoorstellen | alleen vanuit opgeslagen clip + gebruikersbevestiging | nooit auto-invullen in offerte |

## Grens met verkoop

AI-output mag nooit `quoteMargin`, `extractGrossTotal` of dossierstatus wijzigen zonder expliciete gebruikersactie.