import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { searchN } from "./marketcheck";
import type { ChatMessage, Listing } from "./types";

const client = new Anthropic();
const MODEL = "claude-sonnet-4-6";

const HARD_RULES_TEXT = `Hard rules — already enforced by the search backend, but never recommend cars that would violate them:
- UK only, FCA-authorised dealers
- Year 2018 or newer
- Under 70,000 miles
- No write-offs (Cat A/B/S/N excluded)`;

const SEARCH_CARS_TOOL: Anthropic.Tool = {
  name: "search_cars",
  description:
    "Search the live UK used-car inventory and return up to N matching listings (default 3, max 5). Returns the top listings plus the total number of cars meeting the criteria. Call this any time the user describes a car, refines a search, or you want to suggest something. Pass narrow filters when you can — broad searches return random cars. Pass count=1 if the user is laser-focused on one specific car. Pass count=3 (default) for normal browsing. Pass count=5 if the user explicitly says 'show me more' or 'show me options'.",
  input_schema: {
    type: "object",
    properties: {
      make: {
        type: "string",
        description: "Manufacturer, e.g. 'Skoda', 'BMW', 'Ford'.",
      },
      model: {
        type: "string",
        description: "Model name, e.g. 'Octavia', 'A3', 'Fiesta'.",
      },
      bodyType: {
        type: "string",
        enum: [
          "SUV",
          "Hatchback",
          "Estate",
          "Saloon",
          "Coupe",
          "Convertible",
          "MPV",
          "Pickup",
        ],
      },
      fuelType: {
        type: "string",
        enum: [
          "Petrol",
          "Diesel",
          "Electric",
          "Petrol Electric Hybrid",
          "Diesel Electric Hybrid",
          "Petrol Plug-in Hybrid",
        ],
      },
      transmission: {
        type: "string",
        enum: ["Manual", "Automatic"],
      },
      exteriorColor: {
        type: "string",
        description:
          "Lowercase common colour name: 'red', 'pink', 'blue', 'green', 'white', 'black', 'silver', 'grey', 'yellow', 'orange'.",
      },
      priceMin: { type: "number" },
      priceMax: { type: "number" },
      milesMax: {
        type: "number",
        description: "Max odometer in miles. Hard cap is 70,000.",
      },
      yearMin: {
        type: "number",
        description: "Earliest registration year. Hard floor is 2018.",
      },
      insuranceGroupMax: {
        type: "number",
        description:
          "Highest acceptable UK insurance group, 1-50 (1 = cheapest insurance, 50 = most expensive). Use 10-15 for 'low insurance', 20-25 for 'reasonable insurance', 30+ for 'don't care'.",
      },
      seatsMin: {
        type: "number",
        description: "Minimum seats — use 7 for 'big family', 5 for default.",
      },
      sortBy: {
        type: "string",
        enum: ["best_match", "price", "miles", "year", "distance"],
        description: "Default 'best_match'. Use 'price'+'asc' for cheapest first, 'year'+'desc' for newest first, 'distance'+'asc' for closest first.",
      },
      sortOrder: { type: "string", enum: ["asc", "desc"] },
      radiusMiles: {
        type: "number",
        description:
          "Distance in miles from the user's postcode. Only set this if the user has indicated a distance preference. Omit (or set high, e.g. 300) to search nationwide.",
      },
      count: {
        type: "number",
        description:
          "How many listings to return (1-5, default 3). Use 1 for a focused first-impression pick. Use 3 for typical browsing. Use 5 only when the user says 'show me more' or 'show me options'.",
      },
    },
  },
};

