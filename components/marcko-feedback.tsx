"use client"

import { useEffect } from "react"

const WIDGET_KEY = "fb_EufL1vvJuERWtalNKjQEjypd"

export function MarckoFeedback() {
  useEffect(() => {
    if (document.querySelector("script[data-marcko-feedback-loader]")) return
    const s = document.createElement("script")
    s.src = "/widget.js"
    s.async = true
    s.dataset.key = WIDGET_KEY
    s.dataset.marckoFeedbackLoader = "1"
    document.body.appendChild(s)
  }, [])
  return null
}
