# Planning: fase 1 — analyse en voorstel

Datum: 24 november 2026. Basis: `origin/main` (`df4be188`). Dit document beschrijft de bestaande planningscode en een concreet voorstel. Er is in deze stap geen kalender, geen planninggegeven en geen migratie gewijzigd.

De masterprompt staat hier niet in. De kickoff bevatte die tekst niet volledig, dus `docs/PLANNING_OUTLOOK_MASTER.md` is bewust niet aangemaakt.

## Wat de drie agenda's delen

Drie menu-items, drie routes, één scherm.

| Agenda | Route | Paginabestand |
| --- | --- | --- |
| Binnendienst | `/planning/binnendienst` | `app/[locale]/(routes)/planning/binnendienst/page.tsx` |
| Buitendienst | `/planning/buitendienst` | `app/[locale]/(routes)/planning/buitendienst/page.tsx` |
| Dienst na verkoop | `/planning/dienst-na-verkoop` | `app/[locale]/(routes)/planning/dienst-na-verkoop/page.tsx` |

Elke pagina roept `PlanningBoardPage` aan met een vast `board`. Die laadt `loadPlanningBoard` en tekent `PlanningCalendar`. Het menu zit in `app/[locale]/(routes)/components/menu-items/Planning.tsx`.

De week komt uit `?week=` (elke dag in die week wordt de maandag). Zonder parameter is het de week van vandaag. Dag of week als weergave zit in lokale state en valt bij verversen terug op week.

Het raster is al Outlook-achtig, in eigen code (`@dnd-kit/core`, al in het project). Er is geen FullCalendar, Bryntum, Syncfusion, DevExpress of DayPilot.

Wat het scherm nu al doet:

- Knop **Vandaag**, vorige en volgende, titel zoals `23 - 29 november 2026`.
- Schakelaar **Dag** en **Week**. Week toont maandag tot en met zondag op één scherm: het raster vult de resterende hoogte (`h-[calc(100dvh-10rem)]`, `overflow-hidden`), met een tijdkolom van 6:00 tot 19:00.
- Een job zonder opgeslagen klok wordt getekend van 8:00 tot 16:00. Die uren worden niet weggeschreven (`PLANNING_GRID_*` en `planningDisplaySpan` in `lib/sales/planning.ts`).
- Overlappende blokken staan naast elkaar (`layoutOverlapLanes`).
- Elke job houdt één kleur uit `PLANNING_PALETTE`. Twee jobs op dezelfde dag delen die kleur niet (`assignJobColors`).
- In het blok: projectnummer (link naar het project), klant, plaats (link naar Google Maps), en het label (`Chassis · N werkdagen`, `Glas · N werkdagen`, of de vrije tekst).
- **Nog te plannen** staat in een volle-breedtestrook boven het raster.
- Google Agenda-banner alleen als `google.ready` waar is. Zolang OAuth, account en agenda-id ontbreken, blijft `planningGoogleInfrastructureReady` onwaar en is de banner weg. Die koppeling blijft uit. Er komt geen ReynaPro-koppeling bij.

## Per afdeling

De verdeling staat in `jobsFromProject` (`lib/sales/planning.ts`). Alleen een dossier met projectnummer (`execution_project_number`) levert jobs. Chassis en glas zijn aparte jobs. Een dossier zonder die werkdagen krijgt geen tweede kaart.

### Buitendienst

- Chassis met een geheel aantal werkdagen groter dan 0 (`boardForChassis` → `buitendienst`).
- Glas met een geheel aantal werkdagen groter dan 0. Er is geen splitsing in de data, dus glas blijft op buitendienst (`boardForGlass`).
- Datums: `chassis_plan_start` / `chassis_plan_end` en `glass_plan_start` / `glass_plan_end` op `crm_Opportunities`.
- Werkdagen komen van het projectscherm (`PlanningWorkDays` → `setPlanningWorkDays` in `lib/sales/projects.ts`). Een kortere of lege duur herberekent de span vanaf de bestaande startdag en snoeit ploegtoewijzingen buiten die span (`workDaySpanUpdate`, `applyWorkDaySpanCrew`).
- Onderaan het scherm: de ploegstrook, alleen op dit bord.

### Binnendienst

- Eén kantoorjob van 1 werkdag wanneer het dossier in Projectbox zit (actie projectleiding aan én een projectnummer van exact 10 cijfers) en er geen chassis- of glasdagen zijn. Datums: `office_plan_start` / `office_plan_end`.
- Zodra chassis of glas dagen krijgt, verdwijnt die kantoorjob en worden de officedatums leeggemaakt (`clearOffice`).
- Daarnaast handmatige items (`crm_PlanningItems`, bord `BINNENDIENST`): vrije tekst, optioneel gekoppeld aan één project of één offerte. Het formulier **Zelf toevoegen** staat alleen in de strook van binnendienst. Een handmatig item is 1 werkdag.
- Geen ploegstrook. `loadPlanningBoard` leest toewijzingen alleen voor buitendienst.

