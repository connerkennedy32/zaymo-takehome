"use client"

import { useState, useRef } from "react"
import { X, ImagePlus, Loader2, Sparkles, Trash2, Check, Globe } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

type StyleImage = {
  base64: string
  mimeType: string
  previewUrl: string
  name: string
  blob: Blob
}

type ScrapedBrand = {
  name?: string
  tagline?: string
  description?: string
  tone?: string
  productTypes?: string[]
  contact?: Record<string, string>
}

export type StyleSummary = {
  id: string
  name: string
  description: string | null
  images: string[]
  stylePrompt: string
  createdAt: string
}

type Props = {
  onClose: () => void
  onCreated: (style: StyleSummary) => void
}

function compressImage(
  file: File,
  maxDimension = 1200,
  quality = 0.85
): Promise<{ blob: Blob; base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      let { width, height } = img
      if (width > maxDimension || height > maxDimension) {
        if (width >= height) {
          height = Math.round((height * maxDimension) / width)
          width = maxDimension
        } else {
          width = Math.round((width * maxDimension) / height)
          height = maxDimension
        }
      }
      const canvas = document.createElement("canvas")
      canvas.width = width
      canvas.height = height
      canvas.getContext("2d")!.drawImage(img, 0, 0, width, height)
      const outType = file.type === "image/png" || file.type === "image/svg+xml" ? "image/png" : "image/jpeg"
      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error("Compression failed")); return }
          const reader = new FileReader()
          reader.onload = () => {
            resolve({ blob, base64: (reader.result as string).split(",")[1], mimeType: outType })
          }
          reader.onerror = reject
          reader.readAsDataURL(blob)
        },
        outType,
        quality
      )
    }
    img.onerror = reject
    img.src = objectUrl
  })
}

