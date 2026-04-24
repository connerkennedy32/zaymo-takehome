"use client"

import { useEffect, useState } from "react"
import { html as htmlLang } from "@codemirror/lang-html"
import { Button } from "@/components/ui/button"
import { Copy, Check } from "lucide-react"
import dynamic from "next/dynamic"

const CodeMirror = dynamic(() => import("@uiw/react-codemirror"), { ssr: false })

type Props = {
  value: string
  onChange: (value: string) => void
}

export function EditorPane({ value, onChange }: Props) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-background">
        <span className="text-xs font-medium text-muted-foreground">HTML</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={handleCopy}
          disabled={!value}
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy HTML"}
        </Button>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-auto">
        {value ? (
          <CodeMirror
            value={value}
            height="100%"
            extensions={[htmlLang()]}
            onChange={onChange}
            theme="dark"
            style={{ height: "100%", fontSize: "12px" }}
            basicSetup={{
              lineNumbers: true,
              foldGutter: true,
              syntaxHighlighting: true,
              autocompletion: true,
            }}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            Generate an email to see the HTML
          </div>
        )}
      </div>
    </div>
  )
}
