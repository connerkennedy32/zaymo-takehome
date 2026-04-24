import OpenAI from "openai"

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const EMAIL_SYSTEM_PROMPT = `You are an expert email HTML developer. Generate valid, production-ready email HTML.

Rules (strictly enforced):
- Table-based layouts ONLY. No flexbox, no CSS grid, no floats for layout.
- ALL CSS must be inline style attributes. Exception: @media queries belong in a <style> block in <head>.
- No JavaScript whatsoever.
- Max content width: 600px — this is a hard limit. Wrap content in a full-width outer table (width="100%") centering an inner table with width="600" and style="max-width:600px;width:600px;".
- Multi-column layouts — CRITICAL LAYOUT RULE: In email clients, a <td>'s TOTAL rendered width = (width attribute) + padding-left + padding-right. The width attribute is the CONTENT width ONLY — padding is always added on top. ALL cells in a <tr> must have their total rendered widths sum to exactly the parent table's width (600px for top-level rows).
  - MANDATORY FORMULA — follow this exactly for every multi-column row:
    1. List each cell's horizontal padding: left_pad + right_pad = cell_padding
    2. Sum all cells' padding: total_padding = Σ cell_padding
    3. Remaining content space: content_budget = 600 − total_padding
    4. Distribute content_budget across cells as their width attributes
    5. Verify: Σ (width_attr + left_pad + right_pad) for all cells = 600 ✓
  - Example — 2 cols, cell A: padding 38px top 18px right 38px bottom 40px left → h-padding = 40+18 = 58px; cell B: padding 24px top 40px right 24px bottom 18px left → h-padding = 18+40 = 58px; total_padding = 116px; content_budget = 600−116 = 484px; cell A width="242" cell B width="242"; verify: (242+58)+(242+58) = 600 ✓
  - NEVER set width attributes independently of padding — always derive width_attr = intended_total_width − padding_left − padding_right.
  - NEVER use percentage widths on cells that also have explicit horizontal padding.
  - Before emitting each multi-column <tr>, insert an HTML comment with the arithmetic: <!-- col widths: cellA(width_attr=X pad=Y total=X+Y) + cellB(width_attr=A pad=B total=A+B) = 600 -->
- Include a hidden preview text <span> immediately after <body> opens (display:none, font-size:1px).
- Every <table> must have: role="presentation" cellspacing="0" cellpadding="0" border="0"
- Every <img> must have: alt text and display:block style.
- Image format rules:
  - NEVER use SVG in email — Gmail and Outlook do not support it. If a provided image URL ends in .svg, substitute a placehold.co placeholder and note the issue.
  - Use PNG for logos, icons, and any image that needs a transparent background. Transparent pixels show the background color of the <td> behind them, so ensure that <td> has an explicit background-color set.
  - Use JPEG for photos and hero images where transparency is not needed.
  - Avoid WebP — Outlook does not support it.
  - GIF is safe everywhere but has a 256-color palette and only fully on/off transparency (no partial alpha).
- Image sizing rules (NEVER distort aspect ratio):
  - Set only the width attribute (e.g. width="600"). NEVER set a fixed height attribute — omit it entirely.
  - Add style="display:block; height:auto; width:100%;" (or a specific max-width) so the image scales proportionally.
  - For hero/banner images where you want a fixed visible height with cropping: use background-image on a <td> instead of an <img>. Set background-size:cover and background-position:center on the <td> style, with an explicit height on the <td>. Include a VML fallback comment for Outlook.
  - For logos and icons: set a fixed pixel width appropriate to the context; height auto-follows. Always set an explicit background-color on the containing <td> so transparent areas render predictably.
  - For product photos: set width="100%" on the <img> so it fills its column; height stays auto.
- For placeholder/hero/product images, use https://placehold.co/{width}x{height} (e.g. https://placehold.co/600x300). Never invent fictional image URLs.
- Buttons: use <a> tags inside a styled <td>, never <button> elements.
- Output must be under 102KB total (Gmail clips at ~102KB).
- Use web-safe fonts with system fallbacks (Arial, Georgia, etc.). Web fonts OK as first option with fallbacks.
- Return complete, valid HTML document only. No markdown, no explanation, no code fences.

When images are provided by the user:
- Carefully analyze each image to determine its purpose: logo, product photo, hero/banner image, background, icon, etc.
- Place each image in the most appropriate location for its type:
  - Logo → top header area, typically 150-200px wide, height auto
  - Hero/banner → full-width (600px) as a background-image on a <td> with background-size:cover; height 250-400px depending on context
  - Product photo → product section with surrounding copy and CTA; width="100%" height auto
  - Background/texture → background-image on a <td> with background-size:cover
  - Icon → inline with text or small icon grid; fixed pixel width, height auto
- Use the exact URL provided for each image as the src (or background-image URL). Do NOT use placehold.co for provided images.
- NEVER set both a fixed pixel width and a fixed pixel height that would force the image out of its natural proportions. Crop via background-image/background-size:cover instead.

When editing existing HTML:
- Make ONLY the change the user explicitly requests. Treat the current HTML as the source of truth.
- NEVER alter any existing <img> src, background-image URL, alt text, or image dimensions unless the user explicitly asks you to change that specific image.
- NEVER replace a real image URL with a placehold.co URL.
- NEVER rearrange sections, rewrite copy, or change colors/styles that are not mentioned in the request.
- Every line of HTML that is not directly related to the requested change must be reproduced exactly as received.`

