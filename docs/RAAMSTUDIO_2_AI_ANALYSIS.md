# RAAMSTUDIO 2.0 — AI / automatisering (fase 1)

## Scope nu

Geen mock-detecties. Geen verzonnen maten. Een blad met een gevel- of grondplantitel wordt gelezen volgens de tekenafspraak. Op de gevel is het schrijnwerk een gesloten kader met een lichte glasvulling op een vloer- of dorpellijn: een breed kader op de vloerlijn is een schuifraam, een smal hoog kader een deur, de andere kaders een raam. Op het grondplan is een schuifraam een geïsoleerde bundel evenwijdige lijnen die op een stijl uitkomt, en een deur een kwartcirkel. Een doorsnede naast het plan krijgt die markering niet. Het CubiCasa5K-vloerplanmodel (UNet-ResNet34, klassen achtergrond, muur, raam, deur) blijft de reserve voor een blad zonder die titels, zoals een donkere CAD-icoon. De officiële CubiCasa5K-gewichten zijn CC BY-NC en zitten niet in de app. RF-DETR, Detectron2, MMDetection en YOLO op COCO hebben geen raamklasse en tekenen dus geen ramen. Ultralytics YOLO en PyMuPDF blijven buiten de app wegens de AGPL-licentie. pdfplumber leest de tekst. Ontbreekt die, dan leest PaddleOCR de benamingen, en Tesseract blijft de reserve. Elke opening blijft te controleren. Een cijfer naast een opening wordt alleen als maat opgeslagen als het een geschreven maat is. Een gewoon raam dat op het grondplan enkel een onderbreking in de muur is, zonder lijnbundel, wordt nog niet gemarkeerd.

## Later (na master spec)

| Mogelijkheid | Bron | Koppeling |
| --- | --- | --- |
| Lastenboek/EPB zoeken | `document_reports.py` (keyword hits, geen beslissing) | Server-side index op dossier-PDF’s |
| Zelf-lerend profiel | RAAMSTUDIO_2_SELF_LEARNING.md | opt-in, geen prijsimpact |
| Meetvoorstellen | alleen vanuit opgeslagen clip + gebruikersbevestiging | nooit auto-invullen in offerte |

## Grens met verkoop

AI-output mag nooit `quoteMargin`, `extractGrossTotal` of dossierstatus wijzigen zonder expliciete gebruikersactie.