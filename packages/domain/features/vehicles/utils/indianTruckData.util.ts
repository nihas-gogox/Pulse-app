/** Indian commercial vehicle list — matches pulse-unified-base for Add Vehicle. */
export interface IndianTruckSpec {
  brand: string;
  model: string;
  type: string;
  size: string;
  axle: string;
}

export interface VehicleCategoryRecommendation {
  category: string;
  brands: string[];
  models: string[];
  types: string[];
  payloadRangeTons: string;
  gvwRangeTons: string;
  axleConfigs: string[];
  tyreCounts: string[];
  primaryUseCases: string[];
}

export const INDIAN_TRUCK_LIST: IndianTruckSpec[] = [
  { brand: 'Tata', model: 'Signa 2823.K', type: 'Tipper', size: '16m³ / 18m³', axle: '6x4' },
  { brand: 'Tata', model: 'Signa 4825.T', type: 'Rigid Truck', size: '28ft / 32ft', axle: '10x2' },
  { brand: 'Tata', model: 'Ace Gold', type: 'Mini Truck', size: '7.2ft', axle: '4x2' },
  { brand: 'Ashok Leyland', model: 'AVTR 2820', type: 'Haulage', size: '24ft / 32ft', axle: '6x2' },
  { brand: 'Ashok Leyland', model: 'Dost Strong', type: 'Pickup', size: '8.2ft', axle: '4x2' },
  { brand: 'Eicher', model: 'Pro 3015', type: 'Cargo', size: '19ft / 20ft / 22ft', axle: '4x2' },
  { brand: 'BharatBenz', model: '1917R', type: 'Cargo', size: '20ft / 22ft / 24ft', axle: '4x2' },
  { brand: 'Mahindra', model: 'Blazo X 49', type: 'Trailer', size: 'Standard', axle: '6x4' },
  { brand: 'Ashok Leyland', model: 'AVTR 3120', type: 'Cargo', size: '24ft / 28ft', axle: '6x2' },
  { brand: 'Ashok Leyland', model: 'AVTR 3520', type: 'Cargo', size: '32ft', axle: '8x2' },
  { brand: 'Ashok Leyland', model: 'Boss 1415', type: 'Cargo', size: '19ft / 22ft', axle: '4x2' },
  { brand: 'Ashok Leyland', model: 'Boss 1215 HB', type: 'Light Truck', size: '17ft / 19ft', axle: '4x2' },
  { brand: 'Ashok Leyland', model: 'U 4923 TT', type: 'Tractor Head', size: 'Trailer', axle: '6x4' },
  { brand: 'Ashok Leyland', model: 'Captain 2832', type: 'Tipper', size: '18m³', axle: '6x4' },
  { brand: 'Ashok Leyland', model: 'Ecomet 1615 HE', type: 'Cargo', size: '20ft / 22ft', axle: '4x2' },
  { brand: 'Ashok Leyland', model: 'Partner 4 Tyre', type: 'Mini Truck', size: '14ft', axle: '4x2' },
  { brand: 'Ashok Leyland', model: 'Guru 1111', type: 'Cargo', size: '17ft / 19ft', axle: '4x2' },
  { brand: 'Ashok Leyland', model: 'AVTR 4220', type: 'Cargo', size: '28ft / 32ft', axle: '10x2' },

  // ---------------- TATA MOTORS ----------------
  { brand: "Tata", model: "Ace Gold", type: "Mini Truck", size: "7.2 ft", axle: "4x2" },
  { brand: "Tata", model: "Ace HT+", type: "Mini Truck", size: "8 ft", axle: "4x2" },
  { brand: "Tata", model: "Intra V10", type: "Pickup", size: "8.8 ft", axle: "4x2" },
  { brand: "Tata", model: "Intra V30", type: "Pickup", size: "9.2 ft", axle: "4x2" },
  { brand: "Tata", model: "Intra V50", type: "Pickup", size: "9.6 ft", axle: "4x2" },
  { brand: "Tata", model: "407 Gold SFC", type: "LCV", size: "14 ft", axle: "4x2" },
  { brand: "Tata", model: "709g LPT", type: "LCV", size: "17 ft", axle: "4x2" },
  { brand: "Tata", model: "1109g LPT", type: "LCV", size: "19 ft", axle: "4x2" },
  { brand: "Tata", model: "1512 LPT", type: "Rigid Truck", size: "20 ft", axle: "4x2" },
  { brand: "Tata", model: "1613 LPT", type: "Rigid Truck", size: "22 ft", axle: "4x2" },
  { brand: "Tata", model: "1916 LPT", type: "Cargo", size: "24 ft", axle: "4x2" },
  { brand: "Tata", model: "2518 LPT", type: "Cargo", size: "28 ft", axle: "6x2" },
  { brand: "Tata", model: "2821 LPT", type: "Cargo", size: "32 ft", axle: "6x2" },
  { brand: "Tata", model: "Signa 2823.K", type: "Tipper", size: "16 m3", axle: "6x4" },
  { brand: "Tata", model: "Signa 3525.K", type: "Tipper", size: "18 m3", axle: "8x4" },
  { brand: "Tata", model: "Signa 4625.S", type: "Tractor Trailer", size: "Standard", axle: "6x4" },
  { brand: "Tata", model: "Prima 4925.S", type: "Tractor Trailer", size: "Standard", axle: "6x4" },

  // ---------------- ASHOK LEYLAND ----------------
  { brand: "Ashok Leyland", model: "Dost Lite", type: "Mini Truck", size: "7.2 ft", axle: "4x2" },
  { brand: "Ashok Leyland", model: "Dost Strong", type: "Pickup", size: "8.2 ft", axle: "4x2" },
  { brand: "Ashok Leyland", model: "Partner 6 Tyre", type: "LCV", size: "17 ft", axle: "4x2" },
  { brand: "Ashok Leyland", model: "Ecomet 1215 HE", type: "LCV", size: "19 ft", axle: "4x2" },
  { brand: "Ashok Leyland", model: "Boss 1415", type: "Rigid Truck", size: "20 ft", axle: "4x2" },
  { brand: "Ashok Leyland", model: "1616 IL", type: "Cargo", size: "22 ft", axle: "4x2" },
  { brand: "Ashok Leyland", model: "2820 AVTR", type: "Cargo", size: "24 ft", axle: "6x2" },
  { brand: "Ashok Leyland", model: "3520 AVTR", type: "Tipper", size: "18 m3", axle: "8x4" },
  { brand: "Ashok Leyland", model: "4220 AVTR", type: "Tractor Trailer", size: "Standard", axle: "6x4" },

  // ---------------- EICHER ----------------
  { brand: "Eicher", model: "Pro 2049", type: "Mini Truck", size: "10 ft", axle: "4x2" },
  { brand: "Eicher", model: "Pro 2110", type: "LCV", size: "17 ft", axle: "4x2" },
  { brand: "Eicher", model: "Pro 3015", type: "Cargo", size: "20 ft", axle: "4x2" },
  { brand: "Eicher", model: "Pro 6048", type: "Tractor Trailer", size: "Standard", axle: "6x4" },

  // ---------------- BHARATBENZ ----------------
  { brand: "BharatBenz", model: "1015R", type: "LCV", size: "17 ft", axle: "4x2" },
  { brand: "BharatBenz", model: "1617R", type: "Cargo", size: "20 ft", axle: "4x2" },
  { brand: "BharatBenz", model: "2823R", type: "Cargo", size: "24 ft", axle: "6x2" },
  { brand: "BharatBenz", model: "3523C", type: "Tipper", size: "18 m3", axle: "8x4" },
  { brand: "BharatBenz", model: "5528T", type: "Tractor Trailer", size: "Standard", axle: "6x4" },

  // ---------------- MAHINDRA ----------------
  { brand: "Mahindra", model: "Jeeto Plus", type: "Mini Truck", size: "7.4 ft", axle: "4x2" },
  { brand: "Mahindra", model: "Bolero Pickup", type: "Pickup", size: "8.4 ft", axle: "4x2" },
  { brand: "Mahindra", model: "Furio 11", type: "LCV", size: "17 ft", axle: "4x2" },
  { brand: "Mahindra", model: "Blazo X 28", type: "Cargo", size: "24 ft", axle: "6x2" },
  { brand: "Mahindra", model: "Blazo X 49", type: "Tractor Trailer", size: "Standard", axle: "6x4" },

  // ---------------- VE COMMERCIAL (VOLVO EICHER) ----------------
  { brand: "Volvo", model: "FM 420 4x2T", type: "Tractor Trailer", size: "Standard", axle: "4x2" },
  { brand: "Volvo", model: "FM 420 6x4T", type: "Tractor Trailer", size: "Standard", axle: "6x4" },
  { brand: "Volvo", model: "FMX 460 8x4", type: "Tipper", size: "20 m3", axle: "8x4" },

  // ---------------- TRAILER COMBINATIONS (Generic) ----------------
  { brand: "Generic", model: "20 ft Container", type: "Container", size: "20 ft", axle: "2 Axle" },
  { brand: "Generic", model: "32 ft Container", type: "Container", size: "32 ft", axle: "2 Axle" },
  { brand: "Generic", model: "40 ft High Cube", type: "Container", size: "40 ft", axle: "3 Axle" },
  { brand: "Generic", model: "32 ft Single Axle", type: "Open Body", size: "32 ft", axle: "1 Axle" },
  { brand: "Generic", model: "32 ft Multi Axle", type: "Open Body", size: "32 ft", axle: "2 Axle" },
  { brand: "Generic", model: "Semi Low Bed Trailer", type: "Trailer", size: "40 ft", axle: "4 Axle" },
  { brand: "Generic", model: "Hydraulic Modular Trailer", type: "Trailer", size: "Custom", axle: "8 Axle" },


  // ================= TATA =================
  { brand: 'Tata', model: 'Signa 5525.S', type: 'Tractor Head', size: '40ft Trailer', axle: '6x4' },
  { brand: 'Tata', model: 'Signa 4018.S', type: 'Tractor Head', size: 'Trailer', axle: '4x2' },
  { brand: 'Tata', model: 'Ultra T.7', type: 'Light Truck', size: '14ft / 17ft', axle: '4x2' },
  { brand: 'Tata', model: 'Ultra T.9', type: 'Light Truck', size: '17ft / 19ft', axle: '4x2' },
  { brand: 'Tata', model: 'LPT 1618', type: 'Cargo', size: '20ft / 22ft', axle: '4x2' },
  { brand: 'Tata', model: 'LPT 2518', type: 'Cargo', size: '28ft / 32ft', axle: '6x2' },
  { brand: 'Tata', model: 'Prima 4625.S', type: 'Tractor Head', size: 'Trailer', axle: '6x4' },
  { brand: 'Tata', model: 'Prima 2830.K', type: 'Tipper', size: '16m³', axle: '6x4' },
  { brand: 'Tata', model: 'Intra V30', type: 'Pickup', size: '8ft', axle: '4x2' },
  { brand: 'Tata', model: 'Intra V50', type: 'Pickup', size: '9ft', axle: '4x2' },

  // ================= MAHINDRA =================
  { brand: 'Mahindra', model: 'Furio 7', type: 'Light Truck', size: '17ft', axle: '4x2' },
  { brand: 'Mahindra', model: 'Furio 12', type: 'Cargo', size: '22ft', axle: '4x2' },
  { brand: 'Mahindra', model: 'Furio 14', type: 'Cargo', size: '24ft', axle: '4x2' },
  { brand: 'Mahindra', model: 'Blazo X 42', type: 'Tractor Head', size: 'Trailer', axle: '6x4' },
  { brand: 'Mahindra', model: 'Blazo X 35', type: 'Cargo', size: '28ft / 32ft', axle: '8x2' },
  { brand: 'Mahindra', model: 'Jayo', type: 'Mini Truck', size: '14ft', axle: '4x2' },
  { brand: 'Mahindra', model: 'Supro Maxitruck', type: 'Pickup', size: '8ft', axle: '4x2' },
  { brand: 'Mahindra', model: 'Bolero Maxx Pik-Up HD', type: 'Pickup', size: '8.3ft', axle: '4x2' },

  // ================= EICHER =================
  { brand: 'Eicher', model: 'Pro 2049', type: 'Light Truck', size: '14ft', axle: '4x2' },
  { brand: 'Eicher', model: 'Pro 2095XP', type: 'Cargo', size: '17ft', axle: '4x2' },
  { brand: 'Eicher', model: 'Pro 2114XP', type: 'Cargo', size: '20ft / 22ft', axle: '4x2' },
  { brand: 'Eicher', model: 'Pro 3019', type: 'Cargo', size: '24ft', axle: '4x2' },
  { brand: 'Eicher', model: 'Pro 6048', type: 'Tractor Head', size: 'Trailer', axle: '6x4' },
  { brand: 'Eicher', model: 'Pro 6035T', type: 'Tractor Head', size: 'Trailer', axle: '6x4' },

  // ================= BHARATBENZ =================
  { brand: 'BharatBenz', model: '1217R', type: 'Cargo', size: '19ft / 22ft', axle: '4x2' },
  { brand: 'BharatBenz', model: '3523R', type: 'Cargo', size: '32ft', axle: '8x2' },
  { brand: 'BharatBenz', model: '4023TT', type: 'Tractor Head', size: 'Trailer', axle: '6x4' },
  { brand: 'BharatBenz', model: '5528TT', type: 'Tractor Head', size: 'Trailer', axle: '6x4' },

  // ================= ISUZU =================
  { brand: 'Isuzu', model: 'D-Max S-CAB', type: 'Pickup', size: '5.2ft', axle: '4x2' },
  { brand: 'Isuzu', model: 'SML N-Series', type: 'Light Truck', size: '14ft', axle: '4x2' },

  // ================= FORCE =================
  { brand: 'Force', model: 'Traveller Delivery Van', type: 'LCV', size: '14ft', axle: '4x2' },
  { brand: 'Force', model: 'Shaktiman 400', type: 'Cargo', size: '19ft', axle: '4x2' },

  // ================= AMW =================
  { brand: 'AMW', model: '2523 TP', type: 'Tipper', size: '16m³', axle: '6x4' },
  { brand: 'AMW', model: '3118 HL', type: 'Cargo', size: '24ft', axle: '6x2' },

  // ================= SML ISUZU =================
  { brand: 'SML Isuzu', model: 'Samrat XT', type: 'Cargo', size: '17ft / 19ft', axle: '4x2' },
  { brand: 'SML Isuzu', model: 'Sartaj GS 5252', type: 'Light Truck', size: '14ft', axle: '4x2' },

  // ================= PIAGGIO =================
  { brand: 'Piaggio', model: 'Porter 700', type: 'Mini Truck', size: '6ft', axle: '4x2' },
  { brand: 'Piaggio', model: 'Ape Xtra LDX', type: 'Mini Truck', size: '6.5ft', axle: '4x2' },

  // ================= VOLVO =================
  { brand: 'Volvo', model: 'FM 420 4x2', type: 'Tractor Head', size: 'Trailer', axle: '4x2' },
  { brand: 'Volvo', model: 'FM 440 6x4', type: 'Tipper', size: '20m³', axle: '6x4' },

  // ================= SCANIA =================
  { brand: 'Scania', model: 'G410', type: 'Tractor Head', size: 'Trailer', axle: '6x2' },
  { brand: 'Scania', model: 'P360', type: 'Tipper', size: '18m³', axle: '6x4' },
];

