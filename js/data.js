/** Seed data: ~20 GF menus, full-pack prices, Bern stores */
export const STORES = {
  migros_wankdorf: { id: "migros_wankdorf", name: "Migros Wankdorf", cluster: "Wankdorf", address: "Wankdorf", lat: 46.9675, lon: 7.4630 },
  denner_wankdorf: { id: "denner_wankdorf", name: "Denner Wankdorf", cluster: "Wankdorf", address: "Wankdorf-Gebiet", lat: 46.9660, lon: 7.4600 },
  aldi_wankdorf: { id: "aldi_wankdorf", name: "Aldi Wankdorf", cluster: "Wankdorf", address: "Wankdorf", lat: 46.9680, lon: 7.4650 },
  migros_bahnhof: { id: "migros_bahnhof", name: "Migros Bahnhof", cluster: "Zentrum", address: "Bahnhof Bern", lat: 46.9489, lon: 7.4405 },
  coop_city: { id: "coop_city", name: "Coop City Bern", cluster: "Zentrum", address: "Zentrum", lat: 46.9480, lon: 7.4440 },
  denner_neuengasse: { id: "denner_neuengasse", name: "Denner Neuengasse", cluster: "Zentrum", address: "Neuengasse", lat: 46.9495, lon: 7.4420 },
  lidl_ost: { id: "lidl_ost", name: "Lidl Bern-Ost", cluster: "Ost", address: "Bern-Ost", lat: 46.9485, lon: 7.4750 },
  migros_fh: { id: "migros_fh", name: "Migros MM Fachhochschule", cluster: "West", address: "West / FH", lat: 46.9520, lon: 7.4100 }
};

export const STAPLES = {
  reis: { name: "Reis (Grundstock)", staple: true },
  polenta: { name: "Polenta (Grundstock)", staple: true },
  gf_pasta: { name: "GF Pasta (Grundstock)", staple: true },
  zwiebel: { name: "Zwiebeln (Grundstock)", staple: true },
  knoblauch: { name: "Knoblauch (Grundstock)", staple: true },
  eier: { name: "Eier (Grundstock)", staple: true },
  tamari: { name: "Tamari GF (Grundstock)", staple: true },
  olivenoel_home: { name: "Olivenöl zu Hause (Grundstock)", staple: true },
  gewuerze: { name: "Gewürze / Chili (Grundstock)", staple: true },
  limette: { name: "Limette / Zitrone (Grundstock)", staple: true }
};

