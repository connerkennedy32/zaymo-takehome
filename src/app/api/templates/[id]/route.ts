import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const template = await prisma.template.findUnique({ where: { id } })
  if (!template) return new Response("Not found", { status: 404 })
  return NextResponse.json(template)
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { name, html, messages, subject, previewText } = await req.json()
  if (!html || typeof html !== "string") {
    return new Response("Missing html", { status: 400 })
  }
  const template = await prisma.template.update({
    where: { id },
    data: { ...(name && { name }), html, messages: messages ?? [], subject: subject ?? null, previewText: previewText ?? null },
  })
  return NextResponse.json(template)
}
