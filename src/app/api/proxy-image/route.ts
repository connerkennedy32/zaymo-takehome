import { NextRequest } from "next/server"

export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url")
  if (!url) return new Response("Missing url", { status: 400 })

  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
    if (!["http:", "https:"].includes(parsedUrl.protocol)) throw new Error()
  } catch {
    return new Response("Invalid URL", { status: 400 })
  }

  try {
    const res = await fetch(parsedUrl.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "image/*,*/*",
      },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return new Response(`Image returned ${res.status}`, { status: 422 })

    const contentType = res.headers.get("content-type") ?? "image/jpeg"
    if (!contentType.startsWith("image/")) {
      return new Response("Not an image", { status: 422 })
    }

    const buffer = await res.arrayBuffer()
    return new Response(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
      },
    })
  } catch (err) {
    return new Response(
      `Failed to fetch image: ${err instanceof Error ? err.message : "Unknown error"}`,
      { status: 422 }
    )
  }
}