const SYSTEM_PROMPT = `You are Naya, Ayan's car-finding assistant. You're warm, conversational, a touch playful, and you know UK cars well. Talk like a friend at a dealership who genuinely wants to help — not a robot, not a salesperson. Use the name "Naya" naturally if you need to refer to yourself; never say "as an AI".

${HARD_RULES_TEXT}

CONVERSATIONAL FLOW — IMPORTANT:
On your VERY FIRST reply in a conversation, briefly acknowledge the brief with a touch of warmth before asking the first follow-up — something like "Nice — let's get you sorted." or "Family car with low insurance, good shout." Don't introduce yourself by name on every reply, only the first if it fits naturally.

Before showing a car on the first request, ask 2-3 quick follow-up questions (one per turn — never bundle questions into a single message). Pick the questions whose answers will most shape the shortlist for THIS brief, in roughly this order, skipping any already implied by the brief:

  a. Distance — "How far are you happy to travel to collect it? Anywhere in the UK, or somewhere closer like 30 miles from you?"
  b. Brand openness — "Any makes you really want, or any you'd rather avoid?"
  c. Transmission — "Manual or automatic, or no preference?"
  d. Driving shape — "Mostly motorway miles, or short trips around town?" (only if it would change the fuel/engine pick)
  e. Insurance sensitivity — "Is keeping insurance cheap a priority?" (only if not already stated)
  f. Seats / size — only if relevant from brief

After 2-3 follow-ups (do not drag it out — feel the room), commit. Briefly reflect back what you heard ("Got it — within 30 miles, no Vauxhall, automatic.") and call search_cars. Then present the result.

If the user says "just show me", "skip", "show me a car", "stop asking" — stop the questions and search immediately.

After the first car is shown:
- Refinements ("cheaper", "newer", "different make", "low insurance", "automatic", "in red") → call search_cars again, carrying forward earlier filters unless contradicted.
- "Tell me more", feature questions, "is it a good buy" → answer with text, no new search.
- A wholly new brief → start fresh.

UI BEHAVIOUR:
- Each reply is a chat bubble. ALL listings returned by your most recent search_cars call are rendered as cards under your text — don't recap every spec, the cards show them.
- You can return up to 5 listings per search via the count parameter. Default is 3 — use it for normal browsing. Use count=1 for a focused first impression (e.g. the very first car you show, or when the user is laser-locked on one spec). Use count=5 only when the user explicitly asks for "more options" or "show me a few".
- When showing multiple cards, write copy that treats them as a set ("Here are three solid options — the Skoda's the cheapest, the Audi's the nicest, and the BMW's the sportiest") rather than describing each in detail.
- The user CANNOT see search counts unless you mention them.
- 1-3 sentences max. No bullet points. No headers.

INTERPRETATION HINTS:
- "Low insurance" → insuranceGroupMax around 12-15. "Reasonable insurance" → 20.
- "Local" / "near me" / "close" → radiusMiles 30. "Within X miles" → that number. "Anywhere" → omit radiusMiles.
- "Cheap to run" → low insurance + diesel/hybrid + small engine.

SENSIBLE DEFAULTS (apply silently — do NOT ask):
- If the customer hasn't signalled a budget, cap searches at priceMax £25,000. The realistic used-car ceiling for most customers.
- NEVER pick exotic/supercars (Ferrari, Lamborghini, Bentley, Rolls-Royce, McLaren, Aston Martin, Maserati, Porsche 911/Taycan, Tesla Model S/X) unless the brief explicitly names that brand/segment. Even if a Ferrari technically fits the filters, it's a comically bad pick for an everyday brief — don't be cute. Stick to mainstream UK used cars.
- If the customer signals "prestige" or "premium" without naming a brand, pick from BMW (1/2/3 Series, X1/X3), Audi (A1/A3/A4, Q3), Mercedes (A-Class, C-Class, GLA) — not supercars.
- Never volunteer a budget question. If the picked car is at the top of the default range, mention it gracefully ("this is around the top end at £24k — happy to find something cheaper").

TONE:
- Warm, brisk, UK English. No marketing fluff. Family-friendly.
- Use emojis sparingly — one or two per reply max, and only when they actually add something. A 🚗 when introducing a car, ✨ for a prestige pick, 🛡️ for low-insurance / safe, 💨 for sporty, 👍 to acknowledge, 🎯 when you've nailed the brief. Don't pepper. Don't use the same emoji every reply. Skip them entirely if the moment is serious.

HARD REFUSALS:
- Profanity, sexual/suggestive language, slurs, hate, threats, illegal activity → one short polite sentence asking them to keep it appropriate. Do NOT search.
- Mild dating context ("to get girls", "impress someone") is FINE.`;

export type ChatResult = {
  text: string;
  listings: Listing[];
  totalCount?: number;
};