export const VEHICLE_CATEGORY_RECOMMENDATIONS: VehicleCategoryRecommendation[] = [
  {
    category: "Mini (SCV)",
    brands: [
      "Tata",
      "Mahindra",
      "Maruti Suzuki",
      "Ashok Leyland",
      "SML Isuzu",
      "Bajaj",
      "Piaggio",
      "Euler",
      "Altigreen",
      "Atul Auto",
      "Okinawa",
      "TVS",
    ],
    models: [
      "Ace Gold",
      "Ace HT Plus",
      "Ace EV",
      "Jeeto",
      "Super Carry",
      "Dost Li-Lite",
      "Dost+",
      "Isuzu Pickup",
      "Porter 180",
      "HiLoad EV",
      "Gemini",
      "King Kargo CNG HD",
    ],
    types: ["Pickup", "Mini-Van", "Closed Body", "EV Cargo"],
    payloadRangeTons: "0.3-1.5",
    gvwRangeTons: "0.7-3.5",
    axleConfigs: ["4x2"],
    tyreCounts: ["4"],
    primaryUseCases: ["Last-mile e-commerce", "FMCG", "Vegetable delivery", "Rural delivery"],
  },
  {
    category: "Light (LCV)",
    brands: ["Tata", "Mahindra", "Ashok Leyland", "Eicher", "Force Motors", "Hindustan"],
    models: ["407 Gold SFC", "Intra V10", "Yodha", "Furio 7", "Bada Dost", "Pro 2049", "Urbania Delivery Van"],
    types: ["Rigid Truck", "Container", "High Deck", "Pickup"],
    payloadRangeTons: "2-5",
    gvwRangeTons: "3.5-7.5",
    axleConfigs: ["4x2"],
    tyreCounts: ["4", "6"],
    primaryUseCases: ["Inter-city parcels", "White goods", "Poultry", "Furniture"],
  },
  {
    category: "Medium (MDT/ICV)",
    brands: ["Eicher", "Tata", "Ashok Leyland", "BharatBenz", "SML Isuzu", "Mahindra"],
    models: ["Pro 3015", "1512 LPT", "Ecomet 1615", "1217R", "Isuzu Samrat", "Blazo 25"],
    types: ["Rigid Truck", "Tipper", "Tanker", "Container"],
    payloadRangeTons: "7-11",
    gvwRangeTons: "8-19",
    axleConfigs: ["4x2", "6x2"],
    tyreCounts: ["6", "10"],
    primaryUseCases: ["Cement", "Steel rods", "FMCG bulk", "Textiles"],
  },
  {
    category: "Heavy (HDT/MHCV)",
    brands: ["Tata", "Ashok Leyland", "BharatBenz", "Eicher", "Mahindra", "VECV", "AMW"],
    models: [
      "Signa 4825.T",
      "Prima 5530.S",
      "AVTR 5525",
      "3528C",
      "Pro 6028TM",
      "Blazo X 42",
      "VECV 4923",
      "AMW 2516 TP",
    ],
    types: ["Rigid Multi-axle", "Tipper", "Tractor-Trailer"],
    payloadRangeTons: "15-40+",
    gvwRangeTons: "19-55",
    axleConfigs: ["6x4", "8x2", "8x4", "10x2", "10x4"],
    tyreCounts: ["10", "12", "14", "16"],
    primaryUseCases: ["Long-haul containers", "Mining", "EXIM", "Car carriers"],
  },
];

