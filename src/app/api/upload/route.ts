import { r2, R2_BUCKET, r2PublicUrl } from "@/lib/r2"
import { prisma } from "@/lib/prisma"
import { PutObjectCommand } from "@aws-sdk/client-s3"
import { NextRequest } from "next/server"

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"]
const MAX_SIZE = 10 * 1024 * 1024 // 10MB

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get("file") as File | null

  if (!file) return new Response("No file provided", { status: 400 })
  if (!ALLOWED_TYPES.includes(file.type)) return new Response("Unsupported image type", { status: 400 })
  if (file.size > MAX_SIZE) return new Response("File too large (max 10MB)", { status: 400 })

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  const ext = file.name.split(".").pop() ?? "bin"
  const key = `uploads/${crypto.randomUUID()}.${ext}`

  await r2.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: file.type,
    })
  )

  const url = r2PublicUrl(key)

  const image = await prisma.image.create({
    data: {
      key,
      url,
      filename: file.name,
      contentType: file.type,
      size: file.size,
    },
  })

  return Response.json({ url, key, id: image.id })
}
