"use client"

import { useState, useEffect, useRef } from "react"
import { X, Upload, Loader2, AlignLeft, AlignCenter, AlignRight, Library, Check, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

type LibraryImage = {
  id: string
  url: string
  filename: string
  contentType: string
}

export type SelectedElement = {
  eid: string
  tag: string
  innerText: string
  innerHTML: string
  href: string
  src: string
  alt: string
  styles: {
    color: string
    backgroundColor: string
    fontSize: string
    fontWeight: string
    textAlign: string
    padding: string
    margin: string
    borderRadius: string
    border: string
    width: string
  }
}

type BatchPayload = {
  text?: string
  src?: string
  alt?: string
  href?: string
  styles?: Record<string, string>
}

type Props = {
  element: SelectedElement
  onApply: (type: string, eid: string, payload: Record<string, string>) => void
  onBatch: (eid: string, payload: BatchPayload) => void
  onClose: () => void
  onRemove: (eid: string) => void
}

type SpacingSides = { top: number | null; right: number | null; bottom: number | null; left: number | null }

function parseSpacing(value: string): SpacingSides {
  if (!value || value.trim() === "") return { top: null, right: null, bottom: null, left: null }
  const parts = value.trim().split(/\s+/).map((p) => parseInt(p))
  if (parts.length === 1) return { top: parts[0], right: parts[0], bottom: parts[0], left: parts[0] }
  if (parts.length === 2) return { top: parts[0], right: parts[1], bottom: parts[0], left: parts[1] }
  if (parts.length === 3) return { top: parts[0], right: parts[1], bottom: parts[2], left: parts[1] }
  return { top: parts[0], right: parts[1], bottom: parts[2], left: parts[3] }
}

function spacingToString(s: SpacingSides): string | null {
  const vals = [s.top, s.right, s.bottom, s.left]
  if (vals.every((v) => v === null)) return null
  return vals.map((v) => (v === null ? "0" : v + "px")).join(" ")
}

function rgbToHex(rgb: string): string {
  if (!rgb) return ""
  if (rgb.startsWith("#")) return rgb
  if (rgb === "transparent" || rgb.startsWith("rgba(0, 0, 0, 0)")) return ""
  const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (!m) return ""
  return "#" + [m[1], m[2], m[3]].map((n) => parseInt(n).toString(16).padStart(2, "0")).join("")
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

export function ElementEditor({ element, onApply, onBatch, onClose, onRemove }: Props) {
  const isImg = element.tag === "img"
  const isLink = element.tag === "a"

  const [text, setText] = useState(element.innerText)
  const [applied, setApplied] = useState(false)

  const [imgSrc, setImgSrc] = useState(element.src)
  const [imgAlt, setImgAlt] = useState(element.alt)
  const [libraryImages, setLibraryImages] = useState<LibraryImage[]>([])
  const [loadingLib, setLoadingLib] = useState(false)
  const [showLib, setShowLib] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [href, setHref] = useState(element.href)

  const [color, setColor] = useState(rgbToHex(element.styles.color))
  const [bgColor, setBgColor] = useState(rgbToHex(element.styles.backgroundColor))
  const [fontSize, setFontSize] = useState(parseInt(element.styles.fontSize) || 14)
  const [bold, setBold] = useState(
    element.styles.fontWeight === "bold" || parseInt(element.styles.fontWeight) >= 700
  )
  const [align, setAlign] = useState(element.styles.textAlign || "left")
  const [borderRadius, setBorderRadius] = useState(parseInt(element.styles.borderRadius) || 0)
  const [padding, setPadding] = useState<SpacingSides>(() => parseSpacing(element.styles.padding))
  const [margin, setMargin] = useState<SpacingSides>(() => parseSpacing(element.styles.margin))

  useEffect(() => {
    setText(element.innerText)
    setImgSrc(element.src)
    setImgAlt(element.alt)
    setHref(element.href)
    setColor(rgbToHex(element.styles.color))
    setBgColor(rgbToHex(element.styles.backgroundColor))
    setFontSize(parseInt(element.styles.fontSize) || 14)
    setBold(element.styles.fontWeight === "bold" || parseInt(element.styles.fontWeight) >= 700)
    setAlign(element.styles.textAlign || "left")
    setBorderRadius(parseInt(element.styles.borderRadius) || 0)
    setPadding(parseSpacing(element.styles.padding))
    setMargin(parseSpacing(element.styles.margin))
    setApplied(false)
    setShowLib(false)
  }, [element.eid]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadLib() {
    setLoadingLib(true)
    try {
      const res = await fetch("/api/images")
      setLibraryImages(await res.json())
    } finally {
      setLoadingLib(false)
    }
  }

  function selectLibraryImage(src: string) {
    setImgSrc(src)
    setShowLib(false)
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const form = new FormData()
      form.append("file", file)
      const res = await fetch("/api/upload", { method: "POST", body: form })
      const data = await res.json()
      setImgSrc(data.url)
      setShowLib(false)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  function handleApplyAll() {
    const styles: Record<string, string> = {
      fontSize: fontSize + "px",
      fontWeight: bold ? "bold" : "normal",
      textAlign: align,
    }
    if (color) styles.color = color
    if (bgColor) styles.backgroundColor = bgColor
    if (borderRadius > 0) styles.borderRadius = borderRadius + "px"
    const paddingStr = spacingToString(padding)
    if (paddingStr) styles.padding = paddingStr
    const marginStr = spacingToString(margin)
    if (marginStr) styles.margin = marginStr

    const batch: BatchPayload = { styles }
    if (isImg) {
      batch.src = imgSrc
      batch.alt = imgAlt
    } else {
      batch.text = text
    }
    if (isLink) batch.href = href

    onBatch(element.eid, batch)
    setApplied(true)
    setTimeout(() => setApplied(false), 1500)
  }

  return (
    <div className="border-l bg-background flex flex-col shrink-0 w-72 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b shrink-0">
        <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground uppercase tracking-wider">
          {element.tag}
        </span>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors p-1"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Sections */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-5">

        {/* Text content */}
        {!isImg && (
          <Section label="Content">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="text-xs font-mono resize-none"
              rows={4}
              placeholder="Text content..."
            />
          </Section>
        )}

        {/* Image */}
        {isImg && (
          <Section label="Image">
            <Input
              value={imgSrc}
              onChange={(e) => setImgSrc(e.target.value)}
              placeholder="Image URL..."
              className="h-7 text-xs"
            />
            <Input
              value={imgAlt}
              onChange={(e) => setImgAlt(e.target.value)}
              placeholder="Alt text..."
              className="h-7 text-xs"
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1.5 flex-1"
                onClick={() => {
                  if (!showLib && libraryImages.length === 0) loadLib()
                  setShowLib((v) => !v)
                }}
              >
                <Library className="h-3 w-3" />
                Library
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1.5 flex-1"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                Upload
              </Button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
            </div>
            {showLib && (
              <div className="border rounded p-2 max-h-40 overflow-y-auto">
                {loadingLib ? (
                  <div className="flex justify-center p-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                ) : libraryImages.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-1">No images uploaded yet</p>
                ) : (
                  <div className="grid grid-cols-4 gap-1">
                    {libraryImages.map((img) => (
                      <button
                        key={img.id}
                        onClick={() => selectLibraryImage(img.url)}
                        className="aspect-square rounded overflow-hidden border hover:ring-2 ring-primary transition-all"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img.url} alt={img.filename} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Section>
        )}

        {/* Link */}
        {isLink && (
          <Section label="Link">
            <Input
              value={href}
              onChange={(e) => setHref(e.target.value)}
              placeholder="https://..."
              className="h-7 text-xs"
            />
          </Section>
        )}

        {/* Style */}
        <Section label="Style">
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground w-10 shrink-0">Color</span>
              {color ? (
                <div className="flex items-center gap-1 flex-1">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="h-7 flex-1 rounded cursor-pointer border"
                  />
                  <button onClick={() => setColor("")} className="text-muted-foreground hover:text-foreground">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setColor("#000000")}
                  className="h-7 flex-1 rounded border border-dashed text-muted-foreground hover:text-foreground hover:border-foreground text-[10px] transition-colors"
                >
                  + Add
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground w-10 shrink-0">BG</span>
              {bgColor ? (
                <div className="flex items-center gap-1 flex-1">
                  <input
                    type="color"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="h-7 flex-1 rounded cursor-pointer border"
                  />
                  <button onClick={() => setBgColor("")} className="text-muted-foreground hover:text-foreground">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setBgColor("#ffffff")}
                  className="h-7 flex-1 rounded border border-dashed text-muted-foreground hover:text-foreground hover:border-foreground text-[10px] transition-colors"
                >
                  + Add
                </button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground w-10 shrink-0">Size</span>
              <Input
                type="number"
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="h-7 text-xs flex-1"
                min={8}
                max={72}
              />
            </label>
            <label className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground w-10 shrink-0">Radius</span>
              <Input
                type="number"
                value={borderRadius}
                onChange={(e) => setBorderRadius(Number(e.target.value))}
                className="h-7 text-xs flex-1"
                min={0}
                max={50}
              />
            </label>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
              <input
                type="checkbox"
                checked={bold}
                onChange={(e) => setBold(e.target.checked)}
                className="cursor-pointer"
              />
              <span className="text-muted-foreground">Bold</span>
            </label>
            <div className="flex gap-0.5">
              {(["left", "center", "right"] as const).map((a) => (
                <button
                  key={a}
                  onClick={() => setAlign(a)}
                  className={[
                    "h-7 w-7 rounded flex items-center justify-center transition-colors",
                    align === a ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground",
                  ].join(" ")}
                >
                  {a === "left" ? (
                    <AlignLeft className="h-3 w-3" />
                  ) : a === "center" ? (
                    <AlignCenter className="h-3 w-3" />
                  ) : (
                    <AlignRight className="h-3 w-3" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </Section>

        {/* Spacing */}
        <Section label="Spacing">
          {(["padding", "margin"] as const).map((prop) => {
            const val = prop === "padding" ? padding : margin
            const setVal = prop === "padding" ? setPadding : setMargin
            return (
              <div key={prop} className="flex flex-col gap-1.5">
                <span className="text-[10px] text-muted-foreground capitalize">{prop}</span>
                <div className="grid grid-cols-4 gap-1">
                  {(["top", "right", "bottom", "left"] as const).map((side) => (
                    <div key={side} className="flex flex-col gap-0.5">
                      <span className="text-[9px] text-muted-foreground text-center uppercase">{side[0]}</span>
                      {val[side] !== null ? (
                        <div className="relative">
                          <Input
                            type="number"
                            value={val[side] as number}
                            onChange={(e) => setVal((prev) => ({ ...prev, [side]: Number(e.target.value) }))}
                            className="h-7 text-xs text-center px-1 pr-4"
                            min={0}
                            max={200}
                          />
                          <button
                            onClick={() => setVal((prev) => ({ ...prev, [side]: null }))}
                            className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setVal((prev) => ({ ...prev, [side]: 0 }))}
                          className="h-7 rounded border border-dashed text-muted-foreground hover:text-foreground hover:border-foreground text-[10px] transition-colors flex items-center justify-center"
                        >
                          +
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </Section>

      </div>

      {/* Actions */}
      <div className="px-3 py-2 border-t shrink-0 flex gap-2">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
          onClick={() => onRemove(element.eid)}
          title="Remove element"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
        <Button className="flex-1 gap-1.5" onClick={handleApplyAll}>
          {applied && <Check className="h-4 w-4" />}
          {applied ? "Applied" : "Apply"}
        </Button>
      </div>
    </div>
  )
}
