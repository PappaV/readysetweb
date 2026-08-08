export interface PlacesConfig {
  apiKey: string;
  baseUrl?: string;
}

export interface PlaceSearchParams {
  textQuery: string;
  includedType?: string;
  maxResults?: number;
  languageCode?: string;
  locationBias?: { lat: number; lng: number; radiusMeters?: number };
}

export interface PlaceDiscovery {
  id: string;
  name: string;
  displayName: string;
  phone?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  formattedAddress?: string;
  location?: { lat: number; lng: number };
  businessStatus?: string;
  types: string[];
  openingHoursText?: string[];
  reviews?: PlaceReview[];
  photos?: { name: string; height: number; width: number }[];
  googleMapsUrl?: string;
}

export interface PlaceReview {
  author: string;
  rating: number;
  text?: string;
  relativeTime?: string;
}

export interface PlaceDetails {
  id: string;
  displayName: string;
  phone?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  formattedAddress?: string;
  location?: { lat: number; lng: number };
  businessStatus?: string;
  types: string[];
  openingHoursText?: string[];
  reviews?: PlaceReview[];
  photos?: { name: string; height: number; width: number }[];
  googleMapsUrl?: string;
}

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.nationalPhoneNumber",
  "places.websiteUri",
  "places.rating",
  "places.userRatingCount",
  "places.formattedAddress",
  "places.location",
  "places.businessStatus",
  "places.types",
  "places.regularOpeningHours.weekdayDescriptions",
  "places.reviews",
  "places.photos",
  "places.googleMapsUri",
  "places.addressComponents",
].join(",");

const DETAILS_FIELD_MASK = [
  "id",
  "displayName",
  "nationalPhoneNumber",
  "websiteUri",
  "rating",
  "userRatingCount",
  "formattedAddress",
  "location",
  "businessStatus",
  "types",
  "regularOpeningHours.weekdayDescriptions",
  "reviews",
  "photos",
  "googleMapsUri",
  "addressComponents",
].join(",");

export class PlacesClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(config: PlacesConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl ?? "https://places.googleapis.com/v1").replace(/\/$/, "");
  }

  async searchPlaces(params: PlaceSearchParams): Promise<PlaceDiscovery[]> {
    const body: Record<string, unknown> = {
      textQuery: params.textQuery,
      ...(params.includedType ? { includedType: params.includedType } : {}),
      ...(params.languageCode ? { languageCode: params.languageCode } : {}),
      ...(params.locationBias
        ? {
            locationBias: {
              circle: {
                center: { latitude: params.locationBias.lat, longitude: params.locationBias.lng },
                radius: params.locationBias.radiusMeters ?? 20000,
              },
            },
          }
        : {}),
    };

    const res = await fetch(`${this.baseUrl}/places:searchText`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": this.apiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      throw new Error(`Places API searchText failed (${res.status}): ${err}`);
    }

    const data = (await res.json()) as {
      places?: Array<Record<string, unknown>>;
    };

    return (data.places ?? []).map((p) => normalizePlace(p));
  }

  async getPlaceDetails(placeId: string): Promise<PlaceDetails> {
    const res = await fetch(`${this.baseUrl}/places/${placeId}`, {
      method: "GET",
      headers: {
        "X-Goog-Api-Key": this.apiKey,
        "X-Goog-FieldMask": DETAILS_FIELD_MASK,
      },
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      throw new Error(`Places API getPlace failed (${res.status}): ${err}`);
    }

    const data = (await res.json()) as Record<string, unknown>;
    return normalizePlace(data) as PlaceDetails;
  }

  async findBusinessesWithoutWebsite(params: PlaceSearchParams): Promise<PlaceDiscovery[]> {
    const results = await this.searchPlaces(params);
    const withoutWebsite = results.filter((r) => !r.websiteUri && r.businessStatus !== "CLOSED_PERMANENTLY");
    return withoutWebsite;
  }

  /**
   * Convert photo references (from search/place details) into direct image URLs.
   * These URLs embed the API key and can be used directly as <img> src.
   */
  photoUrl(photo: { name: string }, opts: { maxWidthPx?: number; maxHeightPx?: number } = {}): string {
    const { maxWidthPx = 1600, maxHeightPx = 1600 } = opts;
    const name = photo.name.startsWith("places/") ? photo.name : `places/${photo.name}`;
    const qs = new URLSearchParams({ maxWidthPx: String(maxWidthPx), maxHeightPx: String(maxHeightPx), key: this.apiKey });
    return `${this.baseUrl}/${name}/media?${qs.toString()}`;
  }

  photoUrls(photos: { name: string }[] | undefined, opts?: { maxWidthPx?: number; maxHeightPx?: number }): string[] {
    return (photos ?? []).filter((p) => p && p.name).map((p) => this.photoUrl(p, opts));
  }
}

function normalizePlace(p: Record<string, unknown>): PlaceDiscovery {
  const displayName = p.displayName as { text?: string } | undefined;
  const location = p.location as { latitude?: number; longitude?: number } | undefined;
  const reviews = p.reviews as Array<{
    authorAttribution?: { displayName?: string };
    rating?: number;
    text?: { text?: string };
    relativePublishTimeDescription?: string;
  }> | undefined;
  const photos = p.photos as Array<{ name?: string; heightPx?: number; widthPx?: number }> | undefined;
  const hours = p.regularOpeningHours as { weekdayDescriptions?: string[] } | undefined;

  return {
    id: String(p.id ?? ""),
    name: displayName?.text ?? String(p.id ?? ""),
    displayName: displayName?.text ?? String(p.id ?? ""),
    phone: (p.nationalPhoneNumber as string) ?? undefined,
    websiteUri: (p.websiteUri as string) ?? undefined,
    rating: p.rating as number | undefined,
    userRatingCount: p.userRatingCount as number | undefined,
    formattedAddress: (p.formattedAddress as string) ?? undefined,
    location: location && location.latitude !== undefined
      ? { lat: location.latitude, lng: location.longitude ?? 0 }
      : undefined,
    businessStatus: p.businessStatus as string | undefined,
    types: (p.types as string[]) ?? [],
    openingHoursText: hours?.weekdayDescriptions,
    reviews: reviews?.map((r) => ({
      author: r.authorAttribution?.displayName ?? "Anonymous",
      rating: r.rating ?? 0,
      text: r.text?.text,
      relativeTime: r.relativePublishTimeDescription,
    })),
    photos: photos?.map((ph) => ({
      name: ph.name ?? "",
      height: ph.heightPx ?? 0,
      width: ph.widthPx ?? 0,
    })),
    googleMapsUrl: (p.googleMapsUri as string) ?? undefined,
  };
}
