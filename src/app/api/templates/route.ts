import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  const preview = req.nextUrl.searchParams.get("preview") === "true"
  const templates = await prisma.template.findMany({
    select: { id: true, name: true, updatedAt: true, ...(preview ? { html: true, subject: true } : {}) },
    orderBy: { updatedAt: "desc" },
  })
  return NextResponse.json(templates)
}

export async function POST(req: NextRequest) {
  const { name, html, messages, subject, previewText } = await req.json()
  if (!name || typeof name !== "string" || !html || typeof html !== "string") {
    return new Response("Missing required fields", { status: 400 })
  }
  const template = await prisma.template.create({
    data: { name, html, messages: messages ?? [], subject: subject ?? null, previewText: previewText ?? null },
  })
  return NextResponse.json(template, { status: 201 })
}