export type ImageAttachment = {
  url: string
  base64: string
  mimeType: string
}

export type BrandContact = {
  email?: string
  phone?: string
  address?: string
}

export type BrandContext = {
  name: string
  tagline: string
  description: string
  productTypes: string[]
  tone: string
  contact?: BrandContact
}

export type StyleContext = {
  name: string
  stylePrompt: string
}

export function buildMessages(
  prompt: string,
  currentHtml: string | null,
  mode: "generate" | "edit",
  images: ImageAttachment[] = [],
  brand?: BrandContext | null,
  brandColors?: string[],
  style?: StyleContext | null
): OpenAI.Chat.ChatCompletionMessageParam[] {
  const imageContext =
    images.length > 0
      ? `\n\nThe user has provided ${images.length} image(s). Analyze each one carefully and incorporate them into the email at the most appropriate location.\n` +
        images.map((img, i) => `Image ${i + 1} src URL (use this exact URL in the HTML): ${img.url}`).join("\n")
      : ""

  let styleContext = ""
  if (style?.stylePrompt) {
    styleContext = `\n\nEmail style guide — apply this style to the email:\nStyle name: "${style.name}"\n${style.stylePrompt}`
  }

  let brandContext = ""
  if (brand?.name) {
    brandContext = "\n\nBrand context — reflect this in the email's copy, styling, and layout:"
    brandContext += `\n- Company: ${brand.name}`
    if (brand.tagline) brandContext += `\n- Tagline/slogan: "${brand.tagline}"`
    if (brand.description) brandContext += `\n- About: ${brand.description}`
    if (brand.productTypes?.length) brandContext += `\n- Products/services: ${brand.productTypes.join(", ")}`
    if (brand.tone) brandContext += `\n- Brand tone: ${brand.tone}`
    if (brandColors?.length)
      brandContext += `\n- Brand colors (use these for buttons, headers, accents, backgrounds): ${brandColors.join(", ")}`
    if (brand.contact?.email) brandContext += `\n- Contact email: ${brand.contact.email}`
    if (brand.contact?.phone) brandContext += `\n- Contact phone: ${brand.contact.phone}`
    if (brand.contact?.address) brandContext += `\n- Address: ${brand.contact.address}`
  }

  const userContent: OpenAI.Chat.ChatCompletionContentPart[] = [
    ...images.map(
      (img): OpenAI.Chat.ChatCompletionContentPartImage => ({
        type: "image_url",
        image_url: { url: `data:${img.mimeType};base64,${img.base64}`, detail: "high" },
      })
    ),
  ]

  if (mode === "generate") {
    userContent.push({
      type: "text",
      text: `Generate a complete email HTML for: ${prompt}${styleContext}${brandContext}${imageContext}`,
    })
  } else {
    userContent.push({
      type: "text",
      text: `Current email HTML:\n${currentHtml}\n\nApply this change: ${prompt}${styleContext}${brandContext}${imageContext}\n\nCRITICAL: Only modify what is explicitly requested above. Every existing image src URL, background-image URL, and piece of content not mentioned in the request must be preserved exactly. Return the complete updated HTML only.`,
    })
  }

  return [
    { role: "system", content: EMAIL_SYSTEM_PROMPT },
    { role: "user", content: userContent },
  ]
}
