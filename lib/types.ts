export type Listing = {
  id: string;
  vin?: string;
  vrm?: string;
  heading: string;
  year: number;
  miles: number;
  fuel: string;
  transmission?: string;
  trim?: string;
  colour?: string;
  doors?: number;
  seats?: number;
  ownerCount?: number;
  insuranceGroup?: string;
  price: number;
  photos: string[];
  dealer: {
    id?: string;
    name: string;
    city?: string;
    postcode?: string;
    fcaStatus?: string;
    type?: string;
  };
  raw?: unknown;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  listings?: Listing[];
  totalCount?: number;
  /** @deprecated kept for back-compat with older session-storage messages */
  listing?: Listing;
};
