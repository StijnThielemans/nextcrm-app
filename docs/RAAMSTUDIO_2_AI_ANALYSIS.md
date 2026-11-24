# RAAMSTUDIO 2.0 — AI / automatisering (fase 1)

## Scope nu

Geen mock-detecties. Geen verzonnen maten. Ramen en deuren komen uit een UNet-ResNet34 dat op CubiCasa5K is getraind (klassen achtergrond, muur, raam, deur). Op een architectuurblad komen daar de lichte rechthoekige raamkaders bij. De officiële CubiCasa5K-gewichten zijn CC BY-NC en zitten niet in de app. RF-DETR, Detectron2, MMDetection en YOLO op COCO hebben geen raamklasse en tekenen dus geen ramen. Ultralytics YOLO en PyMuPDF blijven buiten de app wegens de AGPL-licentie. pdfplumber leest de tekst. Ontbreekt die, dan leest PaddleOCR de benamingen en cijfers, en Tesseract blijft de reserve. Zonder modelgewichten blijven vectorrechthoeken de reserve. Elke opening blijft te controleren. Een cijfer naast een opening wordt alleen als maat opgeslagen als het een geschreven maat is. pdf.js blijft de reserve als de Python-omgeving ontbreekt. Belgische lijnsymbolen wijken af van de trainingsplannen, dus een controle blijft nodig.

## Later (na master spec)

| Mogelijkheid | Bron | Koppeling |
| --- | --- | --- |
| Lastenboek/EPB zoeken | `document_reports.py` (keyword hits, geen beslissing) | Server-side index op dossier-PDF’s |
| Zelf-lerend profiel | RAAMSTUDIO_2_SELF_LEARNING.md | opt-in, geen prijsimpact |
| Meetvoorstellen | alleen vanuit opgeslagen clip + gebruikersbevestiging | nooit auto-invullen in offerte |

## Grens met verkoop

AI-output mag nooit `quoteMargin`, `extractGrossTotal` of dossierstatus wijzigen zonder expliciete gebruikersactie.