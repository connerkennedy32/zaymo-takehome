import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { openai } from "@/lib/openai";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { r2, r2PublicUrl } from "@/lib/r2";
import type OpenAI from "openai";

export const runtime = "nodejs";

export async function GET() {
  const styles = await prisma.style.findMany({
    select: {
      id: true,
      name: true,
      description: true,
      images: true,
      stylePrompt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(styles);
}

export async function POST(req: NextRequest) {
  const { name, description, images, brandContext, brandColors } = await req.json();

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  // Upload images to R2 if they don't have URLs yet
  const uploadedImageUrls: string[] = [];
  if (images?.length) {
    for (const img of images as {
      base64: string;
      mimeType: string;
      url?: string;
      name?: string;
    }[]) {
      if (img.url) {
        uploadedImageUrls.push(img.url);
        continue;
      }
      const buffer = Buffer.from(img.base64, "base64");
      const ext =
        img.mimeType === "image/png"
          ? "png"
          : img.mimeType === "image/gif"
            ? "gif"
            : "jpg";
      const key = `uploads/${crypto.randomUUID()}.${ext}`;
      await r2.send(
        new PutObjectCommand({
          Bucket: "zaymo",
          Key: key,
          Body: buffer,
          ContentType: img.mimeType,
        }),
      );
      uploadedImageUrls.push(r2PublicUrl(key));
    }
  }

  // Build GPT-4o vision request to analyze style
  const textParts: string[] = [];
  if (brandContext || brandColors?.length) {
    const brandParts: string[] = [];
    if (brandContext?.name) brandParts.push(`Brand: ${brandContext.name}`);
    if (brandContext?.tagline) brandParts.push(`Tagline: "${brandContext.tagline}"`);
    if (brandContext?.description) brandParts.push(`About: ${brandContext.description}`);
    if (brandContext?.tone) brandParts.push(`Tone/voice: ${brandContext.tone}`);
    if (brandContext?.productTypes?.length) brandParts.push(`Products: ${(brandContext.productTypes as string[]).join(", ")}`);
    if (brandColors?.length) brandParts.push(`Brand colors: ${(brandColors as string[]).join(", ")}`);
    if (brandParts.length) textParts.push(`Brand context imported from website:\n${brandParts.join("\n")}`);
  }
  if (description?.trim()) {
    textParts.push(
      `User's description of their desired style: "${description.trim()}"`,
    );
  }
  if (uploadedImageUrls.length > 0) {
    textParts.push(
      `The user has uploaded ${uploadedImageUrls.length} email screenshot(s) as style references. Analyze them carefully.`,
    );
  }

  const systemPrompt = `You are an expert email designer and brand analyst. The user wants to save a reusable email style guide.
Analyze any provided email screenshot images and the user's description to extract a comprehensive style profile.
Respond with a detailed style guide that another AI can follow to recreate this style in future emails.
Cover: color palette (exact hex values when visible), typography choices, layout structure, spacing patterns,
button styles, header/footer conventions, imagery style, overall tone and aesthetic.
Be specific and actionable — include concrete CSS values and HTML patterns where possible.
Keep it under 600 words. Output only the style guide text, no preamble.`;

  const userContent: OpenAI.Chat.ChatCompletionContentPart[] = [
    ...(images ?? []).map(
      (img: {
        base64: string;
        mimeType: string;
      }): OpenAI.Chat.ChatCompletionContentPartImage => ({
        type: "image_url",
        image_url: {
          url: `data:${img.mimeType};base64,${img.base64}`,
          detail: "high",
        },
      }),
    ),
    {
      type: "text",
      text:
        textParts.length > 0
          ? textParts.join("\n\n") +
            "\n\nGenerate a detailed style guide for reuse in future emails."
          : "Generate a style guide based on the provided email screenshots.",
    },
  ];

  const completion = await openai.chat.completions.create({
    model: "gpt-5.4",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
    max_completion_tokens: 1600,
  });

  const stylePrompt = completion.choices[0]?.message?.content?.trim() ?? "";

  const style = await prisma.style.create({
    data: {
      name: name.trim(),
      description: description?.trim() || null,
      images: uploadedImageUrls,
      stylePrompt,
    },
  });

  return NextResponse.json(style, { status: 201 });
}
