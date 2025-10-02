/**
 * Router utility module for file-based routing.
 *
 * This module implements a trie-based router that supports:
 * - Static routes: /users/profile
 * - Dynamic routes: /users/:id
 * - Wildcard routes: /files/*path
 * - Optional wildcards: /files/*path?
 *
 * @module router
 */

/**
 * Node in the routing tree representing a path segment.
 *
 * The router uses a trie (prefix tree) structure for efficient matching.
 * Each node can have static children, a parameter child, or a wildcard child.
 *
 * @typeParam T - The type of data stored in the node
 */
export interface RouteNode<T = unknown> {
  /** Static children (literal folder names) */
  staticChildren: Map<string, RouteNode<T>>;

  /** Param child (e.g. [id] → :id) */
  paramChild?: RouteNode<T> & { paramName: string };

  /** Wildcard child (e.g. [...wildcard] and [...wildcard]?) */
  wildcardChild?: RouteNode<T> & { paramName: string; optional: boolean };

  /** Whether this folder is excluded from the URL path */
  excludeFromPath?: boolean;

  /** Is this path an acceptable end? */
  accept: boolean;

  /** Properties that will be aggregated in the match. Type depends on context. */
  names: Record<string, T>;

  /** Arrays that will be aggregated in the match. Type depends on context. */
  stacks: Record<string, T[]>;
}

/**
 * Result of a successful route match.
 *
 * @typeParam T - The type of data stored in route nodes
 */
export interface MatchResult<T = unknown> {
  /** The matched route pattern (e.g., "/users/:id") */
  pattern: string;

  /** Route parameters extracted from the URL */
  params: Record<string, string>;

  /** Named properties from the route */
  names: Record<string, T>;

  /** Stacked arrays from the route (e.g., middleware) */
  stacks: Record<string, T[]>;
}

/**
 * Match a URL path against a routing tree.
 *
 * This function traverses the routing tree to find a matching route for the given path.
 * It supports backtracking to try alternative routes when a match fails.
 *
 * @typeParam T - The type of data stored in route nodes
 * @param path - The URL path to match (e.g., "/users/123")
 * @param root - The root node of the routing tree
 * @returns The match result if found, null otherwise
 *
 * @example
 * ```typescript
 * const result = match('/users/123', routeTree);
 * if (result) {
 *   console.log(result.pattern); // "/users/:id"
 *   console.log(result.params.id); // "123"
 * }
 * ```
 */
export function match<T = unknown>(path: string, root: RouteNode<T>): MatchResult<T> | null {
  // Validate inputs
  if (!path || typeof path !== 'string') {
    return null;
  }

  if (!root || typeof root !== 'object') {
    return null;
  }

  const segments = path.split("/").filter(Boolean);
  const params: Record<string, string> = {};
  const names: Record<string, T> = {};
  const stacks: Record<string, T[]> = {};
  const patternParts: string[] = [];

  /**
   * Save the current state for backtracking.
   * Creates a deep copy of names and stacks.
   */
  function saveState() {
    return {
      names: { ...names },
      stacks: Object.fromEntries(Object.entries(stacks).map(([k, v]) => [k, [...v]]))
    };
  }

  /**
   * Restore a previously saved state during backtracking.
   * Clears current state and restores saved values.
   */
  function restoreState(saved: { names: Record<string, T>, stacks: Record<string, T[]> }) {
    // Clear names
    for (const key in names) {
      delete names[key];
    }
    Object.assign(names, saved.names);

    // Clear stacks
    for (const key in stacks) {
      delete stacks[key];
    }
    for (const [key, arr] of Object.entries(saved.stacks)) {
      stacks[key] = [...arr];
    }
  }

  /**
   * Recursively descend the routing tree, trying to match path segments.
   * Uses backtracking to explore alternative routes when needed.
   *
   * @param node - Current node in the routing tree
   * @param segIndex - Current position in the path segments
   * @returns Match result if successful, null otherwise
   */
  function descend(node: RouteNode<T>, segIndex: number): MatchResult<T> | null {
    // Collect names and stacks from current node
    if (node.names) {
      Object.assign(names, node.names);
    }
    if (node.stacks) {
      for (const [key, arr] of Object.entries(node.stacks)) {
        if (!stacks[key]) stacks[key] = [];
        stacks[key].push(...arr);
      }
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
