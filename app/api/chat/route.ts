import { NextResponse } from "next/server";
import { chat } from "@/lib/claude";
import type { ChatMessage } from "@/lib/types";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const messages: ChatMessage[] = Array.isArray(body?.messages)
      ? body.messages
      : [];
    const postcode: string | undefined = body?.postcode;
    const monthly: number | undefined =
      typeof body?.monthly === "number" ? body.monthly : undefined;
    const apr: number | undefined =
      typeof body?.apr === "number" ? body.apr : undefined;
    const maxPrice: number | undefined =
      typeof body?.maxPrice === "number" ? body.maxPrice : undefined;

    if (messages.length === 0) {
      return NextResponse.json({ error: "messages required" }, { status: 400 });
    }

    const result = await chat({ messages, postcode, monthly, apr, maxPrice });
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
