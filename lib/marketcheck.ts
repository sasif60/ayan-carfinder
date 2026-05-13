import "server-only";
import type { Listing } from "./types";

const BASE_URL = "https://api.marketcheck.com/v2/search/car/uk/active";

const HARD_FILTERS = {
  fca_status: "Authorised",
  year_range: "2018-",
  miles_range: "0-70000",
  exclude_write_off_category: "Category A,Category B,Category S,Category N",
  country: "uk",
} as const;

export type SearchInput = {
  make?: string;
  model?: string;
  bodyType?: string;
  fuelType?: string;
  transmission?: "Manual" | "Automatic";
  exteriorColor?: string;
  postcode?: string;
  radiusMiles?: number;
  priceMin?: number;
  priceMax?: number;
  milesMax?: number;
  yearMin?: number;
  insuranceGroupMax?: number;
  seatsMin?: number;
  start?: number;
  rows?: number;
  sortBy?: "price" | "miles" | "year" | "distance" | "best_match";
  sortOrder?: "asc" | "desc";
};

function titleCaseColour(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function expandInsuranceGroups(maxGroup: number): string {
  const out: string[] = [];
  const max = Math.min(50, Math.max(1, Math.round(maxGroup)));
  for (let n = 1; n <= max; n++) {
    out.push(String(n));
    for (const letter of ["A", "B", "C", "D", "E"]) {
      out.push(`${n}${letter}`);
    }
  }
  return out.join(",");
}

function buildParams(input: SearchInput): URLSearchParams {
  const apiKey = process.env.MARKETCHECK_API_KEY;
  if (!apiKey) throw new Error("MARKETCHECK_API_KEY is not set");

  const params = new URLSearchParams({
    api_key: apiKey,
    ...HARD_FILTERS,
  });

  if (input.make) params.set("make", input.make);
  if (input.model) params.set("model", input.model);
  if (input.bodyType) params.set("body_type", input.bodyType);
  if (input.fuelType) params.set("fuel_type", input.fuelType);
  if (input.transmission) params.set("transmission", input.transmission);
  if (input.exteriorColor)
    params.set("exterior_color", titleCaseColour(input.exteriorColor));
  if (input.postcode) params.set("postal_code", input.postcode);
  if (input.radiusMiles) params.set("radius", String(input.radiusMiles));

  if (input.priceMin !== undefined || input.priceMax !== undefined) {
    const lo = input.priceMin ?? 0;
    const hi = input.priceMax ?? 100000;
    params.set("price_range", `${lo}-${hi}`);
  }
  if (input.milesMax !== undefined) {
    params.set("miles_range", `0-${Math.min(input.milesMax, 70000)}`);
  }
  if (input.yearMin !== undefined && input.yearMin > 2018) {
    params.set("year_range", `${input.yearMin}-`);
  }
  if (input.insuranceGroupMax !== undefined) {
    params.set("insurance_group", expandInsuranceGroups(input.insuranceGroupMax));
  }
  if (input.seatsMin !== undefined) {
    params.set("seating_capacity_range", `${input.seatsMin}-`);
  }

  if (input.start !== undefined) params.set("start", String(input.start));
  if (input.rows !== undefined) params.set("rows", String(input.rows));
  if (input.sortBy) params.set("sort_by", input.sortBy);
  if (input.sortOrder) params.set("sort_order", input.sortOrder);

  return params;
}

type RawSearchResponse = {
  num_found?: number;
  listings?: RawListing[];
};

type RawListing = {
  id?: string;
  vin?: string;
  vrm?: string;
  vehicle_registration_mark?: string;
  heading?: string;
  price?: number | string;
  miles?: number | string;
  exterior_color?: string;
  base_ext_color?: string;
  num_owners?: number;
  owner_count?: number;
  insurance_group?: string;
  media?: { photo_links?: string[]; photo_links_cached?: string[] };
  build?: {
    year?: number;
    make?: string;
    model?: string;
    trim?: string;
    body_type?: string;
    fuel_type?: string;
    transmission?: string;
    doors?: number;
    seating_capacity?: number;
    exterior_color?: string;
  };
  dealer?: {
    id?: number | string;
    name?: string;
    city?: string;
    postal_code?: string;
    fca_status?: string;
    dealer_type?: string;
  };
};

function normalize(raw: RawListing): Listing {
  const build = raw.build ?? {};
  const dealer = raw.dealer ?? {};
  const photos =
    raw.media?.photo_links ?? raw.media?.photo_links_cached ?? [];
  return {
    id: String(raw.id ?? raw.vin ?? raw.vrm ?? Math.random()),
    vin: raw.vin,
    vrm: raw.vrm ?? raw.vehicle_registration_mark,
    heading:
      raw.heading ??
      [build.year, build.make, build.model, build.trim].filter(Boolean).join(" "),
    year: Number(build.year ?? 0),
    miles: Number(raw.miles ?? 0),
    fuel: build.fuel_type ?? "",
    transmission: build.transmission,
    trim: build.trim,
    colour: raw.exterior_color ?? raw.base_ext_color ?? build.exterior_color,
    doors: build.doors,
    seats: build.seating_capacity,
    ownerCount: raw.num_owners ?? raw.owner_count,
    insuranceGroup: raw.insurance_group,
    price: Number(raw.price ?? 0),
    photos,
    dealer: {
      id: dealer.id !== undefined ? String(dealer.id) : undefined,
      name: dealer.name ?? "Dealer",
      city: dealer.city,
      postcode: dealer.postal_code,
      fcaStatus: dealer.fca_status ?? "Authorised",
      type: dealer.dealer_type,
    },
    raw,
  };
}

async function fetchSearch(
  input: SearchInput
): Promise<{ count: number; listings: Listing[] }> {
  const url = `${BASE_URL}?${buildParams(input).toString()}`;
  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Marketcheck ${res.status}: ${text.slice(0, 200)}`);
  }
  const data: RawSearchResponse = await res.json();
  return {
    count: data.num_found ?? 0,
    listings: (data.listings ?? []).map(normalize),
  };
}

export async function searchListings(input: SearchInput) {
  return fetchSearch({ rows: 20, ...input });
}

export async function searchOne(input: SearchInput): Promise<{
  listing: Listing | null;
  totalCount: number;
}> {
  const { count, listings } = await fetchSearch({
    ...input,
    rows: 1,
    sortBy: input.sortBy ?? "best_match",
  });
  return { listing: listings[0] ?? null, totalCount: count };
}

export async function searchN(
  input: SearchInput,
  n: number
): Promise<{ listings: Listing[]; totalCount: number }> {
  const rows = Math.max(1, Math.min(5, Math.round(n)));
  const { count, listings } = await fetchSearch({
    ...input,
    rows,
    sortBy: input.sortBy ?? "best_match",
  });
  return { listings: listings.slice(0, rows), totalCount: count };
}
