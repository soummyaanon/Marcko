"use client"

import type { ReactNode } from "react"
import { isValidElement } from "react"
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

const isSingleImageParagraph = (node: ReactNode): boolean => {
  const children = Array.isArray(node) ? node : [node]
  const meaningfulChildren = children.filter(
    (child) => child !== null && child !== undefined && child !== "",
  )

  if (meaningfulChildren.length !== 1) return false

  const onlyChild = meaningfulChildren[0]
  return isValidElement(onlyChild) && onlyChild.type === "img"
}

export const markdownComponentsWithMermaid: Components = {
  p({ node: _node, ...props }) {
    if (isSingleImageParagraph(props.children)) {
      return <p {...props} style={{ ...(props.style ?? {}), textAlign: "center" }} />
    }

    return <p {...props} />
  },
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