export function StyleModal({ onClose, onCreated }: Props) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [images, setImages] = useState<StyleImage[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [brandUrl, setBrandUrl] = useState("")
  const [isScraping, setIsScraping] = useState(false)
  const [scrapeError, setScrapeError] = useState("")
  const [scrapedBrand, setScrapedBrand] = useState<{ brand: ScrapedBrand; colors: string[] } | null>(null)

  async function handleScrape() {
    const url = brandUrl.trim()
    if (!url || isScraping) return
    setIsScraping(true)
    setScrapeError("")
    setScrapedBrand(null)
    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setScrapedBrand({ brand: data.brand, colors: data.colors ?? [] })
      if (data.brand?.name && !name.trim()) setName(data.brand.name)
    } catch (err) {
      setScrapeError(err instanceof Error ? err.message : "Could not fetch brand — check the URL and try again")
    } finally {
      setIsScraping(false)
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    const added = await Promise.all(
      files.map(async (file) => {
        const { blob, base64, mimeType } = await compressImage(file)
        return { base64, mimeType, previewUrl: URL.createObjectURL(blob), name: file.name, blob }
      })
    )
    setImages((prev) => [...prev, ...added])
    e.target.value = ""
  }

  function removeImage(index: number) {
    setImages((prev) => {
      URL.revokeObjectURL(prev[index].previewUrl)
      return prev.filter((_, i) => i !== index)
    })
  }

  async function handleSave() {
    if (!name.trim()) { setError("Style name is required"); return }
    if (images.length === 0 && !description.trim() && !scrapedBrand) {
      setError("Add at least one image, a description, or a brand URL")
      return
    }
    setError("")
    setIsSaving(true)
    try {
      const res = await fetch("/api/styles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          images: images.map(({ base64, mimeType }) => ({ base64, mimeType })),
          brandContext: scrapedBrand?.brand ?? null,
          brandColors: scrapedBrand?.colors ?? [],
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? "Failed to save style")
        return
      }
      const style: StyleSummary = await res.json()
      onCreated(style)
    } catch {
      setError("Failed to save style")
    } finally {
      setIsSaving(false)
    }
  }

  const disabled = isSaving || isScraping

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg bg-card border border-border rounded-lg shadow-xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-sm font-medium">New style</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Paste a brand URL, upload email screenshots, or describe the aesthetic — AI builds a reusable style guide.
            </p>
          </div>
          <button
            onClick={onClose}
            className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors ml-4 shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium">Style name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Bold DTC, Minimal SaaS, Luxury Brand…"
              className="h-8 text-sm"
              disabled={disabled}
            />
          </div>

          {/* Brand URL */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium">
              Brand website{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <div className="flex gap-1.5">
              <Input
                value={brandUrl}
                onChange={(e) => { setBrandUrl(e.target.value); setScrapedBrand(null); setScrapeError("") }}
                onKeyDown={(e) => e.key === "Enter" && handleScrape()}
                placeholder="https://yourbrand.com"
                className="h-8 text-sm"
                disabled={disabled}
              />
              <Button
                variant="secondary"
                size="sm"
                className="h-8 px-3 text-xs shrink-0 gap-1.5"
                onClick={handleScrape}
                disabled={!brandUrl.trim() || disabled}
              >
                {isScraping ? <Loader2 className="h-3 w-3 animate-spin" /> : <Globe className="h-3 w-3" />}
                {isScraping ? "Fetching…" : "Fetch"}
              </Button>
            </div>
            {scrapeError && <p className="text-xs text-destructive">{scrapeError}</p>}
            {scrapedBrand && (
              <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-md bg-muted/50 border border-border">
                <Check className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                <div className="min-w-0 space-y-1.5">
                  <div>
                    <p className="text-xs font-medium">{scrapedBrand.brand.name || "Brand imported"}</p>
                    {scrapedBrand.brand.tagline && (
                      <p className="text-xs text-muted-foreground truncate">"{scrapedBrand.brand.tagline}"</p>
                    )}
                  </div>
                  {scrapedBrand.colors.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-muted-foreground">Colors</span>
                      <div className="flex gap-1">
                        {scrapedBrand.colors.slice(0, 8).map((c) => (
                          <div
                            key={c}
                            className="h-3.5 w-3.5 rounded-full border border-black/10 shrink-0"
                            style={{ backgroundColor: c }}
                            title={c}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium">
              Describe the aesthetic{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Dark background, acid-yellow CTAs, geometric sans-serif, very minimal with lots of whitespace…"
              className="text-sm resize-none min-h-[72px]"
              disabled={disabled}
            />
          </div>

          {/* Image upload */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium">
              Email screenshots{" "}
              <span className="text-muted-foreground font-normal">(optional — upload 1–5 examples)</span>
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileSelect}
              disabled={disabled}
            />
            {images.length === 0 ? (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled}
                className="w-full flex flex-col items-center justify-center gap-2 border border-dashed border-border rounded-lg py-8 text-muted-foreground hover:border-primary hover:text-foreground transition-colors group"
              >
                <ImagePlus className="h-5 w-5 group-hover:text-primary transition-colors" />
                <span className="text-xs">Click to upload email screenshots</span>
              </button>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {images.map((img, i) => (
                  <div key={i} className="relative group aspect-[3/4] rounded overflow-hidden border border-border bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.previewUrl} alt={img.name} className="w-full h-full object-cover" />
                    <button
                      onClick={() => removeImage(i)}
                      disabled={disabled}
                      className="absolute top-1 right-1 h-5 w-5 rounded bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {images.length < 5 && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={disabled}
                    className="aspect-[3/4] rounded border border-dashed border-border flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                  >
                    <ImagePlus className="h-4 w-4" />
                  </button>
                )}
              </div>
            )}
          </div>

          {isSaving && (
            <div className="bg-muted rounded-lg px-4 py-3 flex items-center gap-3">
              <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
              <div>
                <p className="text-xs font-medium">Analyzing style…</p>
                <p className="text-xs text-muted-foreground">AI is extracting a reusable style guide from your inputs.</p>
              </div>
            </div>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border flex items-center justify-end gap-2 shrink-0">
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={onClose} disabled={disabled}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={handleSave}
            disabled={disabled || !name.trim()}
          >
            {isSaving ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3" />
            )}
            Analyze &amp; Save
          </Button>
        </div>
      </div>
    </div>
  )
}