/** Full pack / Theke assumed packs — price = checkout pack price; shareKey dedupes */
export const ING = {
  poulet_geschn: { id: "poulet_geschn", name: "Optigal Pouletgeschnetzeltes ca. 400 g Theke/Sonderpack", packSize: "ca. 400 g", store: "migros_wankdorf", storeLabel: "Migros", price: 8.80, origin: "CH", shareKey: "poulet_geschn_400", unitNote: "2.20/100g CH" },
  patatli: { id: "patatli", name: "Patatli Kartoffeln 600 g", packSize: "600 g", store: "migros_wankdorf", storeLabel: "Migros", price: 1.40, origin: "CH", shareKey: "patatli_600" },
  bio_zucchetti: { id: "bio_zucchetti", name: "Bio Zucchetti 500 g", packSize: "500 g", store: "migros_wankdorf", storeLabel: "Migros", price: 2.95, origin: "CH", shareKey: "bio_zucchetti_500" },
  gruyere_rezent: { id: "gruyere_rezent", name: "Gruyère rezent AOP ca. 200 g Theke", packSize: "ca. 200 g", store: "migros_wankdorf", storeLabel: "Migros", price: 2.80, origin: "CH", shareKey: "gruyere_rezent_200", unitNote: "1.40/100g" },
  marktsalat: { id: "marktsalat", name: "Marktsalat XL 350 g", packSize: "350 g", store: "migros_wankdorf", storeLabel: "Migros", price: 2.25, origin: "CH", shareKey: "marktsalat_350" },
  lachs_asc: { id: "lachs_asc", name: "Lachs ASC 500 g", packSize: "500 g", store: "migros_wankdorf", storeLabel: "Migros", price: 7.35, shareKey: "lachs_asc_500" },
  schwein_nier: { id: "schwein_nier", name: "Schweinsnierstück ca. 500 g Theke", packSize: "ca. 500 g", store: "denner_wankdorf", storeLabel: "Denner", price: 8.35, shareKey: "schwein_nier_500", unitNote: "1.67/100g" },
  rindsvoressen: { id: "rindsvoressen", name: "Rindsvoressen ca. 500 g Theke", packSize: "ca. 500 g", store: "denner_wankdorf", storeLabel: "Denner", price: 9.95, shareKey: "rindsvoressen_500", unitNote: "1.99/100g" },
  truten: { id: "truten", name: "Trutenfiletmedaillons 400 g", packSize: "400 g", store: "denner_wankdorf", storeLabel: "Denner", price: 5.95, origin: "DE", shareKey: "truten_400" },
  poulet_mini: { id: "poulet_mini", name: "Poulet-Minifilets 500 g", packSize: "500 g", store: "denner_wankdorf", storeLabel: "Denner", price: 8.45, origin: "DE", shareKey: "poulet_mini_500", glutenRisk: "Marinade prüfen — nur natur/GF-zertifiziert" },
  bohnen: { id: "bohnen", name: "Bohnen 500 g", packSize: "500 g", store: "denner_wankdorf", storeLabel: "Denner", price: 2.79, shareKey: "bohnen_500" },
  eierschwaemme: { id: "eierschwaemme", name: "Eierschwämme 200 g", packSize: "200 g", store: "denner_wankdorf", storeLabel: "Denner", price: 3.50, shareKey: "eierschwaemme_200" },
  mischsalat: { id: "mischsalat", name: "Mischsalat 200 g", packSize: "200 g", store: "denner_wankdorf", storeLabel: "Denner", price: 1.25, shareKey: "mischsalat_200" },
  trauben: { id: "trauben", name: "Trauben 500 g", packSize: "500 g", store: "denner_wankdorf", storeLabel: "Denner", price: 1.49, shareKey: "trauben_500" },
  crevetten_roses: { id: "crevetten_roses", name: "Crevetten roses 250 g", packSize: "250 g", store: "denner_wankdorf", storeLabel: "Denner", price: 4.95, shareKey: "crevetten_roses_250" },
  gruyere_mild: { id: "gruyere_mild", name: "Gruyère mild ca. 200 g Theke", packSize: "ca. 200 g", store: "denner_wankdorf", storeLabel: "Denner", price: 2.92, origin: "CH", shareKey: "gruyere_mild_200", unitNote: "1.46/100g" },
  gf_tortillas: { id: "gf_tortillas", name: "Old El Paso GF Tortillas 216 g", packSize: "216 g", store: "aldi_wankdorf", storeLabel: "Aldi", price: 4.79, shareKey: "gf_tortillas_216", gfUnique: true },
  reispapier: { id: "reispapier", name: "Reispapier 250 g", packSize: "250 g", store: "aldi_wankdorf", storeLabel: "Aldi", price: 2.99, shareKey: "reispapier_250", gfUnique: true },
  gehackte_tomaten: { id: "gehackte_tomaten", name: "Gehackte Tomaten 400 g", packSize: "400 g", store: "aldi_wankdorf", storeLabel: "Aldi", price: 0.59, shareKey: "gehackte_tomaten_400" },
  passierte_tomaten: { id: "passierte_tomaten", name: "Passierte Tomaten 0.7 kg", packSize: "0.7 kg", store: "aldi_wankdorf", storeLabel: "Aldi", price: 0.79, shareKey: "passierte_tomaten_07" },
  kokosmilch: { id: "kokosmilch", name: "Kokosmilch 0.75 l", packSize: "0.75 l", store: "aldi_wankdorf", storeLabel: "Aldi", price: 5.99, shareKey: "kokosmilch_075" },
  olivenoel: { id: "olivenoel", name: "Olivenöl 0.75 l", packSize: "0.75 l", store: "aldi_wankdorf", storeLabel: "Aldi", price: 7.79, shareKey: "olivenoel_075" },
  reibkaese: { id: "reibkaese", name: "Reibkäse 400 g", packSize: "400 g", store: "aldi_wankdorf", storeLabel: "Aldi", price: 4.49, shareKey: "reibkaese_400" },
  aldi_salat: { id: "aldi_salat", name: "Gemischter Salat 370 g", packSize: "370 g", store: "aldi_wankdorf", storeLabel: "Aldi", price: 1.99, shareKey: "aldi_salat_370" },
  chicken_wings: { id: "chicken_wings", name: "Chicken Wings 2 kg", packSize: "2 kg", store: "lidl_ost", storeLabel: "Lidl", price: 14.99, shareKey: "chicken_wings_2kg" },
  hummus: { id: "hummus", name: "Hummus XXL 250 g", packSize: "250 g", store: "lidl_ost", storeLabel: "Lidl", price: 1.95, shareKey: "hummus_250", glutenRisk: "Etikett prüfen (meist GF)" },
  skyr: { id: "skyr", name: "Skyr 1 kg", packSize: "1 kg", store: "lidl_ost", storeLabel: "Lidl", price: 2.99, shareKey: "skyr_1kg" },
  riesencrevetten: { id: "riesencrevetten", name: "ASC Riesencrevetten 900 g", packSize: "900 g", store: "lidl_ost", storeLabel: "Lidl", price: 11.99, shareKey: "riesencrevetten_900" },
  bio_feta: { id: "bio_feta", name: "Bio Feta 2×180 g", packSize: "2×180 g", store: "coop_city", storeLabel: "Coop", price: 6.95, shareKey: "bio_feta_2x180" },
  bio_spiess: { id: "bio_spiess", name: "Bio Lachs & Crevettenspiess", packSize: "1 Stk.", store: "coop_city", storeLabel: "Coop", price: 10.70, shareKey: "bio_spiess", glutenRisk: "Marinade prüfen — nur GF" }
};

