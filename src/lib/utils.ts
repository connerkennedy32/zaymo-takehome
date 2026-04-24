import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function applyAltTexts(html: string, altTexts: string[]): string {
  let i = 0
  return html.replace(/<img(\b[^>]*?)>/gi, (match, attrs: string) => {
    if (i >= altTexts.length) return match
    const alt = altTexts[i++].replace(/"/g, "&quot;")
    if (/\balt=/i.test(attrs)) {
      return `<img${attrs.replace(/\balt=(["'])[^"']*\1/i, `alt="${alt}"`)}>`
    }
    return `<img${attrs} alt="${alt}">`
  })
}
