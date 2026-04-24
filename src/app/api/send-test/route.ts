import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  const { to, html, subject } = await req.json()

  if (!to || !html) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
  }

  const domain = process.env.MAILGUN_DOMAIN
  const apiKey = process.env.MAILGUN_API_KEY

  if (!domain || !apiKey) {
    return NextResponse.json({ error: "Mailgun not configured" }, { status: 500 })
  }

  const form = new FormData()
  form.append("from", `MailCraft Test <mailcraft@${domain}>`)
  form.append("to", to)
  form.append("subject", subject || "Email Preview Test")
  form.append("html", html)

  const res = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString("base64")}`,
    },
    body: form,
  })

  if (!res.ok) {
    const text = await res.text()
    return NextResponse.json({ error: text }, { status: res.status })
  }

  return NextResponse.json({ ok: true })
}
