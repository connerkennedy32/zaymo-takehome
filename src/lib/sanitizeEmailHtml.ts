const MAX_EMAIL_WIDTH = 600

function parsePx(value: string): number {
  const m = value.match(/^(\d+(?:\.\d+)?)/)
  return m ? parseFloat(m[1]) : 0
}

function isPercent(value: string): boolean {
  return /\d\s*%/.test(value)
}

function extractHPadding(style: string): { left: number; right: number } {
  let left = 0
  let right = 0

  const shorthand = style.match(/(?:^|;)\s*padding\s*:\s*([^;]+)/i)
  if (shorthand) {
    const parts = shorthand[1].trim().split(/\s+/)
    if (parts.length === 1) {
      left = right = parsePx(parts[0])
    } else if (parts.length === 2 || parts.length === 3) {
      left = right = parsePx(parts[1])
    } else if (parts.length >= 4) {
      right = parsePx(parts[1])
      left = parsePx(parts[3])
    }
  }

  const pl = style.match(/padding-left\s*:\s*([^;]+)/i)
  const pr = style.match(/padding-right\s*:\s*([^;]+)/i)
  if (pl) left = parsePx(pl[1].trim())
  if (pr) right = parsePx(pr[1].trim())

  return { left, right }
}

// Read width in px from either the width attribute or style="width:Xpx".
// Returns 0 if only a percentage or no width is found.
function getElementWidthPx(el: Element): number {
  const attr = el.getAttribute("width")
  if (attr !== null && !isPercent(attr)) {
    const v = parseInt(attr, 10)
    if (v > 0) return v
  }
  const style = el.getAttribute("style") ?? ""
  const m = style.match(/(?:^|;)\s*width\s*:\s*(\d+(?:\.\d+)?)px/i)
  return m ? parseFloat(m[1]) : 0
}

// Update whichever width representations exist on the element.
function clampElementWidth(el: Element, maxW: number) {
  const rounded = Math.round(maxW)
  const attr = el.getAttribute("width")
  if (attr !== null && !isPercent(attr)) {
    el.setAttribute("width", String(rounded))
  }
  const style = el.getAttribute("style") ?? ""
  if (/(?:^|;)\s*width\s*:/i.test(style)) {
    el.setAttribute(
      "style",
      style.replace(/(^|;)(\s*width\s*:)\s*[^;]*/i, `$1$2${rounded}px`)
    )
  }
}

// Remove a CSS property from a style string.
function stripStyleProp(style: string, prop: string): string {
  const re = new RegExp(`(^|;)\\s*${prop}\\s*:[^;]*`, "gi")
  return style
    .replace(re, "$1")
    .replace(/;{2,}/g, ";")
    .replace(/^;+|;+$/g, "")
    .trim()
}

function getAncestorHPadding(el: Element): number {
  let total = 0
  let node: Element | null = el.parentElement
  while (node && node.tagName !== "BODY") {
    const { left, right } = extractHPadding(node.getAttribute("style") ?? "")
    total += left + right
    node = node.parentElement
  }
  return total
}

export function sanitizeEmailHtml(html: string): string {
  if (typeof document === "undefined") return html

  const parser = new DOMParser()
  const doc = parser.parseFromString(html, "text/html")

  // 1. Clamp <table> widths and strip any min-width that could force overflow.
  for (const table of Array.from(doc.querySelectorAll("table"))) {
    const w = getElementWidthPx(table)
    if (w > MAX_EMAIL_WIDTH) clampElementWidth(table, MAX_EMAIL_WIDTH)
    const style = table.getAttribute("style") ?? ""
    if (/min-width/i.test(style))
      table.setAttribute("style", stripStyleProp(style, "min-width"))
  }

  // 2. Clamp <img> widths and add max-width:100% so they scale in narrow clients.
  for (const img of Array.from(doc.querySelectorAll("img"))) {
    const w = getElementWidthPx(img)
    if (w > MAX_EMAIL_WIDTH) clampElementWidth(img, MAX_EMAIL_WIDTH)
    const style = img.getAttribute("style") ?? ""
    if (!/max-width/i.test(style)) {
      const trimmed = style.replace(/;?\s*$/, "")
      img.setAttribute("style", trimmed ? `${trimmed}; max-width:100%` : "max-width:100%")
    }
  }

  // 3. Strip min-width from cells and block-level elements.
  for (const el of Array.from(doc.querySelectorAll("td, th, div, p, span"))) {
    const style = el.getAttribute("style") ?? ""
    if (/min-width/i.test(style))
      el.setAttribute("style", stripStyleProp(style, "min-width"))
  }

  // 4. Fix cell widths row by row.
  for (const row of Array.from(doc.querySelectorAll("tr"))) {
    const cells = Array.from(row.children).filter(
      (el): el is HTMLElement => el.tagName === "TD" || el.tagName === "TH"
    )
    if (cells.length === 0) continue

    const ancestorPadding = getAncestorHPadding(row)
    const budget = Math.max(0, MAX_EMAIL_WIDTH - ancestorPadding)

    // Single-cell rows: clamp directly without redistribution.
    if (cells.length === 1) {
      const w = getElementWidthPx(cells[0])
      if (w > 0 && w > budget) clampElementWidth(cells[0], budget)
      continue
    }

    // Multi-cell rows: skip any row where a cell uses % widths (already responsive)
    // or has no detectable width (can't safely redistribute).
    const data = cells.map((cell) => {
      const attr = cell.getAttribute("width")
      if (attr !== null && isPercent(attr)) return null

      const widthPx =
        attr !== null
          ? parseInt(attr, 10)
          : (() => {
              const m = (cell.getAttribute("style") ?? "").match(
                /(?:^|;)\s*width\s*:\s*(\d+(?:\.\d+)?)px/i
              )
              return m ? parseFloat(m[1]) : 0
            })()

      if (!widthPx) return null

      const { left, right } = extractHPadding(cell.getAttribute("style") ?? "")
      return { cell, widthPx, hPadding: left + right }
    })

    if (data.some((c) => c === null)) continue
    const safe = data as NonNullable<(typeof data)[0]>[]

    const totalRendered = safe.reduce((s, c) => s + c.widthPx + c.hPadding, 0)
    if (totalRendered <= budget) continue

    const totalHPadding = safe.reduce((s, c) => s + c.hPadding, 0)
    const contentBudget = Math.max(0, budget - totalHPadding)
    const totalWidthPx = safe.reduce((s, c) => s + c.widthPx, 0)
    if (totalWidthPx === 0) continue

    safe.forEach(({ cell, widthPx }) => {
      const corrected = Math.floor(contentBudget * (widthPx / totalWidthPx))
      clampElementWidth(cell, corrected)
    })
  }

  const hasDoctype = /^\s*<!doctype/i.test(html)
  return (hasDoctype ? "<!DOCTYPE html>\n" : "") + doc.documentElement.outerHTML
}
