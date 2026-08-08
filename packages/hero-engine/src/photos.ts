export interface CategoryPhotos {
  category: string;
  hero: string[];
  alt: string[];
}

export const PEXELS_URL = (id: number, w = 1920) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${w}`;

// Large curated pools of premium, industry-specific stock photography per
// category. Every site picks a seeded subset so two sites never share the same
// hero imagery, even without real business photos.
export const CATEGORY_PHOTOS: Record<string, CategoryPhotos> = {
  medspa: {
    category: "medspa",
    hero: [
      PEXELS_URL(3997993), PEXELS_URL(3997371), PEXELS_URL(3997396), PEXELS_URL(3757953),
      PEXELS_URL(6621345), PEXELS_URL(6621513), PEXELS_URL(3687770), PEXELS_URL(3687837),
      PEXELS_URL(3762875), PEXELS_URL(3762901), PEXELS_URL(3997376), PEXELS_URL(3997386),
      PEXELS_URL(3757947), PEXELS_URL(3757942), PEXELS_URL(3687788), PEXELS_URL(3687918),
      PEXELS_URL(3959706), PEXELS_URL(3959618), PEXELS_URL(1448575), PEXELS_URL(1488310),
    ],
    alt: [
      "Luxury spa treatment room with soft lighting",
      "Relaxing spa ambiance with natural elements",
      "Professional skincare treatment",
      "Serene wellness environment",
      "Modern med spa interior",
      "Aesthetic clinic treatment room",
      "Facial treatment in progress",
      "Spa stones and candles",
      "Botanical skincare ingredients",
      "Calm wellness retreat lighting",
      "Luxury beauty treatment",
      "Elegant clinic space",
      "Dermatology consultation",
      "Glowing skin close-up",
      "Spa relaxation ritual",
      "Premium skincare products",
      "Anti-aging treatment room",
      "Med aesthetic procedure",
      "Warm spa candlelight",
      "Holistic wellness scene",
    ],
  },
  "real-estate-agent": {
    category: "real-estate-agent",
    hero: [
      PEXELS_URL(186077), PEXELS_URL(1643383), PEXELS_URL(106399), PEXELS_URL(259588),
      PEXELS_URL(323780), PEXELS_URL(439391), PEXELS_URL(53610), PEXELS_URL(1029599),
      PEXELS_URL(210617), PEXELS_URL(280222), PEXELS_URL(259600), PEXELS_URL(2724749),
      PEXELS_URL(1396122), PEXELS_URL(261102), PEXELS_URL(164558), PEXELS_URL(1396132),
      PEXELS_URL(1428348), PEXELS_URL(2724748), PEXELS_URL(1732414), PEXELS_URL(2079249),
    ],
    alt: [
      "Luxury home exterior",
      "Modern architectural residence",
      "Beautifully designed interior",
      "Real estate property with pool",
      "Premium family home",
      "Stunning modern house",
      "Dream home exterior",
      "Architectural masterpiece",
      "Cozy luxury living room",
      "Elegant home facade",
      "Contemporary design house",
      "City property investment",
      "Beautiful estate",
      "Bright open-plan interior",
      "Stylish modern home",
      "Waterfront property",
      "Designer kitchen",
      "Suburban luxury home",
      "Architectural detail",
      "Serene garden home",
    ],
  },
  "real-estate-developer": {
    category: "real-estate-developer",
    hero: [
      PEXELS_URL(186077), PEXELS_URL(1643383), PEXELS_URL(259600), PEXELS_URL(2724749),
      PEXELS_URL(1029599), PEXELS_URL(830891), PEXELS_URL(373912), PEXELS_URL(323705),
      PEXELS_URL(2219024), PEXELS_URL(273683), PEXELS_URL(269077), PEXELS_URL(302769),
      PEXELS_URL(316530), PEXELS_URL(534220), PEXELS_URL(439857), PEXELS_URL(2205832),
      PEXELS_URL(3027694), PEXELS_URL(1230483), PEXELS_URL(325185), PEXELS_URL(1080721),
    ],
    alt: [
      "Modern building exterior",
      "Architectural development",
      "City property investment",
      "Contemporary construction",
      "High-rise development",
      "Urban skyline",
      "Modern architecture",
      "Commercial towers",
      "Luxury condo complex",
      "New housing development",
      "Glass facade building",
      "Cityscape at dusk",
      "Premium real estate project",
      "Architectural render",
      "Future city development",
      "Skyline towers",
      "Modern office building",
      "Urban renewal project",
      "Residential complex",
      "Metropolitan development",
    ],
  },
  "boutique-hospitality": {
    category: "boutique-hospitality",
    hero: [
      PEXELS_URL(1396122), PEXELS_URL(261102), PEXELS_URL(271624), PEXELS_URL(338504),
      PEXELS_URL(164595), PEXELS_URL(258154), PEXELS_URL(271618), PEXELS_URL(189296),
      PEXELS_URL(262048), PEXELS_URL(258154), PEXELS_URL(158388), PEXELS_URL(271743),
      PEXELS_URL(260922), PEXELS_URL(265947), PEXELS_URL(210258), PEXELS_URL(106399),
      PEXELS_URL(189333), PEXELS_URL(248769), PEXELS_URL(266456), PEXELS_URL(271639),
    ],
    alt: [
      "Boutique hotel with warm lighting",
      "Designer hotel suite",
      "Elegant hospitality interior",
      "Stylish guest room",
      "Luxury resort pool",
      "Charming boutique stay",
      "Cozy lodge in nature",
      "Inviting hotel lounge",
      "Gourmet dining setting",
      "Beautiful courtyard",
      "Boutique escape",
      "Private villa",
      "Sunlit terrace",
      "Elegant bedroom",
      "Grand hotel entrance",
      "Modern interior design",
      "Warm hospitality",
      "Serene resort view",
      "Panoramic suite view",
      "Spa-style bathroom",
    ],
  },
  "guesthouse-lodge": {
    category: "guesthouse-lodge",
    hero: [
      PEXELS_URL(271618), PEXELS_URL(210617), PEXELS_URL(1032650), PEXELS_URL(1549294),
      PEXELS_URL(164595), PEXELS_URL(1591373), PEXELS_URL(271639), PEXELS_URL(258154),
      PEXELS_URL(189296), PEXELS_URL(266456), PEXELS_URL(271743), PEXELS_URL(248769),
      PEXELS_URL(158388), PEXELS_URL(189333), PEXELS_URL(210258), PEXELS_URL(265947),
      PEXELS_URL(3408744), PEXELS_URL(1365425), PEXELS_URL(3155666), PEXELS_URL(3355788),
    ],
    alt: [
      "Cozy lodge in nature",
      "Mountain retreat",
      "Rustic cabin escape",
      "Scenic countryside stay",
      "Forest hideaway",
      "Cabin in the mountains",
      "Serene nature retreat",
      "Warm wooden lodge",
      "Inviting fireplace",
      "Panoramic mountain view",
      "Private cabin",
      "Beautiful wilderness stay",
      "Boutique nature escape",
      "Hearth and comfort",
      "Grand lodge entrance",
      "Elegant bedroom",
      "Morning mist mountains",
      "Lakeside retreat",
      "Alpine scenery",
      "Quiet forest path",
    ],
  },
};

export function photosForCategory(category: string): string[] {
  return CATEGORY_PHOTOS[category]?.hero ?? CATEGORY_PHOTOS["boutique-hospitality"].hero;
}

/** Deterministically pick a unique subset for a business (seed by name). */
export function photosForBusiness(category: string, seed: number, count = 5): string[] {
  const pool = CATEGORY_PHOTOS[category]?.hero ?? CATEGORY_PHOTOS["boutique-hospitality"].hero;
  const start = seed % pool.length;
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    out.push(pool[(start + i * 3) % pool.length]);
  }
  return out;
}

export const CATEGORY_VIDEOS: Record<string, string[]> = {
  medspa: [
    "https://videos.pexels.com/video-files/3571264/3571264-hd_1920_1080_30fps.mp4",
  ],
  "real-estate-agent": [
    "https://videos.pexels.com/video-files/1093662/1093662-hd_1920_1080_30fps.mp4",
  ],
  "real-estate-developer": [
    "https://videos.pexels.com/video-files/1093662/1093662-hd_1920_1080_30fps.mp4",
  ],
  "boutique-hospitality": [
    "https://videos.pexels.com/video-files/856995/856995-hd_1920_1080_30fps.mp4",
  ],
  "guesthouse-lodge": [
    "https://videos.pexels.com/video-files/3130284/3130284-hd_1920_1080_30fps.mp4",
  ],
};

export function videosForCategory(category: string): string[] {
  return CATEGORY_VIDEOS[category] ?? CATEGORY_VIDEOS["boutique-hospitality"];
}