### Dienst na verkoop

Zelfde scherm, zelfde toolbar, zelfde strook **Nog te plannen**. De code heeft geen schrijver voor dit bord:

- `jobsFromProject` zet nooit `dienst-na-verkoop`.
- `createManualPlanningItem` schrijft altijd `BINNENDIENST`.
- Het toevoegformulier rendert alleen bij `board === "binnendienst"`.
- `assignPlanningCrew` weigert met `planningCrew` zodra het bord niet buitendienst is.

Het bord blijft dus leeg. De handleiding zegt dat het leeg blijft tot iemand zelf iets zet; het scherm heeft die zet nog niet. Deze fase verzint geen regel die bepaalt welke job daar hoort.

## Hoe slepen op buitendienst werkt

Eén `DndContext` in `PlanningCalendar`. Een sleep van 6 pixels activeert. `preferTarget` houdt de twee sleepsoorten uit elkaar.

### Personen en vrachtwagens

Bron: `PLANNING_CREW` in `lib/sales/planning.ts` (twaalf personen en Vrachtwagen 1 en 2). De strook (`CrewStrip`) maakt elke kaart `type: "crew"`. Loslaten mag alleen op een slot (`type: "slot"`) van een blok: job plus die dag.

`assignPlanningCrew` (`lib/sales/planning-data.ts`):

- Schrijft een rij in `crm_PlanningAssignments`: `resource`, `day`, `kind` (`CHASSIS` of `GLASS`), `opportunity_id`.
- De job moet die dag al in zijn werkdagenspan hebben. De plandatum verandert niet.
- Dezelfde persoon op dezelfde job en dezelfde dag is een no-op.
- Alleen chassis en glas, en alleen als `boardForChassis` / `boardForGlass` buitendienst is.

In het blok staat onder de tekst een rij met portret en naam (`CrewInBlock`, `data-testid="planning-heads"`). Een klik haalt die toewijzing weg (`removePlanningCrew`) en laat de datum staan.

`CrewPortrait` tekent de personen als svg, Charlie Chaplin als foto (`charlie-portrait.ts`), en de vrachtwagens als svg. De jpg/png-bestanden in `public/planning/` en het veld `image` op `PLANNING_CREW` leest het blok niet. De regel die blijft: onder de tekst staan portret en naam. Welke bron dat portret later toont, is een aparte beslissing.

### Projecten en andere jobs

Een jobkaart is `type: "job"`. Loslaten op een dagkolom roept `placePlanningJob(jobId, day)` aan. Loslaten op **Nog te plannen** roept `placePlanningJob(jobId, null)` aan.

`placePlanningJob` zet de datumspan en laat de ploeg op de job:

- Chassis of glas: `planSpan(dag, aantal werkdagen)`. Maandag–vrijdag tellen. Zaterdag of zondag als neerzetdag schuift de start naar de volgende maandag. Drie dagen op een woensdag worden woensdag, donderdag en vrijdag. De start en het einde gaan naar de chassis- of glasvelden.
- `keepCrewDays` verwijdert toewijzingen op dagen die buiten de nieuwe span vallen, en alle toewijzingen als de job terug naar **Nog te plannen** gaat. Op dagen die in de span blijven, blijft dezelfde persoon op dezelfde job. De sleep wijzigt dus wanneer de job staat, en snoeit alleen ploegdagen die daarbuiten vallen. Dat is bestaand gedrag en blijft.
- Kantoorjob: dezelfde actie, span van 1 werkdag, op `office_plan_*`. Geen ploeg.
- Handmatig item: span van 1 werkdag op `crm_PlanningItems.plan_start` / `plan_end`.

Er is geen verticale sleep die een kloktijd opslaat.

Dezelfde personen-sleep hoort later ook op binnendienst en dienst na verkoop. Die stap zit niet in dit voorstel als werk. De server weigert ze vandaag.

## Wat herbruikbaar is

Blijft de kern, ook bij een uniforme toolbar:

