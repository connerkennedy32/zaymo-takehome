import { prisma } from "@/lib/prisma"
import { r2, R2_BUCKET } from "@/lib/r2"
import { GetObjectCommand } from "@aws-sdk/client-s3"
import { NextRequest } from "next/server"

export const runtime = "nodejs"

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const image = await prisma.image.findUnique({ where: { id } })
  if (!image) return new Response("Not found", { status: 404 })

  const obj = await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: image.key }))
  const stream = obj.Body as ReadableStream

  return new Response(stream, {
    headers: {
      "Content-Type": image.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  })
}
