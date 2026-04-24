import { openai } from "@/lib/openai"
import { NextRequest } from "next/server"

export const runtime = "edge"

export async function POST(req: NextRequest) {
  const { html } = await req.json()
  if (!html || typeof html !== "string") {
    return new Response("Missing html", { status: 400 })
  }

  const textContent = html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 3000)

  const imgCount = (html.match(/<img\b/gi) ?? []).length

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are an email marketing expert. Given email content, generate:
1. subject: A compelling subject line (under 60 chars, no trailing punctuation, capitalize appropriately)
2. previewText: Preview/preheader text (under 90 chars, complements but does not repeat the subject)
3. altTexts: An array of concise alt text strings for each image, in document order (brief, descriptive, no "image of")

Respond with valid JSON only — no markdown, no code fences:
{"subject":"...","previewText":"...","altTexts":["..."]}`,
      },
      {
        role: "user",
        content: `Email text content:\n${textContent}\n\nNumber of images: ${imgCount}`,
      },
    ],
    temperature: 0.7,
    response_format: { type: "json_object" },
  })

  try {
    const result = JSON.parse(completion.choices[0].message.content ?? "{}")
    return Response.json({
      subject: result.subject ?? "",
      previewText: result.previewText ?? "",
      altTexts: Array.isArray(result.altTexts) ? result.altTexts : [],
    })
  } catch {
    return new Response("Failed to parse response", { status: 500 })
  }
}
