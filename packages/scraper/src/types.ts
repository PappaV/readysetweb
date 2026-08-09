export interface DiscoveryTarget {
  category: string;
  location: string;
  categoryKeywords: string[];
}

export interface DiscoveredBusiness {
  name: string;
  category: string;
  phone?: string;
  address?: string;
  website?: string;
  socialProfiles: { platform: string; url: string; handle?: string }[];
  source: string;
  rating?: number;
  reviewCount?: number;
}

export interface WebsitePresenceCheck {
  name: string;
  hasWebsite: boolean;
  websiteUrl?: string;
  confidence: number;
}

export interface ScraperConfig {
  headless?: boolean;
  timeoutMs?: number;
  maxResultsPerQuery?: number;
  userAgent?: string;
  viewport?: { width: number; height: number };
  logLevel?: "debug" | "info" | "warn" | "error";
}

export interface SocialScrapeResult {
  bio?: string;
  description?: string;
  followerCount?: number;
  postCount?: number;
  recentPosts: { text: string; url: string; postedAt?: string }[];
  reviews?: { author: string; rating: number; text: string; platform: string }[];
  hours?: string;
  phone?: string;
  email?: string;
  address?: string;
  rawText: string;
  images: string[];
  /** Real video URLs (reels/videos) from the profile, if available. */
  videos?: string[];
  profileUrl: string;
}