function chatToApiMessages(
  messages: ChatMessage[]
): Anthropic.MessageParam[] {
  return messages.map((m) => {
    if (m.role === "user") {
      return { role: "user", content: m.text };
    }
    let content = m.text;
    const listings = m.listings ?? (m.listing ? [m.listing] : []);
    if (listings.length > 0) {
      const summaries = listings
        .map(
          (l, i) =>
            `(${i + 1}) ${l.year} ${l.heading}, £${l.price.toLocaleString()}, ${l.miles.toLocaleString()} mi, ins grp ${l.insuranceGroup ?? "n/a"}, ${l.transmission ?? ""}, ${l.dealer.name}${l.dealer.city ? " — " + l.dealer.city : ""}`
        )
        .join("; ");
      content += `\n\n[Showed the user ${listings.length} listing${listings.length === 1 ? "" : "s"}: ${summaries}.${m.totalCount ? " Total matching: " + m.totalCount + "." : ""}]`;
    }
    return { role: "assistant", content };
  });
}

export async function chat(input: {
  messages: ChatMessage[];
  postcode?: string;
}): Promise<ChatResult> {
  const apiMessages = chatToApiMessages(input.messages);
  let lastListings: Listing[] = [];
  let lastTotalCount: number | undefined;

  let response = await client.messages.create({
    model: MODEL,
    max_tokens: 600,
    system: [
      {
        type: "text" as const,
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" as const },
      },
    ],
    tools: [SEARCH_CARS_TOOL],
    messages: apiMessages,
  });

  let safety = 0;
  while (response.stop_reason === "tool_use" && safety < 4) {
    safety += 1;
    const toolUses = response.content.filter((c) => c.type === "tool_use");
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const tu of toolUses) {
      if (tu.type !== "tool_use") continue;
      if (tu.name !== "search_cars") continue;
      try {
        const filters = tu.input as Record<string, unknown>;
        const requestedCount = Math.max(
          1,
          Math.min(5, Math.round((filters.count as number | undefined) ?? 3))
        );
        const result = await searchN(
          {
            make: filters.make as string | undefined,
            model: filters.model as string | undefined,
            bodyType: filters.bodyType as string | undefined,
            fuelType: filters.fuelType as string | undefined,
            transmission: filters.transmission as
              | "Manual"
              | "Automatic"
              | undefined,
            exteriorColor: filters.exteriorColor as string | undefined,
            priceMin: filters.priceMin as number | undefined,
            priceMax: filters.priceMax as number | undefined,
            milesMax: filters.milesMax as number | undefined,
            yearMin: filters.yearMin as number | undefined,
            insuranceGroupMax: filters.insuranceGroupMax as number | undefined,
            seatsMin: filters.seatsMin as number | undefined,
            sortBy: filters.sortBy as
              | "best_match"
              | "price"
              | "miles"
              | "year"
              | "distance"
              | undefined,
            sortOrder: filters.sortOrder as "asc" | "desc" | undefined,
            postcode: input.postcode,
            radiusMiles:
              (filters.radiusMiles as number | undefined) ??
              (input.postcode ? 300 : undefined),
          },
          requestedCount
        );
        if (result.listings.length > 0) {
          lastListings = result.listings;
          lastTotalCount = result.totalCount;
        }
        const summary = {
          totalCount: result.totalCount,
          returned: result.listings.length,
          listings: result.listings.map((l) => ({
            heading: l.heading,
            year: l.year,
            price: l.price,
            miles: l.miles,
            insuranceGroup: l.insuranceGroup,
            transmission: l.transmission,
            fuel: l.fuel,
            colour: l.colour,
            trim: l.trim,
            ownerCount: l.ownerCount,
            dealer: `${l.dealer.name}${l.dealer.city ? ", " + l.dealer.city : ""}`,
          })),
        };
        toolResults.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: JSON.stringify(summary),
        });
      } catch (e) {
        toolResults.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: `Error: ${e instanceof Error ? e.message : "unknown"}`,
          is_error: true,
        });
      }
    }

    apiMessages.push({ role: "assistant", content: response.content });
    apiMessages.push({ role: "user", content: toolResults });

    response = await client.messages.create({
      model: MODEL,
      max_tokens: 600,
      system: [
        {
          type: "text" as const,
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" as const },
        },
      ],
      tools: [SEARCH_CARS_TOOL],
      messages: apiMessages,
    });
  }

  const text = response.content
    .filter((c) => c.type === "text")
    .map((c) => (c.type === "text" ? c.text : ""))
    .join("")
    .trim();

  return {
    text,
    listings: lastListings,
    totalCount: lastTotalCount,
  };
}
