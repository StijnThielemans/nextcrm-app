/** WindowInfoWorkspace.OPTIONS_BY_CATEGORY from the desktop program. */
export const RAAMINFO_CATALOG: Record<string, readonly string[]> = {
  Onderaansluiting: [
    "Rubber", "Onderdorpel", "Renodorpel",
    "Alu dorpel 100", "Alu dorpel 110", "Alu dorpel 120", "Alu dorpel 130", "Alu dorpel 140",
    "Alu dorpel 150", "Alu dorpel 160", "Alu dorpel 170", "Alu dorpel 180", "Alu dorpel 190",
    "Alu dorpel 200", "Alu dorpel 210", "Alu dorpel 220", "Alu dorpel 230", "Alu dorpel 240",
    "Alu dorpel 250", "Alu dorpel 260", "Alu dorpel 270", "Alu dorpel 280", "Alu dorpel 290",
    "Alu dorpel 300", "Alu dorpel 310", "Alu dorpel 320", "Alu dorpel 330", "Alu dorpel 340",
    "Alu dorpel 350",
  ],
  Deur: [
    "Veiligheidscilinder", "Aluminium trekker PP", "Auto. tochtflatsluiter", "Onzichtbare deurdranger",
    "Duitse dorper", "Elektrisch slotpad", "Enkel Kruk Binnen", "VOD paneel binnenkant",
    "Kruk binnen+buiten", "VOD paneel buitenkant", "Motorslot", "Paniekkruk EN179",
    "Reynaers trekker", "Vaste schelpkruk buiten", "Werfc ilinder",
  ],
  Extra: ["Ophoogprofiel", "Screen", "Rolluik", "Verhoogd bovenprofiel voorzien", "Rooster"],
  Schuifraam: ["Kruk+komgreep+Knopcilinder", "Kruk+komgreep ZONDER cilinder"],
  Hoek: ["Glas op glas hoek", "Vaste hoek voorzien"],
};

export const RAAMINFO_CATEGORIES = Object.keys(RAAMINFO_CATALOG);