export const MENUS = [
  { id: "m01", title: "Poulet-Pfanne", short: "Poulet-Pfanne mit Patatli & Zucchetti", desc: "Schnelle CH-Pouletpfanne mit knackigen Kartoffeln und Bio-Zucchetti.", tags: ["fleisch", "schnell"], stores: ["Migros"], ingredients: [{ ref: "poulet_geschn" }, { ref: "patatli" }, { ref: "bio_zucchetti" }, { staple: "zwiebel" }, { staple: "olivenoel_home" }] },
  { id: "m02", title: "Lachs Ofen", short: "ASC-Lachs vom Ofen mit Marktsalat", desc: "Saftiger Lachs ASC, knusprige Patatli, grosser Marktsalat.", tags: ["fisch"], stores: ["Migros"], ingredients: [{ ref: "lachs_asc" }, { ref: "patatli" }, { ref: "marktsalat" }, { staple: "limette" }, { staple: "olivenoel_home" }] },
  { id: "m03", title: "Gruyère-Omelette", short: "Gruyère-Omelette mit Marktsalat", desc: "Luftiges Omelette mit rezentem Gruyère AOP.", tags: ["veggie", "schnell"], stores: ["Migros"], ingredients: [{ ref: "gruyere_rezent" }, { ref: "marktsalat" }, { staple: "eier" }, { staple: "zwiebel" }] },
  { id: "m04", title: "Rindsvoressen-Eintopf", short: "Rindsvoressen-Eintopf mit Bohnen", desc: "Herzhafter Schweizer Eintopf — langsam geschmort.", tags: ["fleisch"], stores: ["Denner"], ingredients: [{ ref: "rindsvoressen" }, { ref: "bohnen" }, { ref: "passierte_tomaten" }, { staple: "zwiebel" }, { staple: "knoblauch" }] },
  { id: "m05", title: "Schwein+Schwämme", short: "Schweinsnierstück-Pfanne mit Eierschwämmen", desc: "Saisonale Eierschwämme treffen zartes Schweinsnierstück.", tags: ["fleisch"], stores: ["Denner"], ingredients: [{ ref: "schwein_nier" }, { ref: "eierschwaemme" }, { ref: "mischsalat" }, { staple: "zwiebel" }, { staple: "olivenoel_home" }] },
  { id: "m06", title: "Truten+Salat+Trauben", short: "Trutenmedaillons mit Mischsalat & Trauben", desc: "Leichte Pfanne: Trutenfilet, frischer Salat, süsse Trauben.", tags: ["fleisch", "schnell"], stores: ["Denner"], ingredients: [{ ref: "truten" }, { ref: "mischsalat" }, { ref: "trauben" }, { staple: "olivenoel_home" }] },
  { id: "m07", title: "Minifilets+Reis", short: "Poulet-Minifilets mit Zucchetti-Reis", desc: "Pfanne mit Minifilets — Marinade-Etikett auf Gluten prüfen!", tags: ["fleisch", "schnell"], stores: ["Denner", "Migros"], ingredients: [{ ref: "poulet_mini" }, { ref: "bio_zucchetti" }, { staple: "reis" }, { staple: "tamari" }] },
  { id: "m08", title: "Crevetten Polenta", short: "Crevetten roses Tomaten-Polenta", desc: "Crevetten in milder Tomatensauce auf cremiger Polenta.", tags: ["fisch", "schnell"], stores: ["Denner", "Aldi"], ingredients: [{ ref: "crevetten_roses" }, { ref: "gehackte_tomaten" }, { staple: "polenta" }, { staple: "knoblauch" }] },
  { id: "m09", title: "GF-Fajitas", short: "GF-Fajitas mit Old El Paso Tortillas", desc: "Bunte Fajitas — GF-Tortillas von Aldi.", tags: ["fleisch"], stores: ["Aldi", "Denner"], ingredients: [{ ref: "gf_tortillas" }, { ref: "poulet_mini" }, { ref: "reibkaese" }, { ref: "aldi_salat" }, { ref: "gehackte_tomaten" }, { staple: "zwiebel" }] },
  { id: "m10", title: "Sommerrollen", short: "Sommerrollen mit Reispapier & Crevetten", desc: "Frische Sommerrollen — Reispapier + Crevetten.", tags: ["fisch", "schnell"], stores: ["Aldi", "Denner"], ingredients: [{ ref: "reispapier" }, { ref: "crevetten_roses" }, { ref: "aldi_salat" }, { staple: "tamari" }, { staple: "limette" }] },
  { id: "m11", title: "Kokos-Curry Poulet", short: "Kokos-Curry mit Poulet & Zucchetti", desc: "Cremiges Curry mit Kokosmilch — Reis aus dem Grundstock.", tags: ["fleisch"], stores: ["Aldi", "Migros"], ingredients: [{ ref: "kokosmilch" }, { ref: "poulet_geschn" }, { ref: "bio_zucchetti" }, { ref: "passierte_tomaten" }, { staple: "reis" }, { staple: "gewuerze" }] },
  { id: "m12", title: "Feta-Ofen", short: "Vegetarisches Tomaten-Feta-Ofengericht", desc: "Ofen-Zucchetti mit passierten Tomaten, Feta und Reibkäse.", tags: ["veggie"], stores: ["Aldi", "Coop", "Migros"], ingredients: [{ ref: "bio_zucchetti" }, { ref: "passierte_tomaten" }, { ref: "bio_feta" }, { ref: "reibkaese" }, { staple: "knoblauch" }] },
  { id: "m13", title: "Bohnen-Eintopf veg", short: "Bohnen-Eintopf vegetarisch mit Gruyère", desc: "Satter Veggie-Eintopf, abgerundet mit mildem Gruyère.", tags: ["veggie"], stores: ["Denner", "Aldi"], ingredients: [{ ref: "bohnen" }, { ref: "gehackte_tomaten" }, { ref: "gruyere_mild" }, { ref: "mischsalat" }, { staple: "zwiebel" }] },
  { id: "m14", title: "Wings+Hummus", short: "Ofen-Chicken-Wings mit Hummus & Salat", desc: "Knusprige Wings (volle 2-kg-Packung), Hummus und Salat.", tags: ["fleisch"], stores: ["Lidl", "Aldi"], ingredients: [{ ref: "chicken_wings" }, { ref: "hummus" }, { ref: "aldi_salat" }, { staple: "gewuerze" }] },
  { id: "m15", title: "Riesencrevetten Bowl", short: "ASC-Riesencrevetten Bowl mit Skyr-Dip", desc: "Bowl: Riesencrevetten, Salat, Skyr-Dip.", tags: ["fisch", "schnell"], stores: ["Lidl"], ingredients: [{ ref: "riesencrevetten" }, { ref: "skyr" }, { ref: "hummus" }, { staple: "reis" }, { staple: "limette" }] },
  { id: "m16", title: "Bio-Spiess", short: "Bio Lachs-Crevetten-Spiess mit Salat", desc: "Coop Naturaplan-Spiess — Marinade auf Gluten checken!", tags: ["fisch"], stores: ["Coop", "Migros"], ingredients: [{ ref: "bio_spiess" }, { ref: "marktsalat" }, { ref: "patatli" }, { staple: "olivenoel_home" }] },
  { id: "m17", title: "Mezze", short: "Feta-Hummus Mezze-Teller", desc: "Vegetarischer Mezze-Abend: Feta, Hummus, Trauben, Salat.", tags: ["veggie", "schnell"], stores: ["Coop", "Lidl", "Denner"], ingredients: [{ ref: "bio_feta" }, { ref: "hummus" }, { ref: "trauben" }, { ref: "mischsalat" }, { staple: "olivenoel_home" }] },
  { id: "m18", title: "Polenta+Schwämme+Gruyère", short: "Polenta mit Eierschwämmen & Gruyère", desc: "Herbstlich: cremige Polenta, Eierschwämme, Gruyère rezent.", tags: ["veggie"], stores: ["Denner", "Migros"], ingredients: [{ ref: "eierschwaemme" }, { ref: "gruyere_rezent" }, { staple: "polenta" }, { staple: "zwiebel" }, { ref: "mischsalat" }] },
  { id: "m19", title: "GF-Pasta Arrabbiata", short: "GF-Pasta Arrabbiata mit Reibkäse", desc: "Scharfe Tomatenpasta (GF-Pasta aus Grundstock) + Aldi-Reibkäse.", tags: ["veggie", "schnell"], stores: ["Aldi"], ingredients: [{ ref: "passierte_tomaten" }, { ref: "gehackte_tomaten" }, { ref: "reibkaese" }, { staple: "gf_pasta" }, { staple: "knoblauch" }, { staple: "gewuerze" }] },
  { id: "m20", title: "Kokos-Crevetten-Curry", short: "Kokos-Crevetten-Curry mit Reispapier-Chips", desc: "Crevetten in Kokoscurry; knuspriges Reispapier als Beilage.", tags: ["fisch"], stores: ["Aldi", "Denner"], ingredients: [{ ref: "kokosmilch" }, { ref: "crevetten_roses" }, { ref: "reispapier" }, { ref: "gehackte_tomaten" }, { staple: "reis" }, { staple: "gewuerze" }] }
];

export function menuById(id) {
  return MENUS.find(m => m.id === id);
}

export function labelTag(t) {
  return ({ fleisch: "Fleisch", fisch: "Fisch", veggie: "Veggie", schnell: "Schnell" })[t] || t;
}
