import { openai, buildMessages, ImageAttachment } from "@/lib/openai";
import { NextRequest } from "next/server";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  const {
    prompt,
    currentHtml,
    mode,
    images,
    brand,
    brandColors,
    styleContext,
  } = await req.json();

  if (!prompt || typeof prompt !== "string") {
    return new Response("Missing prompt", { status: 400 });
  }

  const stream = await openai.chat.completions.create({
    model: "gpt-5.4-mini",
    messages: buildMessages(
      prompt,
      currentHtml ?? null,
      mode ?? "generate",
      images ?? [],
      brand,
      brandColors,
      styleContext ?? null,
    ),
    stream: true,
    temperature: 0.7,
    max_completion_tokens: 4096,
  });

  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content ?? "";
        if (text) controller.enqueue(encoder.encode(text));
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
