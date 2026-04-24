import { NextRequest } from "next/server"
import { openai } from "@/lib/openai"
import type { BrandContext } from "@/lib/openai"

export const runtime = "nodejs"

type ScrapeResult = {
  brand: BrandContext
  colors: string[]
  brandImages: string[]
}

function normalizeHex(hex: string): string | null {
  const clean = hex.replace("#", "")
  if (clean.length === 3) return "#" + clean.split("").map((c) => c + c).join("")
  if (clean.length === 6) return "#" + clean.toLowerCase()
  return null
}

function rgbToHex(r: number, g: number, b: number): string {
  return (
    "#" +
    [r, g, b]
      .map((v) => Math.min(255, Math.max(0, v)).toString(16).padStart(2, "0"))
      .join("")
  )
}

function isNotNearWhiteOrBlack(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return !(r > 230 && g > 230 && b > 230) && !(r < 30 && g < 30 && b < 30)
}

function isNotNearGray(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  return max - min > 20
}

function extractBrandImages(html: string, baseUrl: string): string[] {
  const base = new URL(baseUrl)
  const seen = new Set<string>()
  const results: string[] = []

  function add(src: string) {
    if (results.length >= 4) return
    try {
      if (src.startsWith("data:")) return
      const absolute = new URL(src, base).toString()
      if (!seen.has(absolute)) {
        seen.add(absolute)
        results.push(absolute)
      }
    } catch { /* ignore */ }
  }

  // og:image is the most reliable brand image
  const ogImage = /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i.exec(html)
                  ?? /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i.exec(html)
  if (ogImage) add(ogImage[1])

  // twitter:image as fallback
  const twitterImage = /<meta[^>]*name=["']twitter:image(?::src)?["'][^>]*content=["']([^"']+)["']/i.exec(html)
                       ?? /<meta[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:image/i.exec(html)
  if (twitterImage) add(twitterImage[1])

  // apple-touch-icon (often the logo)
  const touchIcon = /<link[^>]*rel=["'][^"']*apple-touch-icon[^"']*["'][^>]*href=["']([^"']+)["']/i.exec(html)
  if (touchIcon) add(touchIcon[1])

  // img tags where the tag contains "logo" or "brand" in src/alt/class/id
  if (results.length < 4) {
    const imgRegex = /<img[^>]+>/gi
    let m: RegExpExecArray | null
    while ((m = imgRegex.exec(html)) !== null && results.length < 4) {
      const tag = m[0]
      if (/logo|brand/i.test(tag)) {
        const srcMatch = /\bsrc=["']([^"']+)["']/i.exec(tag)
        if (srcMatch) add(srcMatch[1])
      }
    }
  }

  return results
}

function extractColors(html: string): string[] {
  const colorCounts = new Map<string, number>()

  const cssChunks: string[] = []
  const styleTagRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi
  let m: RegExpExecArray | null
  while ((m = styleTagRegex.exec(html)) !== null) cssChunks.push(m[1])

  const inlineStyleRegex = /style="([^"]*)"/gi
  while ((m = inlineStyleRegex.exec(html)) !== null) cssChunks.push(m[1])

  const css = cssChunks.join(" ")

  const hexRegex = /#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g
  while ((m = hexRegex.exec(css)) !== null) {
    const normalized = normalizeHex(m[0])
    if (normalized) colorCounts.set(normalized, (colorCounts.get(normalized) ?? 0) + 1)
  }

  const rgbRegex = /rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)/g
  while ((m = rgbRegex.exec(css)) !== null) {
    const hex = rgbToHex(parseInt(m[1]), parseInt(m[2]), parseInt(m[3]))
    colorCounts.set(hex, (colorCounts.get(hex) ?? 0) + 1)
  }

  return Array.from(colorCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([color]) => color)
    .filter(isNotNearWhiteOrBlack)
    .filter(isNotNearGray)
    .slice(0, 8)
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/gi, " ").replace(/\s+/g, " ").trim()
}