- `planSpan`, `spanDays`, `firstWeekday`, `weekFromParam`, `assignJobColors`, `planningDisplaySpan`, `layoutOverlapLanes`, `planningBlockTitle`, `planningPlace`.
- `placePlanningJob`, `assignPlanningCrew`, `removePlanningCrew`, `createManualPlanningItem`, `deleteManualPlanningItem`.
- De drie routes en de bord-id. Geen samengevoegde agenda: chassis en glas blijven buitendienst, de kantoorjob en handmatige items blijven binnendienst.
- `@dnd-kit` met de types `job`, `crew`, `day`, `list`, `slot`.
- Rechten in `planning-data.ts`: een partner krijgt `forbidden`. Een projectleider ziet dossiers met `deletedAt: null` en slaat de extra schrijfcheck over. Iemand anders ziet de gewone CRM-leesfilter (`opportunityReadScopeWhere`: verkoper op `seller_name`, beheerder of admin alles niet-verwijderd, anderen toegewezen, aangemaakt of via het account) en moet `assertCanWriteOpportunity` halen om te plaatsen of een ploeg te zetten.
- Tests in `lib/sales/__tests__/planning.test.ts` (span, bordverdeling, kleur, weektitel, 8:00–16:00 als tekening). Die assertions blijven de maat.

FullCalendar is niet nodig. Dag en week bestaan al, inclusief overlap, slot voor de ploeg, portret onder de tekst en de week op één scherm. Werkweek is een filter op de zeven kolommen. Maand is een raster van dagcellen op dezelfde `days[]`. Het gratis FullCalendar-timegrid zou die sleep en die blokinhoud vervangen. De betalende kalenders blijven buiten het project. Het framework blijft Next.js en React.

## Risico's

- **Nog te plannen bovenaan en een zijpaneel.** De strook staat nu over de volle breedte boven het raster. Een zijpaneel verplaatst die strook. Zonder uitdrukkelijke goedkeuring blijft ze waar ze is. Het voorstel hieronder zet **Nog te plannen** als bovenste blok van een linkerpaneel, boven de personen, zodat het nog steeds het eerste blok boven de mensen en naast het raster is. Dat is een layoutkeuze, geen nieuwe planningsregel.
- **Week op één scherm.** De ploegstrook onderaan neemt hoogte van het raster. Een paneel naast het raster geeft die hoogte terug. Werkweek (vijf kolommen) en week (zeven) blijven in datzelfde vlak. Maand is een ander raster, nog steeds één scherm, zonder horizontale projectas.
- **Maand en portretten.** Een maandcel is te klein voor portret plus naam onder de tekst. Voorstel: maand toont het gekleurde blok met projectnummer of korte titel; dag, werkweek en week houden portret en naam. Alleen na goedkeuring.
- **Toewijzingen en de zichtbare periode.** Jobs worden voor het hele bord geladen. Ploegregels worden alleen voor de dagen van de gevraagde week gelezen (`crewFor`). Een maandweergave moet die leesvraag verbreden naar de zichtbare maand, anders verdwijnen portretten buiten de oude week. Dat is een leesvenster, geen migratie en geen andere toewijzing.
- **Kruisende sleep.** Personen mogen alleen op een slot landen, jobs alleen op een dag of op de lijst. Een gedeeld paneel moet die types houden, anders wijzigt een persoon de datum of een project de ploeg.
- **Kleur.** `assignJobColors` kijkt naar alle dagen van de job, niet naar de zichtbare week. Een weergave mag de kleur niet opnieuw uitrekenen op alleen de zichtbare cellen.
- **Neerzetten op zaterdag of zondag.** De client geeft de cel door. `planSpan` schuift de start. De client mag die dag niet zelf verplaatsen.
- **Google.** `pullPlanningWeekFromGoogle` overschrijft plandatums vanuit Google zodra de omgeving aan staat. Deze fase zet geen `GOOGLE_CALENDAR_*` of `PLANNING_GOOGLE_*`. De banner, de pull en de Inngest-push blijven onaangeroerd.
- **Dienst na verkoop.** Een uniform jasje op een leeg bord is veilig. Een formulier of een automatische job daar is een nieuwe regel en hoort niet in de layoutstap.
- **Personen op binnen en dienst na verkoop.** `assignPlanningCrew` kent alleen chassis en glas op buitendienst. Het model heeft al `kind` inclusief `OFFICE` en een optionele `item_id` op `crm_PlanningAssignments`. Een latere stap kan die kolommen gebruiken. Welke jobsoort daar een persoon aanvaardt, ligt nog niet in de code. Die uitspraak komt vóór de implementatie, niet in deze layout.

## Bestanden die een latere toolbar, zijpaneel of blokken raken

Wel aanraken als het voorstel is goedgekeurd:

- `app/[locale]/(routes)/planning/PlanningCalendar.tsx` — toolbar, weergave, strook, ploeg, blokken, sleep.
- `lib/sales/planning.ts` — alleen helpers voor werkweek-kolommen, maandtitel en de daglijst van een maand. `planSpan` en de paletlogica blijven.
- `lib/sales/planning-data.ts` — alleen het dagvenster van `crewFor` wanneer de maand open is. `placePlanningJob` en `assignPlanningCrew` blijven in de layoutstap gelijk.

Blijven zoals ze zijn in die layoutstap:

- De drie `page.tsx`-bestanden en `PlanningBoardPage.tsx` (bord en `week` zijn genoeg).
- `actions/crm/planning/actions.ts`.
- `crew-portraits.tsx` en `charlie-portrait.ts` (hergebruik).
- `Planning.tsx` in het menu (drie ingangen blijven).
- `PlanningGoogleStatus.tsx`, `lib/sales/planning-google.ts`, `planning-google-config.ts`, `inngest/functions/planning/google-push.ts`.
- `prisma/schema.prisma` (geen migratie).
- `PlanningWorkDays.tsx` en `setPlanningWorkDays` (werkdagen en spans blijven de bron).
- `lib/sales/__tests__/planning.test.ts`, behalve een extra assertion als er een pure helper bij komt. Bestaande verwachtingen blijven.

Een latere personen-sleep op de andere borden raakt daarna `assignPlanningCrew`, `removePlanningCrew` en `crewFor` in `lib/sales/planning-data.ts`. Dat is een aparte stap na een aparte goedkeuring.

## Voorstel (wacht op goedkeuring)

Eén jas voor de drie bestaande agenda's. De gegevens per bord blijven gescheiden. Geen herbouw, geen Gantt, geen horizontale projecttijdlijn, geen automatische planning, geen OpenAI, geen nieuwe agenda-koppeling.

Layout, links het paneel en rechts het raster:

```
[ Vandaag ]  [ < ] [ > ]   23 - 29 november 2026     [ Dag | Werkweek | Week | Maand ]

Nog te plannen          ma  di  wo  do  vr  za  zo
  jobkaarten            6:00
Personen                … raster tot 19:00, of maandcellen
  (functioneel alleen
   op buitendienst)
```

- **Dag** — de bestaande dagkolom.
- **Werkweek** — dezelfde week, kolommen maandag tot vrijdag. De neerzetregel via `planSpan` blijft, ook als het weekend geen kolom heeft.
- **Week** — de bestaande zeven kolommen, hele raster op één scherm.
- **Maand** — cellen per kalenderdag. Een job verschijnt op elke werkdag die hij nu al heeft (`days`). Slepen van een job op een cel roept dezelfde `placePlanningJob` aan. Geen balk over projecten.
- **Vandaag** — de bestaande `goToday`: de week die vandaag bevat. In de werkweek is de groene markering er op maandag–vrijdag; zaterdag en zondag hebben daar geen kolom.
- **Zijpaneel** — **Nog te plannen** bovenaan in het paneel (de kaarten die nu in de strook staan, inclusief het formulier op binnendienst). Daaronder de personen en vrachtwagens. Op buitendienst blijft de sleep naar het slot van die dag. Op binnendienst en dienst na verkoop komt die lijst in deze stap nog niet, zodat een sleep daar niet dood loopt.
- Blokken op dag, werkweek en week houden projectlink, plaats, kleur, label, en op buitendienst portret en naam onder de tekst.

### Al aanwezig

- Drie agenda's, één component, dag en week, Vandaag, weektitel, tijdraster 6:00–19:00, blok 8:00–16:00 als tekening, overlap, kleur, projectlink, Maps, week op één scherm.
- **Nog te plannen** boven het raster, met toevoegen op binnendienst.
- Personen- en vrachtwagensleep op buitendienst, portret en naam onder de tekst, klik verwijdert de toewijzing.
- Job slepen wijzigt de werkdagenspan; de ploeg blijft op de job en verliest alleen dagen buiten de span.
- Rechten, Projectbox-regel, chassis/glas op buitendienst, kantoorjob op binnendienst.
- Google blijft uit zolang de omgeving niet gezet is.

### Alleen na goedkeuring van dit voorstel

- Werkweek en maand als extra standen in dezelfde component.
- De volle-breedtestrook wordt het bovenste blok van het linkerpaneel. Personen van de onderstrook verhuizen naar dat paneel, alleen werkend op buitendienst.
- Maandchips zonder portret; portret blijft op dag, werkweek en week.
- Leesvenster van `crewFor` verbreden naar de zichtbare maand.

### Bewust later, niet in de layoutstap

- Dezelfde personen-sleep op binnendienst en dienst na verkoop. Eerst een uitspraak over de jobsoort (kantoor, handmatig, en wat er op dienst na verkoop hoort). De serverregel van vandaag wint tot die uitspraak er is.
- Echte foto's uit `public/planning/` in plaats van de getekende portretten, als dat de bedoeling is.
- Iets kunnen zetten op dienst na verkoop. Het bord blijft leeg.

## Wat deze stap niet doet

Geen plandatum van project `1000000326` verplaatst. Offerte `OFF-2026-0014` niet gewijzigd. Geen test tegen de live agenda gedraaid, zodat er niets gesleept werd. Geen pakket geïnstalleerd. Geen migratie.
