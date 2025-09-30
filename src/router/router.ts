export interface RouteNode {
  /** Static children (literal folder names) */
  staticChildren: Map<string, RouteNode>

  /** Param child (e.g. [id] → :id) */
  paramChild?: RouteNode & { paramName: string }

  /** Wildcard child (e.g. [...wildcard] and [...wildcard]?) */
  wildcardChild?: RouteNode & { paramName: string; optional: boolean }

  /** Whether this folder is excluded from the URL path */
  excludeFromPath?: boolean

  /** is this path an acceptable end? */
  accept: boolean

  /** Properties that will be aggregated in the match. */
  names: Record<string, any>
  stacks: Record<string, any[]>
}

export interface MatchResult {
  /** The matched route pattern */
  pattern: string
  /** Route parameters */
  params: Record<string, string>
  /** names and stacks */
  names: Record<string, any>
  stacks: Record<string, any[]>
}

export function match(path: string, root: RouteNode): MatchResult | null {
  const segments = path.split("/").filter(Boolean)
  const params: Record<string, string> = {}
  const names: Record<string, any> = {}
  const stacks: Record<string, any[]> = {}
  const patternParts: string[] = []

  function descend(node: RouteNode, segIndex: number): MatchResult | null {
    // collect names and stacks
    node.names && Object.assign(names, node.names)
    for (const [key, arr] of Object.entries(node.stacks || {})) {
      if (!stacks[key]) stacks[key] = []
      stacks[key].push(...arr)
    }

    // If we consumed all path segments
    if (segIndex === segments.length) {
      if (node.accept) {
        return { params: { ...params }, names: { ...names }, stacks: { ...stacks }, pattern: patternParts.join("") || "/" }
      } else {
        return null
      }
    }

    const seg = segments[segIndex]

    // Try static match
    if (seg && node.staticChildren && node.staticChildren.has(seg)) {
      const subNode = node.staticChildren.get(seg)!
      if (!subNode.excludeFromPath) {
        patternParts.push(`/${seg}`)
        const res = descend(subNode, segIndex + 1)
        if (res) return res
        patternParts.pop() // backtrack
      }
    }

    // Try param match
    if (seg && node.paramChild) {
      patternParts.push(`/:${node.paramChild.paramName}`)
      try {
        params[node.paramChild.paramName] = decodeURIComponent(seg)
      } catch {
        params[node.paramChild.paramName] = seg
      }
      const res = descend(node.paramChild, segIndex + 1)
      if (res) return res
      delete params[node.paramChild.paramName]
      patternParts.pop() // backtrack
    }

    // Try wildcard match (consume rest of path)
    if (node.wildcardChild) {
      const rest = segments.slice(segIndex)
      if (rest.length > 0 || node.wildcardChild.optional) {
        patternParts.push(`/*${node.wildcardChild.paramName}`)
        if (node.wildcardChild.optional) {
          patternParts.push("?")
        }
        if (rest.length > 0) {
          try {
            params[node.wildcardChild.paramName] = rest.map(seg => decodeURIComponent(seg)).join("/")
          } catch {
            params[node.wildcardChild.paramName] = rest.join("/")
          }
        }
        const res = descend(node.wildcardChild, segments.length)
        if (res) return res
        if (rest.length > 0) {
          delete params[node.wildcardChild.paramName]
        }
        patternParts.pop()
        if (node.wildcardChild.optional) {
          patternParts.pop()
        }
      }
    }

    // Try excluded children (don't consume path segment)
    for (const child of node.staticChildren.values()) {
      if (child.excludeFromPath) {
        const res = descend(child, segIndex)
        if (res) return res
      }
    }

    return null
  }

  return descend(root, 0)
}