function extractTextContent(html: string): string {
  const noScript = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")

  const get = (regex: RegExp) => regex.exec(noScript)?.[1] ?? ""

  const title = stripTags(get(/<title[^>]*>([\s\S]*?)<\/title>/i))
  const metaDesc = get(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)
  const ogDesc = get(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i)
  const siteName = get(/<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i)

  const headings: string[] = []
  let m: RegExpExecArray | null
  for (const tag of ["h1", "h2", "h3"]) {
    const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi")
    while ((m = re.exec(noScript)) !== null) {
      const text = stripTags(m[1])
      if (text.length > 2 && text.length < 200) headings.push(text)
      if (headings.length >= 25) break
    }
  }

  const navTexts: string[] = []
  const navRe = /<nav[^>]*>([\s\S]*?)<\/nav>/gi
  while ((m = navRe.exec(noScript)) !== null) {
    navTexts.push(stripTags(m[1]).replace(/\s+/g, " ").slice(0, 300))
    if (navTexts.length >= 2) break
  }

  // Pre-extract contact signals via regex so the AI has explicit candidates
  const emails = [...new Set(Array.from(noScript.matchAll(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g)).map((x) => x[0]))].slice(0, 5)
  const phones = [...new Set(Array.from(noScript.matchAll(/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/g)).map((x) => x[0].trim()))].slice(0, 5)

  // Extract footer text (often contains address/contact)
  const footerTexts: string[] = []
  const footerRe = /<footer[^>]*>([\s\S]*?)<\/footer>/gi
  while ((m = footerRe.exec(noScript)) !== null) {
    footerTexts.push(stripTags(m[1]).replace(/\s+/g, " ").slice(0, 500))
    if (footerTexts.length >= 1) break
  }

  return [
    title && `Title: ${title}`,
    siteName && `Site name: ${siteName}`,
    metaDesc && `Meta description: ${metaDesc}`,
    ogDesc && `OG description: ${ogDesc}`,
    headings.length && `Headings: ${headings.join(" | ")}`,
    navTexts.length && `Navigation: ${navTexts.join(" | ")}`,
    emails.length && `Emails found on page: ${emails.join(", ")}`,
    phones.length && `Phone numbers found on page: ${phones.join(", ")}`,
    footerTexts.length && `Footer text: ${footerTexts.join(" | ")}`,
  ]
    .filter(Boolean)
    .join("\n")
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const url: unknown = body?.url

  if (!url || typeof url !== "string") {
    return new Response("Missing URL", { status: 400 })
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
    if (!["http:", "https:"].includes(parsedUrl.protocol)) throw new Error()
  } catch {
    return new Response("Invalid URL", { status: 400 })
  }

  let html: string
  try {
    const res = await fetch(parsedUrl.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) return new Response(`Page returned ${res.status}`, { status: 422 })
    html = await res.text()
  } catch (err) {
    return new Response(
      `Could not fetch page: ${err instanceof Error ? err.message : "Unknown error"}`,
      { status: 422 }
    )
  }

  const colors = extractColors(html)
  const brandImages = extractBrandImages(html, parsedUrl.toString())
  const textContent = extractTextContent(html)

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "You extract structured brand information from website text. Return valid JSON only — no markdown, no explanation.",
      },
      {
        role: "user",
        content: `Extract brand info from this website content:\n\n${textContent}\n\nReturn JSON matching this exact shape:\n{"name":"string","tagline":"string (the main slogan or value prop, empty string if unclear)","description":"string (1-2 sentences about what the company sells/does)","productTypes":["string (e.g. skincare, running shoes, coffee)"],"tone":"string (e.g. playful, professional, luxury, bold, minimalist)","contact":{"email":"string or empty string","phone":"string or empty string","address":"string or empty string (full mailing address if found)"}}`,
      },
    ],
    temperature: 0.2,
    max_tokens: 512,
    response_format: { type: "json_object" },
  })

  let brand: BrandContext
  try {
    brand = JSON.parse(completion.choices[0].message.content ?? "{}")
  } catch {
    brand = { name: "", tagline: "", description: "", productTypes: [], tone: "", contact: {} }
  }

  return Response.json({ brand, colors, brandImages } satisfies ScrapeResult)
}
