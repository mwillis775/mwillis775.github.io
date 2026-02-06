// Initialize counter for node IDs used by D3
let nodeIdCounter = 0;
// Store root node globally for updates and access by functions like search
let rootNode;
// Store current zoom/pan transform globally
let currentTransform = d3.zoomIdentity;
// Time scale for phylogenetic tree (millions of years ago)
const timeScale = d3.scaleLinear();

// --- Comprehensive Plant Data (Structured for easier management) ---
// This data structure is used to dynamically build the hierarchy for D3.
// Bryophyta section updated with Orders based on user input.
const plantData = {
    "bryophytes": {
        name: "Non-Vascular Plants (Bryophytes s.l.)",
        note: "Bryophytes are a paraphyletic group consisting of three distinct divisions.",
        time: 470, // Approximate divergence time in millions of years ago (MYA)
        subgroups: {
            // -----------------------------------------------------------------
            // Division: Marchantiophyta (Liverworts)
            // Classification largely follows Söderström et al. 2016 & Crandall-Stotler et al. 2009
            // -----------------------------------------------------------------
            "Marchantiophyta": {
                name: "Marchantiophyta (Liverworts)",
                time: 450,
                subgroups: {
                    "Haplomitriopsida": {
                        name: "Class: Haplomitriopsida",
                        subgroups: {
                            "Haplomitriales": { name: "Order: Haplomitriales", families: ["Haplomitriaceae"] },
                            "Treubiales": { name: "Order: Treubiales", families: ["Treubiaceae"] }
                        }
                    },
                    "Marchantiopsida": {
                        name: "Class: Marchantiopsida",
                        subgroups: {
                            "Blasiales": { name: "Order: Blasiales", families: ["Blasiaceae"] },
                            "Sphaerocarpales": {
                                name: "Order: Sphaerocarpales",
                                families: ["Sphaerocarpaceae", "Riellaceae", "Monocarpaceae"] // Monocarpaceae sometimes included in Sphaerocarpaceae
                            },
                            "Marchantiales": {
                                name: "Order: Marchantiales",
                                families: [
                                    "Marchantiaceae", "Aytoniaceae", "Cleveaceae", "Conocephalaceae",
                                    "Lunulariaceae", "Wiesnerellaceae", "Dumortieraceae", "Monosoleniaceae",
                                    "Oxymitraceae", "Ricciaceae", "Targioniaceae", "Cyathodiaceae",
                                    "Exormothecaceae", "Corsiniaceae" // Position of some families debated
                                ]
                            },
                             "Neohodgsoniales": { name: "Order: Neohodgsoniales", families: ["Neohodgsoniaceae"] } // Sometimes included in Marchantiales
                        }
                    },
                    "Jungermanniopsida": {
                        name: "Class: Jungermanniopsida",
                        subgroups: {
                            "Pelliales": { name: "Order: Pelliales", families: ["Pelliaceae", "Noterocladaceae"] },
                            "Fossombroniales": { name: "Order: Fossombroniales", families: ["Fossombroniaceae", "Allisoniaceae", "Calypogeiaceae", "Makinoaceae"] }, // Calypogeiaceae sometimes placed elsewhere
                            "Metzgeriales": { name: "Order: Metzgeriales", families: ["Metzgeriaceae", "Aneuraceae", "Mizutaniaceae", "Vandiemeniaceae"] },
                            "Pleuroziales": { name: "Order: Pleuroziales", families: ["Pleuroziaceae"] },
                            "Jungermanniales": {
                                name: "Order: Jungermanniales",
                                families: [
                                    // Suborder Perssoniellineae
                                    "Schistochilaceae", "Perssoniellaceae",
                                    // Suborder Lophocoleineae
                                    "Lophocoleaceae", "Plagiochilaceae", "Lepidoziaceae", "Pseudolepicoleaceae",
                                    "Trichocoleaceae", "Blepharostomataceae", "Brevianthaceae", "Chonecoleaceae",
                                    "Geocalycaceae", "Herbertaceae", "Lepicoleaceae", "Mastigophoraceae",
                                    "Adelanthaceae", "Cephaloziaceae", "Cephaloziellaceae", "Jackiellaceae",
                                    "Scapaniaceae", "Lophoziaceae", "Acrobolbaceae", "Antheliaceae",
                                    "Arnelliaceae", "Calypogeiaceae", // Also listed under Fossombroniales, position debated
                                    "Gymnomitriaceae", "Jungermanniaceae", "Mesoptychiaceae", "Myliaceae",
                                    "Stephaniellaceae", "Trichotemnomataceae"
                                    // Many families, circumscription varies
                                ]
                            },
                            "Porellales": {
                                name: "Order: Porellales",
                                families: [
                                    "Porellaceae", "Goebeliellaceae", "Lepidolaenaceae"
                                ]
                            },
                            "Radulales": { name: "Order: Radulales", families: ["Radulaceae"] },
                            "Jubulales": { // Often included within Porellales
                                name: "Order: Jubulales",
                                families: ["Frullaniaceae", "Jubulaceae", "Lejeuneaceae"]
                            }
                        }
                    }
                }
            },
            // -----------------------------------------------------------------
            // Division: Bryophyta (Mosses)
            // Classification largely follows Goffinet et al. 2009 & subsequent updates
            // -----------------------------------------------------------------
            "Bryophyta": {
                name: "Bryophyta (Mosses)",
                time: 440,
                subgroups: {
                    // --- Basal Lineages ---
                    "Takakiopsida": { name: "Class: Takakiopsida", subgroups: { "Takakiales": { name: "Order: Takakiales", families: ["Takakiaceae"] } } },
                    "Sphagnopsida": { name: "Class: Sphagnopsida", subgroups: { "Sphagnales": { name: "Order: Sphagnales", families: ["Sphagnaceae", "Ambuchananiaceae", "Flatbergiaceae"] } } },
                    "Andreaeopsida": { name: "Class: Andreaeopsida", subgroups: { "Andreaeales": { name: "Order: Andreaeales", families: ["Andreaeaceae"] } } },
                    "Andreaeobryopsida": { name: "Class: Andreaeobryopsida", subgroups: { "Andreaeobryales": { name: "Order: Andreaeobryales", families: ["Andreaeobryaceae"] } } },
                    "Oedipodiopsida": { name: "Class: Oedipodiopsida", subgroups: { "Oedipodiales": { name: "Order: Oedipodiales", families: ["Oedipodiaceae"] } } },
                    "Polytrichopsida": { name: "Class: Polytrichopsida", subgroups: { "Polytrichales": { name: "Order: Polytrichales", families: ["Polytrichaceae"] } } },
                    "Tetraphidopsida": { name: "Class: Tetraphidopsida", subgroups: { "Tetraphidales": { name: "Order: Tetraphidales", families: ["Tetraphidaceae"] } } }, // Pseudoditrichaceae sometimes included here or Bryopsida
                    // --- Bryopsida (Largest Class) ---
                    "Bryopsida": {
                        name: "Class: Bryopsida",
                        subgroups: {
                            // Subclass Diphysciidae
                            "Diphysciales": { name: "Order: Diphysciales", families: ["Diphysciaceae"] },
                             // Subclass Funariidae
                            "Funariales": { name: "Order: Funariales", families: ["Funariaceae", "Disceliaceae"] },
                            "Encalyptales": { name: "Order: Encalyptales", families: ["Encalyptaceae"] },
                            "Gigaspermales": { name: "Order: Gigaspermales", families: ["Gigaspermaceae"] }, // Position sometimes debated
                            // Subclass Dicranidae
                            "Catoscopiales": { name: "Order: Catoscopiales", families: ["Catoscopiaceae"] },
                            "Scouleriales": { name: "Order: Scouleriales", families: ["Scouleriaceae", "Drummondiaceae"] },
                            "Bryoxiphiales": { name: "Order: Bryoxiphiales", families: ["Bryoxiphiaceae"] },
                            "Grimmiales": { name: "Order: Grimmiales", families: ["Grimmiaceae", "Ptychomitriaceae", "Seligeriaceae"] }, // Saelaniaceae often in Seligeriaceae
                            "Archidiales": { name: "Order: Archidiales", families: ["Archidiaceae"] },
                            "Mitteniales": { name: "Order: Mitteniales", families: ["Mitteniaceae"] },
                            "Dicranales": { name: "Order: Dicranales", families: ["Dicranaceae", "sorapillaceae", "Bruchiaceae", "Calymperaceae", "Dicranellaceae", "Ditrichaceae", "Erpodiaceae", "Eustichiaceae", "Fissidentaceae", "Leucobryaceae", "Micromitriaceae", "Rhabdoweisiaceae", "Rhachitheciaceae", "Schistostegaceae", "Viridivelleraceae", "Wardiaceae"] }, // Many families, circumscription varies
                            "Pottiales": { name: "Order: Pottiales", families: ["Pottiaceae", "Pleurophascaceae", "Serpotortellaceae", "Hypodontiaceae"] }, // Cinclidotaceae often in Pottiaceae
                            // Subclass Bryidae
                            // Superorder Bryanae
                            "Splachnales": { name: "Order: Splachnales", families: ["Splachnaceae", "Meesiaceae"] },
                            "Hedwigiales": { name: "Order: Hedwigiales", families: ["Hedwigiaceae", "Bryowijkiaceae", "Rhacocarpaceae"] },
                            "Bartramiales": { name: "Order: Bartramiales", families: ["Bartramiaceae"] },
                            "Bryales": { name: "Order: Bryales", families: ["Bryaceae", "Mniaceae", "Leptostomataceae", "Phyllodrepaniaceae", "Pseudoditrichaceae", "Pulchrinodaceae"] }, // Aulacomniaceae sometimes here or Rhizogoniales
                            "Orthodontiales": { name: "Order: Orthodontiales", families: ["Orthodontiaceae"] },
                            "Orthotrichales": { name: "Order: Orthotrichales", families: ["Orthotrichaceae"] },
                            "Rhizogoniales": { name: "Order: Rhizogoniales", families: ["Rhizogoniaceae", "Aulacomniaceae", "Calomniaceae"] },
                            "Hypnodendrales": { name: "Order: Hypnodendrales", families: ["Hypnodendraceae", "Braithwaiteaceae", "Pterobryellaceae", "Racopilaceae"] }, // Racopilaceae sometimes separate order
                             // Superorder Hypnanae
                            "Hypopterygiales": { name: "Order: Hypopterygiales", families: ["Hypopterygiaceae"] },
                            "Hookeriales": { name: "Order: Hookeriales", families: ["Hookeriaceae", "Daltoniaceae", "Saulomataceae", "Schimperobryaceae", "Pilotrichaceae", "Leucomiaceae", "Symphyodontaceae"]},
                            "Hypnales": {
                                name: "Order: Hypnales", families: [
                                    "Amblystegiaceae", "Anomodontaceae", "Brachytheciaceae", "Calliergonaceae",
                                    "Catagoniaceae", "Climaciaceae", "Cryphaeaceae", "Echinodiaceae",
                                    "Entodontaceae", "Fabroniaceae", "Fontinalaceae", "Helodiaceae",
                                    "Hylocomiaceae", "Hypnaceae", "Lembophyllaceae",
                                    "Lepyrodontaceae", "Leskeaceae", "Leucodontaceae", "Meteoriaceae",
                                    "Microtheciellaceae", "Myriniaceae", "Myuriaceae", "Neckeraceae",
                                    "Orthorrhynchiaceae", "Phyllogoniaceae", "Plagiotheciaceae", "Prionodontaceae",
                                    "Pseudoleskeaceae", "Pseudoleskeellaceae", "Pterigynandraceae", "Pterobryaceae",
                                    "Pylaisiadelphaceae", "Regmatodontaceae", "Rhytidiaceae", "Rutenbergiaceae",
                                    "Sematophyllaceae", "Stereophyllaceae",
                                    "Theliaceae", "Thuidiaceae", "Trachylomataceae"
                                    // This is a huge order, family circumscriptions and placements are complex and debated.
                                ]
                            },
                            "Ptychomniales": { name: "Order: Ptychomniales", families: ["Ptychomniaceae"] }
                            // Note: Isobryales, Leucodontales, Thuidiales etc. from the original list are generally subsumed within Hypnales or related orders in newer classifications.
                        }
                    }
                }
            },
            // -----------------------------------------------------------------
            // Division: Anthocerotophyta (Hornworts)
            // Classification follows Renzaglia et al. 2009, Villarreal & Renzaglia 2015
            // -----------------------------------------------------------------
            "Anthocerotophyta": {
                name: "Anthocerotophyta (Hornworts)",
                time: 430,
                 subgroups: {
                    "Leiosporocerotales": { name: "Order: Leiosporocerotales", families: ["Leiosporocerotaceae"] },
                    "Anthocerotales": { name: "Order: Anthocerotales", families: ["Anthocerotaceae"] },
                    "Notothyladales": { name: "Order: Notothyladales", families: ["Notothyladaceae"] },
                    "Phymatocerotales": { name: "Order: Phymatocerotales", families: ["Phymatocerotaceae"] },
                    "Dendrocerotales": { name: "Order: Dendrocerotales", families: ["Dendrocerotaceae"] }
                 }
            }
        }
    },
    // =========================================================================
    // Vascular Plants (Tracheophytes)
    // =========================================================================
    "vascular_plants": {
        name: "Vascular Plants (Tracheophytes)",
        time: 430, // Approximate divergence time in millions of years ago (MYA)
        subgroups: {
            // -----------------------------------------------------------------
            // Division: Lycopodiophyta (Lycophytes)
            // Classification follows PPG I (Pteridophyte Phylogeny Group I, 2016)
            // -----------------------------------------------------------------
            "lycophytes": {
                name: "Lycopodiophyta (Lycophytes)",
                time: 420,
                subgroups: {
                    "Lycopodiales": {
                        name: "Order: Lycopodiales",
                        families: ["Lycopodiaceae"] // Sometimes split into Lycopodiaceae, Huperziaceae, Lycopodiellaceae
                    },
                    "Isoetales": { name: "Order: Isoetales", families: ["Isoetaceae"] },
                    "Selaginellales": { name: "Order: Selaginellales", families: ["Selaginellaceae"] }
                }
            },
            // -----------------------------------------------------------------
            // Division: Polypodiophyta / Monilophyta (Ferns & Allies)
            // Classification follows PPG I (Pteridophyte Phylogeny Group I, 2016)
            // -----------------------------------------------------------------
            "monilophytes": {
                name: "Polypodiophyta (Ferns & Allies - Monilophytes)",
                time: 400,
                subgroups: {
                    "Equisetopsida": {
                        name: "Class: Equisetopsida",
                        subgroups: {
                            "Equisetales": { name: "Order: Equisetales", families: ["Equisetaceae"] }
                        }
                    },
                    "Psilotopsida": {
                        name: "Class: Psilotopsida",
                        subgroups: {
                            "Ophioglossales": { name: "Order: Ophioglossales", families: ["Ophioglossaceae"] },
                            "Psilotales": { name: "Order: Psilotales", families: ["Psilotaceae"] }
                        }
                    },
                    "Marattiopsida": { // Added missing class
                        name: "Class: Marattiopsida",
                        subgroups: {
                            "Marattiales": { name: "Order: Marattiales", families: ["Marattiaceae"] }
                        }
                    },
                    "Polypodiopsida": {
                        name: "Class: Polypodiopsida (Leptosporangiate Ferns)",
                        subgroups: { // Added Orders and expanded families significantly
                            "Osmundales": { name: "Order: Osmundales", families: ["Osmundaceae"] },
                            "Hymenophyllales": { name: "Order: Hymenophyllales", families: ["Hymenophyllaceae"] },
                            "Gleicheniales": { name: "Order: Gleicheniales", families: ["Gleicheniaceae", "Dipteridaceae", "Matoniaceae"] },
                            "Schizaeales": { name: "Order: Schizaeales", families: ["Schizaeaceae", "Anemiaceae", "Lygodiaceae"] },
                            "Salviniales": { name: "Order: Salviniales (Heterosporous Ferns)", families: ["Salviniaceae", "Marsileaceae"] },
                            "Cyatheales": {
                                name: "Order: Cyatheales (Tree Ferns & relatives)", families: [
                                    "Cyatheaceae", "Thyrsopteridaceae", "Loxsomataceae", "Culcitaceae",
                                    "Plagiogyriaceae", "Metaxyaceae", "Dicksoniaceae", "Cibotiaceae" // Cibotiaceae sometimes in Dicksoniaceae
                                ]
                            },
                            "Polypodiales": {
                                name: "Order: Polypodiales (Largest fern order)", families: [
                                    // Suborder Saccolomatineae
                                    "Saccolomataceae",
                                    // Suborder Lindsaeineae
                                    "Lindsaeaceae", "Cystodiaceae", "Lonchitidaceae",
                                    // Suborder Pteridineae
                                    "Pteridaceae", // Includes former Adiantaceae, Parkeriaceae, Vittariaceae, Cryptogrammaceae, Cheilanthaceae etc. Very large.
                                    // Suborder Dennstaedtiineae
                                    "Dennstaedtiaceae", // Includes former Hypolepidaceae, Monachosoraceae, Pteridiaceae
                                    // Suborder Aspleniineae (eupolypods II)
                                    "Aspleniaceae", "Athyriaceae", "Blechnaceae", "Cystopteridaceae",
                                    "Diplaziopsidaceae", "Dryopteridaceae", "Desmophlebiaceae", "Hemidictyaceae",
                                    "Lomariopsidaceae", "Nephrolepidaceae", "Onocleaceae", "Rhachidosoraceae",
                                    "Tectariaceae", "Thelypteridaceae", "Woodsiaceae", // Circumscriptions vary, e.g., Athyriaceae, Woodsiaceae often split/lumped differently
                                    // Suborder Polypodiineae (eupolypods I)
                                    "Polypodiaceae", // Includes former Drynariaceae, Grammitidaceae, Loxogrammaceae, Platyceriaceae etc. Very large.
                                    "Davalliaceae", "Didymochlaenaceae", "Hypodematiaceae", "Oleandraceae"
                                ]
                            }
                        }
                    }
                }
            },
            // -----------------------------------------------------------------
            // Spermatophytes (Seed Plants)
            // -----------------------------------------------------------------
            "spermatophytes": {
                name: "Spermatophytes (Seed Plants)",
                time: 350,
                subgroups: {
                    // ---------------------------------------------------------
                    // Division: Gymnosperms (Acrogymnospermae - Paraphyletic or Polyphyletic depending on definition)
                    // ---------------------------------------------------------
                    "gymnosperms": {
                        name: "Gymnosperms",
                        note: "Extant gymnosperms comprise four distinct groups/orders.",
                        time: 310,
                        subgroups: {
                            "Cycadales": { name: "Order: Cycadales (Cycads)", families: ["Cycadaceae", "Zamiaceae", "Stangeriaceae"] }, // Stangeriaceae often included in Zamiaceae
                            "Ginkgoales": { name: "Order: Ginkgoales (Ginkgo)", families: ["Ginkgoaceae"] },
                            "Gnetales": { name: "Order: Gnetales", families: ["Gnetaceae", "Welwitschiaceae", "Ephedraceae"] },
                            "Pinales": { name: "Order: Pinales (Conifers)", families: ["Pinaceae", "Araucariaceae", "Podocarpaceae", "Sciadopityaceae", "Cupressaceae", "Taxaceae"] } // Taxaceae often included within Cupressaceae s.l.
                        }
                    },
                    // ---------------------------------------------------------
                    // Division: Angiosperms (Flowering Plants - Magnoliophyta)
                    // Classification follows APG IV (Angiosperm Phylogeny Group IV, 2016)
                    // ---------------------------------------------------------
                    "angiosperms": {
                        name: "Angiosperms (Flowering Plants)",
                        time: 140,
                        subgroups: {
                            // --- Basal Angiosperms (ANA Grade - Paraphyletic) ---
                            "basal_angiosperms": {
                                name: "Basal Angiosperms (ANA Grade)",
                                time: 135,
                                subgroups: {
                                    "Amborellales": { name: "Order: Amborellales", families: ["Amborellaceae"] },
                                    "Nymphaeales": { name: "Order: Nymphaeales (Water Lilies)", families: ["Nymphaeaceae", "Cabombaceae", "Hydatellaceae"] },
                                    "Austrobaileyales": { name: "Order: Austrobaileyales", families: ["Austrobaileyaceae", "Schisandraceae", "Trimeniaceae"] } // Schisandraceae includes Illiciaceae
                                }
                            },
                            // --- Mesangiospermae ---
                            "mesangiospermae": {
                                name: "Mesangiospermae",
                                time: 130,
                                subgroups: {
                                    "Chloranthales": { name: "Order: Chloranthales", families: ["Chloranthaceae"] }, // Position relative to Magnoliids/Monocots/Eudicots debated
                                    "Ceratophyllales": { name: "Order: Ceratophyllales", families: ["Ceratophyllaceae"] }, // Position uncertain, often sister to Eudicots
                                    // --- Magnoliids ---
                                    "magnoliids": {
                                        name: "Magnoliids",
                                        time: 120,
                                        subgroups: {
                                            "Magnoliales": { name: "Order: Magnoliales", families: ["Magnoliaceae", "Annonaceae", "Myristicaceae", "Degeneriaceae", "Eupomatiaceae", "Himantandraceae"] },
                                            "Laurales": { name: "Order: Laurales", families: ["Lauraceae", "Calycanthaceae", "Monimiaceae", "Atherospermataceae", "Gomortegaceae", "Hernandiaceae", "Siparunaceae"] },
                                            "Piperales": { name: "Order: Piperales", families: ["Piperaceae", "Aristolochiaceae", "Saururaceae", "Hydnoraceae"] }, // Hydnoraceae sometimes included in Aristolochiaceae
                                            "Canellales": { name: "Order: Canellales", families: ["Canellaceae", "Winteraceae"] }
                                        }
                                    },
                                    // --- Monocots ---
                                    "monocots": {
                                        name: "Monocots",
                                        time: 120,
                                        subgroups: {
                                            "Acorales": { name: "Order: Acorales", families: ["Acoraceae"] },
                                            "Alismatales": { name: "Order: Alismatales", families: ["Alismataceae", "Araceae", "Potamogetonaceae", "Hydrocharitaceae", "Juncaginaceae", "Butomaceae", "Aponogetonaceae", "Scheuchzeriaceae", "Posidoniaceae", "Ruppiaceae", "Cymodoceaceae", "Zosteraceae", "Tofieldiaceae", "Maundiaceae"] }, // Araceae includes Lemnaceae
                                            "Petrosaviales": { name: "Order: Petrosaviales", families: ["Petrosaviaceae"] },
                                            "Dioscoreales": { name: "Order: Dioscoreales", families: ["Dioscoreaceae", "Burmanniaceae", "Nartheciaceae"] },
                                            "Pandanales": { name: "Order: Pandanales", families: ["Pandanaceae", "Cyclanthaceae", "Stemonaceae", "Triuridaceae", "Velloziaceae"] },
                                            "Liliales": { name: "Order: Liliales", families: ["Liliaceae", "Colchicaceae", "Melanthiaceae", "Smilacaceae", "Alstroemeriaceae", "Campynemataceae", "Corsiaceae", "Petermanniaceae", "Philesiaceae", "Ripogonaceae"] },
                                            "Asparagales": { name: "Order: Asparagales", families: ["Asparagaceae", "Amaryllidaceae", "Iridaceae", "Orchidaceae", "Asphodelaceae", "Asteliaceae", "Blandfordiaceae", "Boryaceae", "Doryanthaceae", "Hypoxidaceae", "Ixioliriaceae", "Lanariaceae", "Tecophilaeaceae", "Xeronemataceae"] }, // Asparagaceae, Amaryllidaceae, Asphodelaceae are very broadly defined in APG IV, subsuming many former families (Agavaceae, Hyacinthaceae, Xanthorrhoeaceae, Alliaceae etc.)
                                            // Commelinids
                                            "Arecales": { name: "Order: Arecales (Palms)", families: ["Arecaceae", "Dasypogonaceae"] }, // Dasypogonaceae sometimes placed in its own order Dasypogonales
                                            "Poales": { name: "Order: Poales (Grasses, Sedges, Rushes, etc.)", families: ["Poaceae", "Cyperaceae", "Juncaceae", "Bromeliaceae", "Typhaceae", "Eriocaulaceae", "Xyridaceae", "Rapateaceae", "Thurniaceae", "Mayacaceae", "Ecdeiocoleaceae", "Joinvilleaceae", "Restionaceae", "Flagellariaceae", "Centrolepidaceae", "Anarthriaceae"] }, // Typhaceae includes Sparganiaceae; Restionaceae includes Anarthriaceae and Centrolepidaceae in some views
                                            "Commelinales": { name: "Order: Commelinales", families: ["Commelinaceae", "Haemodoraceae", "Pontederiaceae", "Hanguanaceae", "Philydraceae"] },
                                            "Zingiberales": { name: "Order: Zingiberales", families: ["Zingiberaceae", "Musaceae", "Marantaceae", "Cannaceae", "Heliconiaceae", "Strelitziaceae", "Lowiaceae", "Costaceae"] }
                                            // Dasypogonales sometimes recognized separately for Dasypogonaceae
                                        }
                                    },
                                    // --- Eudicots ---
                                    "eudicots": {
                                        name: "Eudicots",
                                        time: 120,
                                        subgroups: {
                                            // --- Basal Eudicots (Paraphyletic grade) ---
                                            "Ranunculales": { name: "Order: Ranunculales", families: ["Ranunculaceae", "Berberidaceae", "Papaveraceae", "Menispermaceae", "Lardizabalaceae", "Eupteleaceae", "Circaeasteraceae"] }, // Papaveraceae includes Fumariaceae, Pteridophyllaceae
                                            "Proteales": { name: "Order: Proteales", families: ["Proteaceae", "Platanaceae", "Nelumbonaceae"] },
                                            "Sabiaceae": { name: "Family: Sabiaceae", families: ["Sabiaceae"], note: "Unplaced to order, sister to Proteales or rest of Core Eudicots" }, // Often treated as family unplaced to order
                                            "Trochodendrales": { name: "Order: Trochodendrales", families: ["Trochodendraceae"] }, // Includes Tetracentraceae
                                            "Buxales": { name: "Order: Buxales", families: ["Buxaceae", "Haptanthaceae"] }, // Haptanthaceae sometimes included in Buxaceae
                                            // --- Core Eudicots ---
                                            "core_eudicots": {
                                                name: "Core Eudicots",
                                                time: 115,
                                                subgroups: {
                                                    "Gunnerales": { name: "Order: Gunnerales", families: ["Gunneraceae", "Myrothamnaceae"] },
                                                    "Dilleniales": { name: "Order: Dilleniales", families: ["Dilleniaceae"] },
                                                    // --- Superrosids ---
                                                    "superrosids": {
                                                        name: "Superrosids",
                                                        time: 110,
                                                        subgroups: {
                                                            "Saxifragales": { name: "Order: Saxifragales", families: ["Saxifragaceae", "Crassulaceae", "Grossulariaceae", "Hamamelidaceae", "Paeoniaceae", "Altingiaceae", "Cercidiphyllaceae", "Iteaceae", "Haloragaceae", "Aphanopetalaceae", "Daphniphyllaceae", "Cynomoriaceae", "Penthoraceae", "Tetracarpaeaceae", "Peridiscaceae"] }, // Peridiscaceae position debated
                                                            "Vitales": { name: "Order: Vitales", families: ["Vitaceae"] },
                                                            // --- Rosids ---
                                                            "rosids": {
                                                                name: "Rosids",
                                                                time: 105,
                                                                subgroups: {
                                                                    // Fabids (Nitrogen-fixing clade)
                                                                    "Fabales": { name: "Order: Fabales", families: ["Fabaceae", "Polygalaceae", "Surianaceae", "Quillajaceae"] }, // Fabaceae includes Caesalpiniaceae, Mimosaceae
                                                                    "Rosales": { name: "Order: Rosales", families: ["Rosaceae", "Moraceae", "Urticaceae", "Cannabaceae", "Ulmaceae", "Rhamnaceae", "Elaeagnaceae", "Barbeyaceae", "Dirachmaceae"] }, // Urticaceae includes Cecropiaceae
                                                                    "Fagales": { name: "Order: Fagales", families: ["Fagaceae", "Betulaceae", "Juglandaceae", "Myricaceae", "Casuarinaceae", "Ticodendraceae", "Nothofagaceae"] },
                                                                    "Cucurbitales": { name: "Order: Cucurbitales", families: ["Cucurbitaceae", "Begoniaceae", "Datiscaceae", "Anisophylleaceae", "Coriariaceae", "Corynocarpaceae", "Tetramelaceae", "Apodanthaceae"] }, // Apodanthaceae position debated
                                                                    // COM Clade (Celastrales, Oxalidales, Malpighiales)
                                                                    "Celastrales": { name: "Order: Celastrales", families: ["Celastraceae", "Lepidobotryaceae"] }, // Celastraceae includes Hippocrateaceae, Parnassiaceae, Pottingeriaceae
                                                                    "Oxalidales": { name: "Order: Oxalidales", families: ["Oxalidaceae", "Connaraceae", "Cunoniaceae", "Elaeocarpaceae", "Cephalotaceae", "Brunelliaceae", "Huaceae"] },
                                                                    "Malpighiales": { name: "Order: Malpighiales", families: ["Euphorbiaceae", "Salicaceae", "Violaceae", "Passifloraceae", "Rhizophoraceae", "Hypericaceae", "Clusiaceae", "Linaceae", "Malpighiaceae", "Phyllanthaceae", "Picrodendraceae", "Achariaceae", "Calophyllaceae", "Erythroxylaceae", "Podostemaceae", "Bonnetiaceae", "Chrysobalanaceae", "Ctenolophonaceae", "Dichapetalaceae", "Elatinaceae", "Euphroniaceae", "Goupiaceae", "Humiriaceae", "Ixonanthaceae", "Lacistemataceae", "Lophopyxidaceae", "Ochnaceae", "Pandaceae", "Peraceae", "Putranjivaceae", "Rafflesiaceae", "Trigoniaceae", "Centroplacaceae", "Irvingiaceae", "Balanopaceae", "Caryocaraceae", "Malesherbiaceae", "Turneraceae", "Samydaceae"] }, // Extremely large and diverse; Passifloraceae includes Malesherbiaceae, Turneraceae; Salicaceae includes Flacourtiaceae p.p.; Euphorbiaceae s.s.; Phyllanthaceae, Picrodendraceae, Peraceae, Putranjivaceae split from Euphorbiaceae s.l.; Hypericaceae often split from Clusiaceae; Ochnaceae includes Medusagynaceae, Quiinaceae; Chrysobalanaceae sometimes in own order. Rafflesiaceae position debated.
                                                                    // Malvids
                                                                    "Geraniales": { name: "Order: Geraniales", families: ["Geraniaceae", "Francoaceae", "Melianthaceae"] }, // Francoaceae includes Ledocarpaceae; Melianthaceae sometimes included in Francoaceae
                                                                    "Myrtales": { name: "Order: Myrtales", families: ["Myrtaceae", "Onagraceae", "Lythraceae", "Melastomataceae", "Combretaceae", "Vochysiaceae", "Penaeaceae", "Crypteroniaceae", "Alzateaceae", "Oliniaceae", "Rhynchocalycaceae", "Psiloxylaceae", "Heteropyxidaceae"] }, // Melastomataceae includes Memecylaceae; Penaeaceae includes Oliniaceae, Rhynchocalycaceae; Myrtaceae includes Psiloxylaceae, Heteropyxidaceae; Lythraceae includes Punicaceae, Sonneratiaceae, Trapaceae
                                                                    "Crossosomatales": { name: "Order: Crossosomatales", families: ["Crossosomataceae", "Staphyleaceae", "Strasburgeriaceae", "Guamatelaceae", "Aphloiaceae", "Geissolomataceae", "Ixerbaceae"] }, // Strasburgeriaceae includes Ixerbaceae
                                                                    "Picramniales": { name: "Order: Picramniales", families: ["Picramniaceae"] },
                                                                    "Huerteales": { name: "Order: Huerteales", families: ["Dipentodontaceae", "Tapisciaceae", "Gerrardinaceae", "Petenaeaceae"] },
                                                                    "Brassicales": { name: "Order: Brassicales", families: ["Brassicaceae", "Cleomaceae", "Capparaceae", "Resedaceae", "Bataceae", "Caricaceae", "Moringaceae", "Tropaeolaceae", "Akaniaceae", "Emblingiaceae", "Gyrostemonaceae", "Koeberliniaceae", "Limnanthaceae", "Pentadiplandraceae", "Salvadoraceae", "Setchellanthaceae", "Tovariaceae"] }, // Brassicaceae includes Cleomaceae p.p.; Akaniaceae includes Bretschneideraceae
                                                                    "Malvales": { name: "Order: Malvales", families: ["Malvaceae", "Thymelaeaceae", "Cistaceae", "Dipterocarpaceae", "Bixaceae", "Neuradaceae", "Sarcolaenaceae", "Sphaerosepalaceae", "Muntingiaceae", "Cytinaceae"] }, // Malvaceae s.l. includes Bombacaceae, Sterculiaceae, Tiliaceae; Bixaceae includes Cochlospermaceae, Diegodendraceae; Thymelaeaceae includes Gonystylaceae
                                                                    "Sapindales": { name: "Order: Sapindales", families: ["Sapindaceae", "Rutaceae", "Anacardiaceae", "Meliaceae", "Simaroubaceae", "Burseraceae", "Kirkiaceae", "Biebersteiniaceae", "Nitrariaceae"] } // Sapindaceae includes Aceraceae, Hippocastanaceae; Nitrariaceae includes Peganaceae, Tetradiclidaceae
                                                                }
                                                            }
                                                        }
                                                    },
                                                    // --- Superasterids ---
                                                    "superasterids": {
                                                        name: "Superasterids",
                                                        time: 110,
                                                        subgroups: {
                                                            "Berberidopsidales": { name: "Order: Berberidopsidales", families: ["Berberidopsidaceae", "Aextoxicaceae"] },
                                                            "Santalales": { name: "Order: Santalales", families: ["Santalaceae", "Balanophoraceae", "Misodendraceae", "Opiliaceae", "Loranthaceae", "Schoepfiaceae", "Erythropalaceae", "Strombosiaceae", "Coulaceae", "Ximeniaceae", "Aptandraceae", "Olacaceae", "Comandraceae", "Viscaceae", "Amphorogynaceae", "Thesiaceae"] }, // Santalaceae s.l. includes Viscaceae, Eremolepidaceae etc.; Olacaceae s.l. now split into multiple families
                                                            "Caryophyllales": { name: "Order: Caryophyllales", families: ["Caryophyllaceae", "Amaranthaceae", "Cactaceae", "Aizoaceae", "Portulacaceae", "Basellaceae", "Nyctaginaceae", "Phytolaccaceae", "Polygonaceae", "Plumbaginaceae", "Droseraceae", "Nepenthaceae", "Drosophyllaceae", "Frankeniaceae", "Tamaricaceae", "Simmondsiaceae", "Achatocarpaceae", "Anacampserotaceae", "Ancistrocladaceae", "Asteropeiaceae", "Barbeuiaceae", "Didiereaceae", "Dioncophyllaceae", "Gisekiaceae", "Halophytaceae", "Kewaceae", "Limeaceae", "Lophiocarpaceae", "Macarthuriaceae", "Microteaceae", "Molluginaceae", "Montiaceae", "Physenaceae", "Petiveriaceae", "Rhabdodendraceae", "Sarcobataceae", "Stegnospermataceae", "Talinaceae", "Agdestidaceae", "Illecebraceae", "Petrosimoniaceae"] }, // Very large and complex, includes carnivorous plants; Amaranthaceae includes Chenopodiaceae; Portulacaceae s.s.; Montiaceae split from Portulacaceae s.l.; Petiveriaceae, Riviniaceae, Agdestidaceae often included in Phytolaccaceae s.l.
                                                            // --- Asterids ---
                                                            "asterids": {
                                                                name: "Asterids",
                                                                time: 100,
                                                                subgroups: {
                                                                    "lamiids": {
                                                                        name: "Lamiids (Euasterids I)",
                                                                        time: 90,
                                                                        subgroups: {
                                                                            "Icacinales": { name: "Order: Icacinales", families: ["Icacinaceae", "Oncothecaceae"] }, // Icacinaceae s.s. after splitting
                                                                            "Metteniusales": { name: "Order: Metteniusales", families: ["Metteniusaceae"] },
                                                                            "Garryales": { name: "Order: Garryales", families: ["Garryaceae", "Eucommiaceae"] }, // Garryaceae includes Aucubaceae
                                                                            "Gentianales": { name: "Order: Gentianales", families: ["Gentianaceae", "Rubiaceae", "Apocynaceae", "Loganiaceae", "Gelsemiaceae", "Strychnaceae"] }, // Apocynaceae includes Asclepiadaceae; Loganiaceae s.s., several families split off (Gelsemiaceae, Strychnaceae etc.)
                                                                            "Boraginales": { name: "Order: Boraginales", families: ["Boraginaceae", "Codonaceae", "Cordiaceae", "Ehretiaceae", "Heliotropiaceae", "Hydrophyllaceae", "Lennoaceae", "Wellstediaceae", "Namaceae"] }, // Often treated as single family Boraginaceae s.l. or split as listed. Namaceae sometimes in Hydrophyllaceae.
                                                                            "Vahliales": { name: "Order: Vahliales", families: ["Vahliaceae"] },
                                                                            "Solanales": { name: "Order: Solanales", families: ["Solanaceae", "Convolvulaceae", "Montiniaceae", "Sphenocleaceae", "Hydroleaceae"] }, // Convolvulaceae includes Cuscutaceae; Hydroleaceae sometimes in Boraginales
                                                                            "Lamiales": { name: "Order: Lamiales", families: ["Lamiaceae", "Verbenaceae", "Oleaceae", "Scrophulariaceae", "Plantaginaceae", "Orobanchaceae", "Acanthaceae", "Bignoniaceae", "Gesneriaceae", "Pedaliaceae", "Lentibulariaceae", "Calceolariaceae", "Byblidaceae", "Carlemanniaceae", "Linderniaceae", "Martyniaceae", "Mazaceae", "Paulowniaceae", "Phrymaceae", "Plocospermataceae", "Schlegeliaceae", "Stilbaceae", "Tetrachondraceae", "Thomandersiaceae", "Wightiaceae"] }, // Very large order; Lamiaceae includes many former Verbenaceae; Plantaginaceae s.l. includes Callitrichaceae, Globulariaceae, Hippuridaceae; Scrophulariaceae s.s. after many genera moved to Plantaginaceae, Orobanchaceae, etc.; Orobanchaceae includes parasitic genera formerly in Scrophulariaceae; Phrymaceae includes Mimulaceae p.p.
                                                                        }
                                                                    },
                                                                    "campanulids": {
                                                                        name: "Campanulids (Euasterids II)",
                                                                        time: 90,
                                                                        subgroups: {
                                                                            "Aquifoliales": { name: "Order: Aquifoliales", families: ["Aquifoliaceae", "Cardiopteridaceae", "Stemonuraceae", "Phyllonomaceae", "Helwingiaceae"] }, // Cardiopteridaceae includes Leptaulaceae
                                                                            "Asterales": { name: "Order: Asterales", families: ["Asteraceae", "Campanulaceae", "Menyanthaceae", "Goodeniaceae", "Calyceraceae", "Stylidiaceae", "Alseuosmiaceae", "Argophyllaceae", "Phellinaceae", "Rousseaceae", "Pentaphragmataceae"] }, // Asteraceae (Compositae) is huge; Campanulaceae includes Lobeliaceae; Stylidiaceae includes Donatiaceae
                                                                            "Escalloniales": { name: "Order: Escalloniales", families: ["Escalloniaceae", "Polyosmaceae"] }, // Polyosmaceae sometimes included in Escalloniaceae
                                                                            "Bruniales": { name: "Order: Bruniales", families: ["Bruniaceae", "Columelliaceae"] }, // Columelliaceae includes Desfontainia
                                                                            "Paracryphiales": { name: "Order: Paracryphiales", families: ["Paracryphiaceae", "Quintiniaceae", "Sphenostemonaceae"] }, // Paracryphiaceae includes Quintiniaceae, Sphenostemonaceae
                                                                            "Dipsacales": { name: "Order: Dipsacales", families: ["Caprifoliaceae", "Adoxaceae"] }, // Caprifoliaceae s.l. includes Diervillaceae, Dipsacaceae, Linnaeaceae, Morinaceae, Valerianaceae; Adoxaceae includes Sambucaceae, Viburnaceae
                                                                            "Apiales": { name: "Order: Apiales", families: ["Apiaceae", "Araliaceae", "Pittosporaceae", "Griseliniaceae", "Torricelliaceae", "Pennantiaceae", "Myodocarpaceae"] } // Apiaceae (Umbelliferae) includes Hydrocotyle p.p.; Araliaceae includes Hydrocotyle p.p.
                                                                        }
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
};


console.log("DEBUG: Building plant hierarchy...");

/**
 * Recursively builds the hierarchical data structure required by D3
 * from the structured plantData object.
 * @param {object} data - The structured plant data (like plantData).
 * @returns {object} - The root node of the D3 hierarchy.
 */
function buildHierarchy(data) {
    function createNode(name, children = null, url = null, note = null, time = null) {
        const node = { name: name };
        if (url) node.url = url;
        if (note) node.note = note;
        if (time !== null) node.time = time;
        if (children && children.length > 0) node.children = children;
        return node;
    }

    function processSubgroups(subgroups) {
        return Object.entries(subgroups || {}).map(([key, subgroup]) => {
            const children = subgroup.subgroups ? processSubgroups(subgroup.subgroups) : null;
            const families = subgroup.families ? subgroup.families.map(family =>
                createNode(family, null, `families/${family.toLowerCase().replace(/ /g, '_')}.html`, null, 0)
            ) : null;

            const allChildren = [...(children || []), ...(families || [])];
            return createNode(subgroup.name, allChildren.length > 0 ? allChildren : null, null, subgroup.note, subgroup.time || null);
        });
    }

    const root = createNode("Plants", null, null, null, 500);

    const topLevelChildren = Object.values(data || {}).map(topGroup => {
        if (topGroup && topGroup.name) {
            const children = processSubgroups(topGroup.subgroups);
            return createNode(topGroup.name, children, null, topGroup.note, topGroup.time || null);
        }
        return null;
    }).filter(n => n !== null);

    root.children = topLevelChildren;

    return root;
}


// --- Generate the comprehensive tree data for D3 ---
const comprehensiveTreeData = buildHierarchy(plantData);

// --- Geological periods for the timeline ---
const geoPeriods = [
    { name: "Cambrian", start: 541, end: 485, color: "#7fa87f" },
    { name: "Ordovician", start: 485, end: 444, color: "#009270" },
    { name: "Silurian", start: 444, end: 419, color: "#b3e1b6" },
    { name: "Devonian", start: 419, end: 359, color: "#cb8c37" },
    { name: "Carboniferous", start: 359, end: 299, color: "#67a599" },
    { name: "Permian", start: 299, end: 252, color: "#f04028" },
    { name: "Triassic", start: 252, end: 201, color: "#812b92" },
    { name: "Jurassic", start: 201, end: 145, color: "#34b2c9" },
    { name: "Cretaceous", start: 145, end: 66, color: "#7fc64e" },
    { name: "Paleogene", start: 66, end: 23, color: "#fd9a52" },
    { name: "Neogene", start: 23, end: 2.6, color: "#ffe619" },
    { name: "Quaternary", start: 2.6, end: 0, color: "#f9f97f" }
];

// --- D3.js Visualization Code ---
document.addEventListener('DOMContentLoaded', function() {
    if (typeof d3 === 'undefined') {
        console.error("D3.js library not loaded.");
        const container = document.getElementById("phylogenetic-tree");
        if (container) {
            container.innerHTML = "<p style='color: red; text-align: center;'>Error: D3.js library failed to load. Tree cannot be displayed.</p>";
        }
        return;
    }

    const container = d3.select("#phylogenetic-tree");
    if (container.empty()) {
        console.error("Container element #phylogenetic-tree not found.");
        return;
    }

    // --- Dynamic Sizing & Margins ---
    const margin = { top: 60, right: 20, bottom: 30, left: 20 };
    const timelineHeight = 40; // Height for the geological timeline bar

    let svgWidth = container.node().clientWidth || 1200;
    let svgHeight = Math.max(window.innerHeight * 0.85, 700);

    const svg = container.append("svg")
        .attr("width", svgWidth)
        .attr("height", svgHeight);

    // Timeline group (fixed, not affected by zoom)
    const timelineG = svg.append("g")
        .attr("class", "timeline-group")
        .attr("transform", `translate(0, 0)`);

    // Main content group (zoomable)
    const g = svg.append("g").attr("class", "content-group");

    // Clipping rect to prevent tree from overlapping timeline
    svg.append("defs").append("clipPath")
        .attr("id", "tree-clip")
        .append("rect")
        .attr("x", 0)
        .attr("y", margin.top + timelineHeight)
        .attr("width", svgWidth)
        .attr("height", svgHeight - margin.top - timelineHeight);

    g.attr("clip-path", "url(#tree-clip)");

    // --- Time Scale ---
    const maxTime = 520; // MYA - start of visible timeline
    const treeWidth = svgWidth - margin.left - margin.right;

    timeScale
        .domain([maxTime, 0]) // MYA: past on left, present on right
        .range([margin.left, svgWidth - margin.right]);

    // --- Draw Geological Timeline ---
    function drawTimeline() {
        timelineG.selectAll("*").remove();

        // Background for timeline
        timelineG.append("rect")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", svgWidth)
            .attr("height", margin.top + timelineHeight)
            .attr("fill", "#ffffff");

        // Draw geological period bars
        geoPeriods.forEach(period => {
            const x1 = timeScale(period.start);
            const x2 = timeScale(period.end);
            const width = Math.max(0, x2 - x1);

            if (x2 > 0 && x1 < svgWidth) {
                timelineG.append("rect")
                    .attr("class", "geo-period")
                    .attr("x", Math.max(0, x1))
                    .attr("y", margin.top - 5)
                    .attr("width", Math.min(width, svgWidth - Math.max(0, x1)))
                    .attr("height", timelineHeight + 5)
                    .attr("fill", period.color);

                // Period label (only if wide enough)
                if (width > 30) {
                    timelineG.append("text")
                        .attr("class", "geo-period-label")
                        .attr("x", Math.max(0, x1) + Math.min(width, svgWidth - Math.max(0, x1)) / 2)
                        .attr("y", margin.top + timelineHeight / 2 + 3)
                        .text(period.name);
                }
            }
        });

        // Time axis
        const timeAxis = d3.axisTop(timeScale)
            .ticks(10)
            .tickFormat(d => d === 0 ? "Now" : d + " MYA");

        timelineG.append("g")
            .attr("class", "timeline-axis")
            .attr("transform", `translate(0, ${margin.top - 5})`)
            .call(timeAxis);

        // Vertical gridlines extending into tree area
        const gridTicks = timeScale.ticks(20);
        g.selectAll(".grid-line").remove();
        gridTicks.forEach(t => {
            g.append("line")
                .attr("class", "grid-line")
                .attr("x1", timeScale(t))
                .attr("x2", timeScale(t))
                .attr("y1", margin.top + timelineHeight)
                .attr("y2", svgHeight * 10) // extend far down
                .attr("stroke", "#eee")
                .attr("stroke-width", 0.5)
                .attr("stroke-dasharray", "2,4");
        });
    }

    drawTimeline();

    // --- Tree Layout Configuration ---
    const nodeVerticalSeparation = 18;
    const treemap = d3.tree().nodeSize([nodeVerticalSeparation, 1]); // horizontal spacing handled by time scale

    // --- Data Processing & Hierarchy ---
    rootNode = d3.hierarchy(comprehensiveTreeData, d => d.children);

    // Time step used when interpolating divergence times for nodes without explicit values
    const TIME_INTERPOLATION_STEP = 10; // MYA

    // Assign time-based positions: propagate times down the tree
    function assignTimes(node) {
        if (node.data.time !== null && node.data.time !== undefined) {
            node.timeValue = node.data.time;
        } else if (node.parent && node.parent.timeValue !== undefined) {
            if (node.children || node._children) {
                node.timeValue = Math.max(0, (node.parent.timeValue || 0) - TIME_INTERPOLATION_STEP);
            } else {
                node.timeValue = 0;
            }
        } else {
            node.timeValue = 0;
        }
        if (node.children) {
            node.children.forEach(assignTimes);
        }
    }
    assignTimes(rootNode);

    // --- Initial Collapse State ---
    function collapseLastBranch(node) {
       if (node.children) {
           const allChildrenAreLeaves = node.children.every(child => !child.children && !child._children);
           if (allChildrenAreLeaves && node.depth > 1) {
               node._children = node.children;
               node.children = null;
           } else {
               node.children.forEach(collapseLastBranch);
           }
       }
    }

    rootNode.each(d => {
       if (d._children) {
           d.children = d._children;
           d._children = null;
       }
    });

    if (rootNode.children) {
       rootNode.children.forEach(collapseLastBranch);
    }

    // --- Zoom & Pan Behavior ---
    const zoom = d3.zoom()
        .scaleExtent([0.1, 4])
        .on("zoom", (event) => {
            currentTransform = event.transform;
            g.attr("transform", event.transform);
        });

    svg.call(zoom);

    // Initial zoom: fit tree to viewport after first render
    const initialScale = 0.35;
    const initialTranslateX = 0;
    const initialTranslateY = margin.top + timelineHeight + 20;
    const initialTransform = d3.zoomIdentity.translate(initialTranslateX, initialTranslateY).scale(initialScale);

    svg.call(zoom.transform, initialTransform);
    currentTransform = initialTransform;

    // --- Initial Render ---
    update(rootNode);

    // Auto-fit tree to viewport after initial render
    setTimeout(() => {
        const bbox = g.node().getBBox();
        if (bbox.width > 0 && bbox.height > 0) {
            const treeAreaTop = margin.top + timelineHeight;
            const availableHeight = svgHeight - treeAreaTop - 20;
            const availableWidth = svgWidth - 20;
            const scaleX = availableWidth / bbox.width;
            const scaleY = availableHeight / bbox.height;
            const fitScale = Math.min(scaleX, scaleY, 1); // Don't zoom in beyond 1x
            const tx = -bbox.x * fitScale + 10;
            const ty = -bbox.y * fitScale + treeAreaTop + 10;
            const fitTransform = d3.zoomIdentity.translate(tx, ty).scale(fitScale);
            svg.transition().duration(500).call(zoom.transform, fitTransform);
            currentTransform = fitTransform;
        }
    }, 100);

    // --- Search Functionality ---
    const searchInput = document.getElementById('family-search');
    const resetSearchButton = document.getElementById('reset-search');

    function performSearch(searchTerm) {
        g.selectAll('.node text').classed('highlighted', false).style('font-weight', 'normal').style('fill', function(d) {
             return d.data.url ? '#1565C0' : '#333';
        });

        if (!rootNode || !searchTerm || searchTerm.length < 2) {
            return;
        }

        searchTerm = searchTerm.toLowerCase();
        let matchedNodes = [];
        let firstMatch = null;

        rootNode.each(d => {
            if(d._children) {
                 expand(d);
            }
            let nodeName = d.data.name ? d.data.name.toLowerCase() : '';
            if (nodeName.includes(searchTerm)) {
                matchedNodes.push(d);
                if (!firstMatch) firstMatch = d;
            }
        });

        matchedNodes.forEach(d => {
            expandParents(d);
        });

        update(rootNode);

        matchedNodes.forEach(d => {
            if (d.svgNode) {
                d3.select(d.svgNode).select('text')
                    .classed('highlighted', true)
                    .style('font-weight', 'bold')
                    .style('fill', '#d32f2f');
            }
        });

        if (firstMatch && firstMatch.x !== undefined && firstMatch.y !== undefined) {
            setTimeout(() => {
                const svgNode = svg.node();
                const svgWidthCurrent = svgNode.clientWidth;
                const svgHeightCurrent = svgNode.clientHeight;
                const targetX = svgWidthCurrent / 2;
                const targetY = svgHeightCurrent / 2;
                const nodeX = firstMatch.y;
                const nodeY = firstMatch.x;
                const currentScale = currentTransform.k;

                const newTx = targetX - nodeX * currentScale;
                const newTy = targetY - nodeY * currentScale;
                const newTransform = d3.zoomIdentity.translate(newTx, newTy).scale(currentScale);

                svg.transition().duration(750).call(zoom.transform, newTransform);
                currentTransform = newTransform;
            }, 150);
        }
    }

    function resetSearchHighlight() {
        searchInput.value = '';
         g.selectAll('.node text.highlighted')
             .classed('highlighted', false)
             .style('font-weight', 'normal')
              .style('fill', function(d) {
                  return d.data.url ? '#1565C0' : '#333';
             });
    }

    if (searchInput) {
        searchInput.addEventListener('input', () => performSearch(searchInput.value));
        searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') performSearch(searchInput.value); });
    }
    if (resetSearchButton) {
        resetSearchButton.addEventListener('click', resetSearchHighlight);
    }

    // --- Utility Functions ---
    function collapse(d) {
        if (d.children) {
            d._children = d.children;
            d.children = null;
        }
    }

    function expand(d) {
        if (d._children) {
            d.children = d._children;
            d._children = null;
        }
    }

    function expandParents(d) {
        let current = d.parent;
        while (current) {
            expand(current);
            current = current.parent;
        }
    }

    function toggleChildren(d) {
        if (d.children) {
            collapse(d);
        } else if (d._children) {
            expand(d);
        } else {
            return;
        }
        update(d);
    }

    // --- Elbow link generator for phylogenetic tree style ---
    function elbowLink(d) {
        const sourceY = d.parent.y;
        const sourceX = d.parent.x;
        const targetY = d.y;
        const targetX = d.x;
        return `M${sourceY},${sourceX}H${targetY}V${targetX}`;
    }

    // --- Main Update Function ---
    function update(source) {
        const duration = 500;

        // Re-assign times after expand/collapse
        assignTimes(rootNode);

        // Compute the new tree layout for vertical positioning (x values)
        const treeData = treemap(rootNode);
        const nodes = treeData.descendants();
        const links = treeData.descendants().slice(1);

        // Override horizontal positions (y) with time-based values
        nodes.forEach(d => {
            d.y = timeScale(d.timeValue !== undefined ? d.timeValue : 0);
        });

        // --- Nodes Section ---
        const node = g.selectAll('g.node')
            .data(nodes, d => d.id || (d.id = ++nodeIdCounter));

        const nodeEnter = node.enter().append('g')
            .attr('class', 'node')
            .classed('node--internal', d => d.children || d._children)
            .classed('node--leaf', d => !(d.children || d._children))
            .attr("transform", `translate(${source.y0 ?? timeScale(source.timeValue || 0)},${source.x0 ?? 0})`)
            .each(function(d) { d.svgNode = this; })
            .on('click', (event, d) => {
                 if (event.defaultPrevented) return;
                 if (d.children || d._children) {
                     toggleChildren(d);
                 } else if (d.data.url) {
                     window.open(d.data.url, '_blank');
                 }
            })
            .on('mouseover', (event, d) => {
                 if (!d3.select(event.currentTarget).select('text').classed('highlighted')) {
                     d3.select(event.currentTarget).select('text').style('font-weight', 'bold');
                 }
                 let tooltipHtml = `<strong>${d.data.name}</strong>`;
                 if (d.data.note) {
                     tooltipHtml += `<br><small><em>${d.data.note}</em></small>`;
                 }
                 if (d.timeValue > 0) {
                     tooltipHtml += `<br><small>~${d.timeValue} MYA</small>`;
                 }

                 d3.select('body').append('div').attr('class', 'tooltip')
                     .style('position', 'absolute')
                     .style('background', 'rgba(255, 255, 255, 0.95)')
                     .style('padding', '6px 10px')
                     .style('border', '1px solid #4a7c59')
                     .style('border-radius', '4px')
                     .style('box-shadow', '0 2px 6px rgba(0,0,0,0.15)')
                     .style('left', (event.pageX + 12) + 'px')
                     .style('top', (event.pageY - 12) + 'px')
                     .style('pointer-events', 'none')
                     .style('font-size', '11px')
                     .style('font-family', "'Open Sans', sans-serif")
                     .style('max-width', '280px')
                     .style('z-index', '10000')
                     .html(tooltipHtml);
             })
             .on('mouseout', (event, d) => {
                  if (!d3.select(event.currentTarget).select('text').classed('highlighted')) {
                      d3.select(event.currentTarget).select('text').style('font-weight', 'normal');
                  }
                  d3.selectAll('.tooltip').remove();
             });

        // Node circles
        nodeEnter.append('circle').attr('r', 1e-6);

        // Node labels
        nodeEnter.append('text')
            .attr("dy", ".35em")
            .attr("x", d => d.children || d._children ? -8 : 8)
            .attr("text-anchor", d => d.children || d._children ? "end" : "start")
            .text(d => {
                const name = d.data.name;
                const MAX_LABEL_LENGTH = 40;
                if (name.length > MAX_LABEL_LENGTH && !(d.children || d._children)) {
                    return name.substring(0, MAX_LABEL_LENGTH - 3) + '...';
                }
                return name;
            })
            .style("fill-opacity", 1e-6)
            .style('fill', d => d.data.url ? '#1565C0' : '#333')
            .style('cursor', d => (d.children || d._children || d.data.url) ? 'pointer' : 'default')
            .style('text-decoration', d => d.data.url ? 'underline' : 'none')
            .style("font-size", d => {
                if (d.depth <= 1) return "12px";
                if (d.depth <= 3) return "11px";
                return "10px";
            });

        // --- UPDATE section ---
        const nodeUpdate = nodeEnter.merge(node);

        nodeUpdate.transition().duration(duration)
            .attr("transform", d => `translate(${d.y},${d.x})`);

        nodeUpdate.select('circle')
            .attr('r', d => {
                if (d.depth === 0) return 6;
                if (d.children || d._children) return 4;
                return 3;
            })
            .classed('collapsed', d => !!d._children)
            .style("fill", d => {
                if (d._children) return "#81c784"; // Collapsed: light green
                if (d.children) return "#4a7c59";  // Expanded internal: dark green
                return "#a5d6a7"; // Leaf: soft green
            })
            .style("stroke", d => (d.children || d._children) ? "#2e5939" : "#4a7c59")
            .style("stroke-width", "1.5px")
            .attr('cursor', d => (d.children || d._children || d.data.url) ? 'pointer' : 'default');

        nodeUpdate.select('text')
            .style("fill-opacity", 1)
            .classed('highlighted', function(d) { return d3.select(this).classed('highlighted'); })
            .style('font-weight', function(d) { return d3.select(this).classed('highlighted') ? 'bold' : 'normal'; })
            .style('fill', function(d) {
                 if (d3.select(this).classed('highlighted')) return '#d32f2f';
                 return d.data.url ? '#1565C0' : '#333';
             });

        // --- EXIT section ---
        const nodeExit = node.exit().transition().duration(duration)
            .attr("transform", d => `translate(${source.y},${source.x})`)
            .remove();

        nodeExit.select('circle').attr('r', 1e-6);
        nodeExit.select('text').style('fill-opacity', 1e-6);

        // --- Links Section (Elbow style) ---
        const link = g.selectAll('path.link')
            .data(links, d => d.id);

        const linkEnter = link.enter().insert('path', "g")
            .attr("class", "link")
            .style('fill', 'none')
            .style('stroke', '#bbb')
            .style('stroke-width', '1.5px')
            .attr('d', d => {
                const o = { x: source.x0 ?? source.x, y: source.y0 ?? source.y };
                return `M${o.y},${o.x}H${o.y}V${o.x}`;
            });

        const linkUpdate = linkEnter.merge(link);

        linkUpdate.transition().duration(duration)
            .attr('d', d => elbowLink(d));

        link.exit().transition().duration(duration)
            .attr('d', d => {
                const o = { x: source.x, y: source.y };
                return `M${o.y},${o.x}H${o.y}V${o.x}`;
            })
            .remove();

        // Store positions for next transition
        nodes.forEach(d => {
            d.x0 = d.x;
            d.y0 = d.y;
        });

    } // End update function

    // --- Handle window resize ---
    window.addEventListener('resize', () => {
        svgWidth = container.node().clientWidth || 1200;
        svgHeight = Math.max(window.innerHeight * 0.85, 700);
        svg.attr("width", svgWidth).attr("height", svgHeight);

        timeScale.range([margin.left, svgWidth - margin.right]);

        // Update clip path
        svg.select("#tree-clip rect")
            .attr("width", svgWidth)
            .attr("height", svgHeight - margin.top - timelineHeight);

        drawTimeline();
        update(rootNode);
    });

}); // End DOMContentLoaded