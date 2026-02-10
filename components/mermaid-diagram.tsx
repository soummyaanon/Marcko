"use client"

import { useEffect, useId, useState } from "react"

interface MermaidRenderResult {
  svg: string
}

interface MermaidApi {
  initialize: (config: Record<string, unknown>) => void
  render: (id: string, text: string) => Promise<MermaidRenderResult> | MermaidRenderResult
}

declare global {
  interface Window {
    mermaid?: MermaidApi
    __mermaidLoaderPromise__?: Promise<MermaidApi>
  }
}

const MERMAID_CDN_URL = "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"

const loadMermaid = (): Promise<MermaidApi> => {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Mermaid can only run in the browser."))
  }

  if (window.mermaid) {
    return Promise.resolve(window.mermaid)
  }

  if (window.__mermaidLoaderPromise__) {
    return window.__mermaidLoaderPromise__
  }

  window.__mermaidLoaderPromise__ = new Promise<MermaidApi>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${MERMAID_CDN_URL}"]`)

    if (existingScript) {
      if (window.mermaid) {
        resolve(window.mermaid)
        return
      }

      existingScript.addEventListener("load", () => {
        if (window.mermaid) {
          resolve(window.mermaid)
          return
        }

        reject(new Error("Mermaid script loaded but runtime is unavailable."))
      })
      existingScript.addEventListener("error", () => reject(new Error("Failed to load Mermaid script.")))
      return
    }

    const script = document.createElement("script")
    script.src = MERMAID_CDN_URL
    script.async = true
    script.onload = () => {
      if (window.mermaid) {
        resolve(window.mermaid)
        return
      }

      reject(new Error("Mermaid script loaded but runtime is unavailable."))
    }
    script.onerror = () => reject(new Error("Failed to load Mermaid script."))
    document.head.appendChild(script)
  })

  window.__mermaidLoaderPromise__ = window.__mermaidLoaderPromise__.catch((error) => {
    window.__mermaidLoaderPromise__ = undefined
    throw error
  })

  return window.__mermaidLoaderPromise__
}

const detectDarkMode = () => {
  const root = document.documentElement
  if (root.classList.contains("dark")) return true

  const colorScheme = window.getComputedStyle(root).colorScheme
  if (colorScheme.includes("dark")) return true
  if (colorScheme.includes("light")) return false

  return window.matchMedia("(prefers-color-scheme: dark)").matches
}

interface MermaidDiagramProps {
  chart: string
}

export function MermaidDiagram({ chart }: MermaidDiagramProps) {
  const baseId = useId().replace(/:/g, "")
  const [svg, setSvg] = useState("")
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setIsDarkMode(detectDarkMode())

    const root = document.documentElement
    const observer = new MutationObserver(() => {
      setIsDarkMode(detectDarkMode())
    })

    observer.observe(root, { attributes: true, attributeFilter: ["class"] })

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    const handleMediaChange = () => setIsDarkMode(detectDarkMode())

    mediaQuery.addEventListener("change", handleMediaChange)

    return () => {
      observer.disconnect()
      mediaQuery.removeEventListener("change", handleMediaChange)
    }
  }, [])

  useEffect(() => {
    let isCancelled = false

    const render = async () => {
      const normalizedChart = chart.trim()

      if (!normalizedChart) {
        setSvg("")
        setError(null)
        return
      }

      try {
        const mermaid = await loadMermaid()
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: isDarkMode ? "dark" : "default",
        })

        const renderResult = await mermaid.render(`mermaid-${baseId}-${Date.now()}`, normalizedChart)

        if (isCancelled) return

        setSvg(renderResult.svg)
        setError(null)
      } catch {
        if (isCancelled) return

        setError("Unable to render Mermaid diagram.")
      }
    }

    void render()

    return () => {
      isCancelled = true
    }
  }, [baseId, chart, isDarkMode])

  if (error) {
    return (
      <div className="mermaid-container">
        <p className="mermaid-error">{error}</p>
        <pre>
          <code>{chart}</code>
        </pre>
      </div>
    )
  }

  return (
    <div className="mermaid-container">
      {svg ? (
        <div className="mermaid-diagram" dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        <p className="mermaid-loading">Rendering Mermaid diagram...</p>
      )}
    </div>
  )
}
