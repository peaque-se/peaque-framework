export interface RouteNode<T = unknown> {
  /** Static children (literal folder names) */
  staticChildren: Map<string, RouteNode<T>>

  /** Param child (e.g. [id] → :id) */
  paramChild?: RouteNode<T> & { paramName: string }

  /** Wildcard child (e.g. [...wildcard] and [...wildcard]?) */
  wildcardChild?: RouteNode<T> & { paramName: string; optional: boolean }

  /** Whether this folder is excluded from the URL path */
  excludeFromPath?: boolean

  /** is this path an acceptable end? */
  accept: boolean

  /** Properties that will be aggregated in the match. Type depends on context. */
  names: Record<string, T>
  /** Arrays that will be aggregated in the match. Type depends on context. */
  stacks: Record<string, T[]>
}

export interface MatchResult<T = unknown> {
  /** The matched route pattern */
  pattern: string
  /** Route parameters */
  params: Record<string, string>
  /** Named properties from the route */
  names: Record<string, T>
  /** Stacked arrays from the route */
  stacks: Record<string, T[]>
}

export function match<T = unknown>(path: string, root: RouteNode<T>): MatchResult<T> | null {
  const segments = path.split("/").filter(Boolean)
  const params: Record<string, string> = {}
  const names: Record<string, T> = {}
  const stacks: Record<string, T[]> = {}
  const patternParts: string[] = []

  function saveState() {
    return {
      names: { ...names },
      stacks: Object.fromEntries(Object.entries(stacks).map(([k, v]) => [k, [...v]]))
    }
  }

  function restoreState(saved: { names: Record<string, T>, stacks: Record<string, T[]> }) {
    // Clear names
    for (const key in names) {
      delete names[key]
    }
    Object.assign(names, saved.names)

    // Clear stacks
    for (const key in stacks) {
      delete stacks[key]
    }
    for (const [key, arr] of Object.entries(saved.stacks)) {
      stacks[key] = [...arr]
    }
  }

  function descend(node: RouteNode<T>, segIndex: number): MatchResult<T> | null {
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
        // Try excluded children even at end of path
        for (const child of node.staticChildren.values()) {
          if (child.excludeFromPath) {
            const saved = saveState()

            const res = descend(child, segIndex)
            if (res) return res

            restoreState(saved)
          }
        }
        return null
      }
    }

    const seg = segments[segIndex]

    // Try static match
    if (seg && node.staticChildren && node.staticChildren.has(seg)) {
      const subNode = node.staticChildren.get(seg)!
      if (!subNode.excludeFromPath) {
        patternParts.push(`/${seg}`)
        const saved = saveState()
        const res = descend(subNode, segIndex + 1)
        if (res) return res
        restoreState(saved)
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
      const saved = saveState()
      const res = descend(node.paramChild, segIndex + 1)
      if (res) return res
      restoreState(saved)
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
            params[node.wildcardChild.paramName] = rest.map((seg) => decodeURIComponent(seg)).join("/")
          } catch {
            params[node.wildcardChild.paramName] = rest.join("/")
          }
        }
        const saved = saveState()
        const res = descend(node.wildcardChild, segments.length)
        if (res) return res
        restoreState(saved)
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
        const saved = saveState()

        const res = descend(child, segIndex)
        if (res) return res

        restoreState(saved)
      }
    }

    return null
  }

  return descend(root, 0)
}