const UNIQUE_SORTED = (items: string[]): string[] => Array.from(new Set(items.filter(Boolean))).sort();

export function getBodyTypeRecommendations(query: string = ""): string[] {
  const q = query.trim().toLowerCase();
  const fromTrucks = INDIAN_TRUCK_LIST.map((t) => t.type);
  const fromCategories = VEHICLE_CATEGORY_RECOMMENDATIONS.flatMap((c) => c.types);
  const all = UNIQUE_SORTED([...fromTrucks, ...fromCategories]);
  if (!q) return all;
  return all.filter((v) => v.toLowerCase().includes(q));
}

export function getSizeRecommendations(query: string = ""): string[] {
  const q = query.trim().toLowerCase();
  const all = UNIQUE_SORTED(INDIAN_TRUCK_LIST.map((t) => t.size));
  if (!q) return all;
  return all.filter((v) => v.toLowerCase().includes(q));
}

export function getAxleRecommendations(query: string = ""): string[] {
  const q = query.trim().toLowerCase();
  const fromTrucks = INDIAN_TRUCK_LIST.map((t) => t.axle);
  const fromCategories = VEHICLE_CATEGORY_RECOMMENDATIONS.flatMap((c) => c.axleConfigs);
  const all = UNIQUE_SORTED([...fromTrucks, ...fromCategories]);
  if (!q) return all;
  return all.filter((v) => v.toLowerCase().includes(q));
}

