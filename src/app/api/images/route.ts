import { prisma } from "@/lib/prisma"

export async function GET() {
  const images = await prisma.image.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, url: true, filename: true, contentType: true, size: true, createdAt: true },
  })

  return Response.json(images)
}
