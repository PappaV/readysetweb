export interface CategoryPhotos {
  category: string;
  hero: string[];
  alt: string[];
}

export const PEXELS_URL = (id: number, w = 1920) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${w}`;

export const CATEGORY_PHOTOS: Record<string, CategoryPhotos> = {
  medspa: {
    category: "medspa",
    hero: [
      PEXELS_URL(3997993),
      PEXELS_URL(3997371),
      PEXELS_URL(3997396),
      PEXELS_URL(3757953),
    ],
    alt: [
      "Luxury spa treatment room with soft lighting",
      "Relaxing spa ambiance with natural elements",
      "Professional skincare treatment",
      "Serene wellness environment",
    ],
  },
  "real-estate-agent": {
    category: "real-estate-agent",
    hero: [
      PEXELS_URL(186077),
      PEXELS_URL(1643383),
      PEXELS_URL(106399),
      PEXELS_URL(259588),
    ],
    alt: [
      "Luxury home exterior",
      "Modern architectural residence",
      "Beautifully designed interior",
      "Real estate property with pool",
    ],
  },
  "real-estate-developer": {
    category: "real-estate-developer",
    hero: [
      PEXELS_URL(186077),
      PEXELS_URL(1643383),
      PEXELS_URL(259600),
      PEXELS_URL(2724749),
    ],
    alt: [
      "Modern building exterior",
      "Architectural development",
      "City property investment",
      "Contemporary construction",
    ],
  },
  "boutique-hospitality": {
    category: "boutique-hospitality",
    hero: [
      PEXELS_URL(1396122),
      PEXELS_URL(261102),
      PEXELS_URL(271624),
      PEXELS_URL(338504),
    ],
    alt: [
      "Boutique hotel with warm lighting",
      "Designer hotel suite",
      "Elegant hospitality interior",
      "Stylish guest room",
    ],
  },
  "guesthouse-lodge": {
    category: "guesthouse-lodge",
    hero: [
      PEXELS_URL(271618),
      PEXELS_URL(210617),
      PEXELS_URL(1032650),
      PEXELS_URL(1549294),
    ],
    alt: [
      "Cozy lodge in nature",
      "Mountain retreat",
      "Rustic cabin escape",
      "Scenic countryside stay",
    ],
  },
};

export function photosForCategory(category: string): string[] {
  return CATEGORY_PHOTOS[category]?.hero ?? CATEGORY_PHOTOS["boutique-hospitality"].hero;
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