export function getCapacityRecommendations(query: string = ""): string[] {
  const q = query.trim().toLowerCase();
  const all = UNIQUE_SORTED(VEHICLE_CATEGORY_RECOMMENDATIONS.map((c) => `${c.payloadRangeTons} tons`));
  if (!q) return all;
  return all.filter((v) => v.toLowerCase().includes(q));
}

export function getBrandRecommendations(query: string = ""): string[] {
  const q = query.trim().toLowerCase();
  const fromTrucks = INDIAN_TRUCK_LIST.map((t) => t.brand);
  const fromCategories = VEHICLE_CATEGORY_RECOMMENDATIONS.flatMap((c) => c.brands);
  const all = UNIQUE_SORTED([...fromTrucks, ...fromCategories]);
  if (!q) return all;
  return all.filter((v) => v.toLowerCase().includes(q));
}

export function getBrands(): string[] {
  const set = new Set(INDIAN_TRUCK_LIST.map((t) => t.brand));
  return Array.from(set).sort();
}

export function getModels(brand: string): IndianTruckSpec[] {
  if (!brand) return [];
  return INDIAN_TRUCK_LIST.filter((t) => t.brand === brand);
}

export function getTruckSpec(brand: string, model: string): IndianTruckSpec | null {
  if (!brand || !model) return null;
  return INDIAN_TRUCK_LIST.find((t) => t.brand === brand && t.model === model) ?? null;
}
