# RAAMSTUDIO 2.0 — AI / automatisering (fase 1)

## Scope nu

Geen mock-detecties. Geen verzonnen maten. Plan analyseren gebruikt pdfplumber voor vectorrechthoeken en tekst. Ontbreekt die tekst, dan leest Tesseract het gerenderde beeld. Ontbreken vectorrechthoeken, dan zoekt OpenCV rechthoekige kaders. Die kaders krijgen de status te controleren. Een cijfer naast een kader wordt getoond en niet als maat opgeslagen. pdf.js blijft de reserve als de Python-omgeving ontbreekt. Een getraind model voor Belgische raamsymbolen is er nog niet. YOLO en PyMuPDF blijven buiten de app wegens de AGPL-licentie.

## Later (na master spec)

| Mogelijkheid | Bron | Koppeling |
| --- | --- | --- |
| Lastenboek/EPB zoeken | `document_reports.py` (keyword hits, geen beslissing) | Server-side index op dossier-PDF’s |
| Zelf-lerend profiel | RAAMSTUDIO_2_SELF_LEARNING.md | opt-in, geen prijsimpact |
| Meetvoorstellen | alleen vanuit opgeslagen clip + gebruikersbevestiging | nooit auto-invullen in offerte |

## Grens met verkoop

AI-output mag nooit `quoteMargin`, `extractGrossTotal` of dossierstatus wijzigen zonder expliciete gebruikersactie.