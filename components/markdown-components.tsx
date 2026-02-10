"use client"

import type { ReactNode } from "react"
import type { Components } from "react-markdown"
import { MermaidDiagram } from "@/components/mermaid-diagram"

const nodeToText = (node: ReactNode): string => {
  if (typeof node === "string" || typeof node === "number") {
    return String(node)
  }

  if (Array.isArray(node)) {
    return node.map(nodeToText).join("")
  }

  if (node && typeof node === "object" && "props" in node) {
    const element = node as { props?: { children?: ReactNode } }
    return nodeToText(element.props?.children ?? "")
  }

  return ""
}

export const markdownComponentsWithMermaid: Components = {
  pre({ node: _node, ...props }) {
    const child = Array.isArray(props.children) ? props.children[0] : props.children

    if (child && typeof child === "object" && "props" in child) {
      const codeChild = child as {
        props?: {
          className?: string
          children?: ReactNode
        }
      }

      if (codeChild.props?.className?.includes("language-mermaid")) {
        const diagramSource = nodeToText(codeChild.props.children ?? "").trimEnd()
        return <MermaidDiagram chart={diagramSource} />
      }
    }

    return <pre {...props} />
  },
}
