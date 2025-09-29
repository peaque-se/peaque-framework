import { RouteNode } from "./router.js"

// when namesAndStacksAreComponentNames is true, names and stacks are serialized as component names (identifiers)
// when false, they are serialized as string literals (for debugging)
export function serializeRouterToJs(root: RouteNode, namesAndStacksAreComponentNames: boolean): string {
  function serializeNode(node: RouteNode, indent: string): string {
    const parts: string[] = []
    parts.push("{")
    const childIndent = indent + "  "
    if (node.paramChild) {
      parts.push(`\n${childIndent}paramChild: ${serializeNode(node.paramChild, childIndent)},`)
    }
    if (node.wildcardChild) {
      parts.push(`\n${childIndent}wildcardChild: ${serializeNode(node.wildcardChild, childIndent)},`)
    }
    if (node.staticChildren.size > 0) {
      parts.push(`\n${childIndent}staticChildren: new Map([`)
      for (const [key, child] of node.staticChildren) {
        parts.push(`\n${childIndent}  ["${key}", ${serializeNode(child, childIndent + "  ")}],`)
      }
      parts.push(`\n${childIndent}]),`)
    }
    if ((node as any).paramName) {
      parts.push(`\n${childIndent}paramName: "${(node as any).paramName}",`)
    }
    if (node.wildcardChild) {
      parts.push(`\n${childIndent}paramName: "${node.wildcardChild.paramName}",`)
      parts.push(`\n${childIndent}optional: ${node.wildcardChild.optional},`)
    }
    if (node.names && Object.keys(node.names).length > 0) {
      if (namesAndStacksAreComponentNames) {
        const nameEntries = Object.entries(node.names).map(([key, value]) => {
          return `${key}: ${value}`
        })
        parts.push(`\n${childIndent}names: { ${nameEntries.join(", ")} },`)
      } else {
        parts.push(`\n${childIndent}names: ${JSON.stringify(node.names)},`)
      }
    }
    if (node.stacks && Object.keys(node.stacks).length > 0) {
      if (namesAndStacksAreComponentNames) {
        const stackEntries = Object.entries(node.stacks).map(([key, arr]) => {
          return `${key}: [${arr.join(", ")}]`
        })
        parts.push(`\n${childIndent}stacks: { ${stackEntries.join(", ")} },`)
      } else {
        parts.push(`\n${childIndent}stacks: ${JSON.stringify(node.stacks)},`)
      }
    }
    if (node.accept) {
      parts.push(`\n${childIndent}accept: true,`)
    }
    if (node.excludeFromPath) {
      parts.push(`\n${childIndent}excludeFromPath: true,`)
    }
    parts.push(`\n${indent}}`)
    return parts.join("")
  }
  return `const router = ${serializeNode(root, "")};`
}