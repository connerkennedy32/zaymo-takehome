"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { ArrowUp, Loader2, Zap, Pencil, ImagePlus, X, Globe, MessageSquare, Palette, Plus, Check } from "lucide-react"
import { Input } from "@/components/ui/input"
import type { BrandContext } from "@/lib/openai"
import { StyleModal, type StyleSummary } from "./StyleModal"

type ImageAttachment = {
  url: string
  base64: string
  mimeType: string
  previewUrl: string
  name: string
  blob: Blob
}

type LibraryImage = {
  id: string
  url: string
  filename: string
  contentType: string
  size: number
  createdAt: string
}

type Message = {
  id: string
  role: "user" | "assistant"
  content: string
  images?: string[]
  isHtml?: boolean
}

export type EmailMeta = {
  subject: string
  previewText: string
  altTexts: string[]
}

type Props = {
  onHtmlChange: (html: string) => void
  hasHtml: boolean
  isGenerating: boolean
  setIsGenerating: (v: boolean) => void
  currentHtml: string
  messages: Message[]
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>
  onMetaGenerated?: (meta: EmailMeta) => void
}

export function ChatSidebar({ onHtmlChange, hasHtml, isGenerating, setIsGenerating, currentHtml, messages, setMessages, onMetaGenerated }: Props) {
  const [input, setInput] = useState("")
  const [images, setImages] = useState<ImageAttachment[]>([])
  const [uploadingImages, setUploadingImages] = useState(false)
  const [showImageLibrary, setShowImageLibrary] = useState(false)
  const [libraryImages, setLibraryImages] = useState<LibraryImage[]>([])
  const [loadingLibrary, setLoadingLibrary] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageLibraryRef = useRef<HTMLDivElement>(null)

  const [brandUrl, setBrandUrl] = useState("")
  const [isScraping, setIsScraping] = useState(false)
  const [brand, setBrand] = useState<BrandContext | null>(null)
  const [brandColors, setBrandColors] = useState<string[]>([])
  const [brandImages, setBrandImages] = useState<string[]>([])
  const [addingBrandImage, setAddingBrandImage] = useState<string | null>(null)
  const [scrapeError, setScrapeError] = useState("")

  const [showStyleModal, setShowStyleModal] = useState(false)
  const [showStylePicker, setShowStylePicker] = useState(false)
  const [styles, setStyles] = useState<StyleSummary[]>([])
  const [loadingStyles, setLoadingStyles] = useState(false)
  const [activeStyle, setActiveStyle] = useState<StyleSummary | null>(null)
  const stylePickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (imageLibraryRef.current && !imageLibraryRef.current.contains(e.target as Node)) {
        setShowImageLibrary(false)
      }
    }
    if (showImageLibrary) document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [showImageLibrary])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (stylePickerRef.current && !stylePickerRef.current.contains(e.target as Node)) {
        setShowStylePicker(false)
      }
    }
    if (showStylePicker) document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [showStylePicker])

  async function openStylePicker() {
    const next = !showStylePicker
    setShowStylePicker(next)
    if (next) {
      setLoadingStyles(true)
      try {
        const res = await fetch("/api/styles")
        setStyles(await res.json())
      } finally {
        setLoadingStyles(false)
      }
    }
  }

  function handleStyleCreated(style: StyleSummary) {
    setStyles((prev) => [style, ...prev])
    setActiveStyle(style)
    setShowStyleModal(false)
    setShowStylePicker(false)
  }

  async function openImageLibrary() {
    const next = !showImageLibrary
    setShowImageLibrary(next)
    if (next) {
      setLoadingLibrary(true)
      try {
        const res = await fetch("/api/images")
        setLibraryImages(await res.json())
      } finally {
        setLoadingLibrary(false)
      }
    }
  }

  async function selectLibraryImage(img: LibraryImage) {
    setShowImageLibrary(false)
    const res = await fetch(`/api/images/${img.id}`)
    const blob = await res.blob()
    const previewUrl = URL.createObjectURL(blob)
    const base64 = await new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve((reader.result as string).split(",")[1])
      reader.readAsDataURL(blob)
    })
    setImages((prev) => [...prev, { url: img.url, base64, mimeType: img.contentType, previewUrl, name: img.filename, blob }])
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
        // preserve PNG for transparency; also rasterize SVG to PNG to preserve its transparency
        const outType = (file.type === "image/png" || file.type === "image/svg+xml") ? "image/png" : "image/jpeg"
        canvas.toBlob(
          (blob) => {
            if (!blob) { reject(new Error("Compression failed")); return }
            const reader = new FileReader()
            reader.onload = () => {
              const base64 = (reader.result as string).split(",")[1]
              resolve({ blob, base64, mimeType: outType })
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

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return

    const added: ImageAttachment[] = await Promise.all(
      files.map(async (file) => {
        const { blob, base64, mimeType } = await compressImage(file)
        const previewUrl = URL.createObjectURL(blob)
        return { url: "", base64, mimeType, previewUrl, name: file.name, blob }
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

  async function uploadImages(pending: ImageAttachment[]): Promise<ImageAttachment[]> {
    return Promise.all(
      pending.map(async (img) => {
        if (img.url) return img
        const form = new FormData()
        form.append("file", new File([img.blob], img.name, { type: img.mimeType }))
        const res = await fetch("/api/upload", { method: "POST", body: form })
        if (!res.ok) throw new Error(`Upload failed: ${await res.text()}`)
        const { url } = await res.json()
        return { ...img, url }
      })
    )
  }

  async function handleScrape() {
    const url = brandUrl.trim()
    if (!url || isScraping) return
    setIsScraping(true)
    setScrapeError("")
    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setBrand(data.brand)
      setBrandColors(data.colors ?? [])
      setBrandImages(data.brandImages ?? [])
      setBrandUrl("")
    } catch (err) {
      setScrapeError(err instanceof Error ? err.message : "Failed to import brand")
    } finally {
      setIsScraping(false)
    }
  }

  async function addBrandImage(url: string) {
    if (addingBrandImage === url) return
    setAddingBrandImage(url)
    try {
      const res = await fetch(`/api/proxy-image?url=${encodeURIComponent(url)}`)
      if (!res.ok) throw new Error("Failed to load image")
      const contentType = res.headers.get("content-type") ?? "image/jpeg"
      const blob = await res.blob()
      const { blob: compressed, base64, mimeType } = await compressImage(
        new File([blob], "brand-image", { type: contentType })
      )
      const previewUrl = URL.createObjectURL(compressed)
      const name = url.split("/").pop()?.split("?")[0] ?? "brand-image"
      setImages((prev) => [...prev, { url: "", base64, mimeType, previewUrl, name, blob: compressed }])
    } catch {
      // silently fail — user can always upload manually
    } finally {
      setAddingBrandImage(null)
    }
  }

  function handleBrandUrlKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault()
      handleScrape()
    }
  }

  async function handleSubmit() {
    if ((!input.trim() && images.length === 0) || isGenerating) return

    const mode = hasHtml ? "edit" : "generate"
    const prompt = input || "Incorporate the attached image(s) into the email appropriately."
    setInput("")
    setIsGenerating(true)

    let uploadedImages: ImageAttachment[] = []
    if (images.length > 0) {
      setUploadingImages(true)
      try {
        uploadedImages = await uploadImages(images)
        setImages([])
      } catch {
        setIsGenerating(false)
        setUploadingImages(false)
        return
      }
      setUploadingImages(false)
    }

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: prompt,
      images: uploadedImages.map((img) => img.url || img.previewUrl),
    }
    setMessages((prev) => [...prev, userMessage])

    const assistantId = crypto.randomUUID()
    setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "", isHtml: true }])

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          currentHtml: currentHtml || null,
          mode,
          images: uploadedImages.map(({ url, base64, mimeType }) => ({ url, base64, mimeType })),
          brand: brand ?? undefined,
          brandColors: brandColors.length ? brandColors : undefined,
          styleContext: activeStyle ? { name: activeStyle.name, stylePrompt: activeStyle.stylePrompt } : undefined,
        }),
      })

      if (!res.ok) throw new Error("Generation failed")

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let accumulated = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: accumulated } : m))
        )
      }

      const html = accumulated
        .replace(/^```html\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim()
      onHtmlChange(html)

      if (onMetaGenerated) {
        fetch("/api/meta", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ html }),
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((data) => {
            if (data) onMetaGenerated(data)
          })
          .catch(() => {})
      }

      const fillerMatches = html.match(/https?:\/\/placehold\.co\/[^\s"')]+/gi)
      const fillerCount = fillerMatches ? new Set(fillerMatches).size : 0
      if (fillerCount > 0) {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: `I used ${fillerCount} placeholder image${fillerCount === 1 ? "" : "s"} in this email. Can you provide ${fillerCount === 1 ? "it" : "them"} so I can swap in the real ${fillerCount === 1 ? "one" : "ones"}? You can attach ${fillerCount === 1 ? "it" : "them"} using the image button below.`,
          },
        ])
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, content: "Something went wrong. Please try again." } : m
        )
      )
    } finally {
      setIsGenerating(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const canSubmit = (input.trim().length > 0 || images.length > 0) && !isGenerating

  return (
    <>
    <div className="flex flex-col h-full bg-background border-r">
      {/* Header */}
      <div className="px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">Chat</span>
          <div className="ml-auto flex items-center gap-1.5">
            <div className="h-4 w-4 rounded bg-primary/10 flex items-center justify-center">
              <Zap className="h-2.5 w-2.5 text-primary" />
            </div>
            <span className="text-xs text-muted-foreground">AI</span>
          </div>
        </div>
      </div>

      {/* Brand import */}
      <div className="px-4 py-3 border-b space-y-2">
        {brand ? (
          <div className="bg-muted rounded-lg p-3 space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate">{brand.name || "Imported brand"}</p>
                {brand.tagline && (
                  <p className="text-xs text-muted-foreground italic truncate">"{brand.tagline}"</p>
                )}
                {brand.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{brand.description}</p>
                )}
                {(brand.contact?.email || brand.contact?.phone || brand.contact?.address) && (
                  <div className="mt-1 space-y-0.5">
                    {brand.contact.email && (
                      <p className="text-xs text-muted-foreground truncate">{brand.contact.email}</p>
                    )}
                    {brand.contact.phone && (
                      <p className="text-xs text-muted-foreground">{brand.contact.phone}</p>
                    )}
                    {brand.contact.address && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{brand.contact.address}</p>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={() => { setBrand(null); setBrandColors([]); setBrandImages([]) }}
                className="shrink-0 h-4 w-4 rounded-full text-muted-foreground hover:text-foreground transition-colors"
                title="Remove brand"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            {brandColors.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {brandColors.map((color) => (
                  <div
                    key={color}
                    className="h-4 w-4 rounded-full border border-black/10 shrink-0"
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            )}
            {brandImages.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Brand images — click to attach</p>
                <div className="flex flex-wrap gap-1.5">
                  {brandImages.map((url) => (
                    <button
                      key={url}
                      onClick={() => addBrandImage(url)}
                      disabled={addingBrandImage === url}
                      className="relative h-12 w-12 rounded border overflow-hidden bg-muted hover:border-primary transition-colors group"
                      title="Add to attachments"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/api/proxy-image?url=${encodeURIComponent(url)}`} alt="" className="w-full h-full object-contain" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        {addingBrandImage === url ? (
                          <Loader2 className="h-3 w-3 text-white animate-spin" />
                        ) : (
                          <span className="text-white text-xs font-medium">+</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Globe className="h-3 w-3" />
              Import brand from URL
            </p>
            <div className="flex gap-1.5">
              <Input
                value={brandUrl}
                onChange={(e) => { setBrandUrl(e.target.value); setScrapeError("") }}
                onKeyDown={handleBrandUrlKeyDown}
                placeholder="https://example.com"
                className="h-7 text-xs"
                disabled={isScraping}
              />
              <Button
                size="sm"
                variant="secondary"
                className="h-7 px-2 text-xs shrink-0"
                onClick={handleScrape}
                disabled={!brandUrl.trim() || isScraping}
              >
                {isScraping ? <Loader2 className="h-3 w-3 animate-spin" /> : "Import"}
              </Button>
            </div>
            {scrapeError && (
              <p className="text-xs text-destructive">{scrapeError}</p>
            )}
          </div>
        )}
      </div>

      {/* Style selector */}
      <div className="px-4 py-3 border-b">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Palette className="h-3 w-3" />
            <span>Style</span>
          </div>
          <div className="relative" ref={stylePickerRef}>
            <button
              onClick={openStylePicker}
              className="flex items-center gap-1 text-xs transition-colors group hover:text-foreground max-w-[160px]"
            >
              {activeStyle ? (
                <span className="text-foreground font-medium truncate">{activeStyle.name}</span>
              ) : (
                <span className="text-muted-foreground">None</span>
              )}
            </button>

            {showStylePicker && (
              <div className="absolute right-0 top-full mt-1 w-64 bg-popover border border-border rounded-lg shadow-lg z-50 overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                  <span className="text-xs font-medium">Styles</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs gap-1"
                    onClick={() => { setShowStylePicker(false); setShowStyleModal(true) }}
                  >
                    <Plus className="h-3 w-3" />
                    New
                  </Button>
                </div>

                {loadingStyles ? (
                  <div className="flex items-center justify-center p-4">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : styles.length === 0 ? (
                  <div className="p-4 text-center space-y-2">
                    <p className="text-xs text-muted-foreground">No styles yet.</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() => { setShowStylePicker(false); setShowStyleModal(true) }}
                    >
                      <Plus className="h-3 w-3" />
                      Create your first style
                    </Button>
                  </div>
                ) : (
                  <div className="max-h-56 overflow-y-auto py-1">
                    <button
                      onClick={() => { setActiveStyle(null); setShowStylePicker(false) }}
                      className={`w-full text-left px-3 py-2 hover:bg-muted transition-colors flex items-center gap-2 ${!activeStyle ? "bg-muted/60" : ""}`}
                    >
                      {!activeStyle && <Check className="h-3 w-3 text-primary shrink-0" />}
                      <span className="text-xs text-muted-foreground">None</span>
                    </button>
                    {styles.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => { setActiveStyle(s); setShowStylePicker(false) }}
                        className={`w-full text-left px-3 py-2 hover:bg-muted transition-colors flex items-center gap-2 ${activeStyle?.id === s.id ? "bg-muted/60" : ""}`}
                      >
                        {activeStyle?.id === s.id && <Check className="h-3 w-3 text-primary shrink-0" />}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium truncate">{s.name}</p>
                          {s.description && (
                            <p className="text-xs text-muted-foreground truncate">{s.description}</p>
                          )}
                        </div>
                        {s.images?.length > 0 && (
                          <div className="flex -space-x-1 shrink-0">
                            {(s.images as string[]).slice(0, 2).map((url, i) => (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                key={i}
                                src={url}
                                alt=""
                                className="h-6 w-6 rounded object-cover border border-border"
                              />
                            ))}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {activeStyle ? (
            <button
              onClick={() => setActiveStyle(null)}
              className="h-4 w-4 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors shrink-0"
              title="Clear style"
            >
              <X className="h-3 w-3" />
            </button>
          ) : (
            <button
              onClick={() => setShowStyleModal(true)}
              className="h-4 w-4 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors shrink-0"
              title="New style"
            >
              <Plus className="h-3 w-3" />
            </button>
          )}
        </div>

        {activeStyle && (
          <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{activeStyle.stylePrompt}</p>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex flex-col gap-3 py-8">
            <p className="text-sm text-muted-foreground text-center">
              Describe the email you want to create.
            </p>
            <div className="flex flex-col gap-2">
              {EXAMPLE_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => setInput(p)}
                  className="text-left text-xs text-muted-foreground bg-muted hover:bg-muted/80 rounded-lg p-3 transition-colors"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {messages.map((m) => (
              <div key={m.id} className={`flex flex-col gap-1 ${m.role === "user" ? "items-end" : "items-start"}`}>
                {m.images && m.images.length > 0 && (
                  <div className="flex flex-wrap gap-1 justify-end">
                    {m.images.map((src, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={i}
                        src={src}
                        alt={`attachment ${i + 1}`}
                        className="h-16 w-16 object-cover rounded border"
                      />
                    ))}
                  </div>
                )}
                {m.role === "user" ? (
                  <div className="rounded-lg px-3 py-2 text-sm max-w-[85%] bg-secondary text-secondary-foreground">
                    {m.content}
                  </div>
                ) : (
                  <div className="text-sm text-foreground w-full">
                    {m.content === "" ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      m.isHtml ? `HTML generated (${m.content.length} chars)` : m.content
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <Separator />

      {/* Image previews */}
      {images.length > 0 && (
        <div className="px-4 pt-3 flex flex-wrap gap-2">
          {images.map((img, i) => (
            <div key={i} className="relative group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.previewUrl}
                alt={img.name}
                className="h-14 w-14 object-cover rounded border"
              />
              <button
                onClick={() => removeImage(i)}
                className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="p-4 flex flex-col gap-2">
        {hasHtml && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Pencil className="h-3 w-3" />
            <span>Editing existing email</span>
          </div>
        )}
        <div className="relative">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={hasHtml ? "Describe a change..." : "Describe your email..."}
            className="pr-10 resize-none text-sm min-h-[80px]"
            disabled={isGenerating}
          />
          <Button
            size="icon"
            className="absolute bottom-2 right-2 h-6 w-6"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {isGenerating ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <ArrowUp className="h-3 w-3" />
            )}
          </Button>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">⏎ to send, ⇧⏎ for new line</p>
          <div className="flex items-center gap-1">
            {uploadingImages && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Uploading…
              </span>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => { setShowImageLibrary(false); handleFileSelect(e) }}
            />
            <div className="relative" ref={imageLibraryRef}>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={openImageLibrary}
                disabled={isGenerating}
                title="Images"
              >
                <ImagePlus className="h-3.5 w-3.5" />
              </Button>

              {showImageLibrary && (
                <div className="absolute bottom-8 right-0 w-72 bg-popover border rounded-lg shadow-lg z-50 overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 border-b">
                    <span className="text-xs font-medium">Image Library</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs gap-1"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <ImagePlus className="h-3 w-3" />
                      Upload new
                    </Button>
                  </div>

                  {loadingLibrary ? (
                    <div className="flex items-center justify-center p-6">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : libraryImages.length === 0 ? (
                    <div className="p-6 text-center space-y-2">
                      <p className="text-xs text-muted-foreground">No images yet.</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <ImagePlus className="h-3 w-3" />
                        Upload your first image
                      </Button>
                    </div>
                  ) : (
                    <div className="max-h-64 overflow-y-auto p-2 grid grid-cols-3 gap-1.5">
                      {libraryImages.map((img) => (
                        <button
                          key={img.id}
                          onClick={() => selectLibraryImage(img)}
                          className="relative aspect-square rounded overflow-hidden border hover:border-primary transition-colors group"
                          title={img.filename}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={img.url} alt={img.filename} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="text-white text-xs font-medium">Select</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>

    {showStyleModal && (
      <StyleModal
        onClose={() => setShowStyleModal(false)}
        onCreated={handleStyleCreated}
      />
    )}
    </>
  )
}

const EXAMPLE_PROMPTS = [
  "Spring sale announcement for a DTC skincare brand with a hero image and two product blocks",
  "Welcome email for a SaaS product with a CTA to start a free trial",
  "Abandoned cart reminder with urgency and a discount code",
]
