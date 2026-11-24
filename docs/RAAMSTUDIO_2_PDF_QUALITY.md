# RAAMSTUDIO 2.0 — PDF-kwaliteit (fase 1)

## Probleem in 1.x

Bij inzoomen werden clip-regio’s soms opnieuw gerasterd uit een te kleine bitmap → wazige gevels.

## Export

`pdf-lib` kopieert de originele PDF-pagina naar Projectnotities.pdf en tekent daar vectortekst en een transparante fluorisering op. De bron-PDF in de map Plannen wordt niet overschreven. Een eerdere Projectnotities.pdf is geen bron.

## Richting voor 2.0

1. Plan-PDF altijd via server route met vaste `px`-schaal (bestaand `plan-page` patroon).
2. Clips bewaren bron-offset in project-JSON; zoom = CSS schaal op canvas, geen her-download op lagere resolutie.
3. Originele geüploade PDF in documentenmap niet herschrijven.

## Acceptatie

- Zoom op voorgevel leesbare lijnen op 1440×900 (vergelijk artefacten in project store media).
- Rotatie + muiszoom zonder nieuwe upload te forceren.