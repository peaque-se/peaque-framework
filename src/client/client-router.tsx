/**
 * Client-side router for React applications.
 *
 * This module provides a file-based routing system with:
 * - Dynamic route matching
 * - Route guards and middleware
 * - Layout nesting
 * - Scroll restoration
 * - Navigation hooks
 *
 * @module client/client-router
 */

import { createContext, useContext, useEffect, useState, Component, useCallback } from "react"
import type { ReactElement, ReactNode } from "react"
import type { HeadDefinition } from "./head.js"
import { match, RouteNode } from "../router/router.js"

/**
 * Result type for route guards and middleware.
 * - `true`: Allow navigation
 * - `false`: Deny navigation
 * - `string`: Redirect to the specified path
 */
export type GuardResult = boolean | string | Promise<boolean | string>

/**
 * Parameters passed to route guards and middleware
 */
export type GuardParameters = {
  /** Current navigation path */
  path: string
  /** Route parameters extracted from the URL */
  params: Record<string, string>
  /** Matched route pattern */
  pattern: string
}

/**
 * Route guard function for authentication/authorization.
 * Guards are stackable and execute in order.
 *
 * @example
 * ```typescript
 * // In pages/admin/guard.ts
 * export default async function guard({ path, params }: GuardParameters): Promise<GuardResult> {
 *   const user = await getCurrentUser();
 *   if (!user) return '/login';
 *   if (!user.isAdmin) return false;
 *   return true;
 * }
 * ```
 */
export type PageGuard = (params: GuardParameters) => GuardResult

/**
 * Route middleware function for parameter validation and transformations.
 * Middleware is non-stackable and executes after guards.
 *
 * @example
 * ```typescript
 * // Validate route parameters
 * export default function middleware({ params }: GuardParameters): GuardResult {
 *   if (!isValidId(params.id)) return '/404';
 *   return true;
 * }
 * ```
 */
export type PageMiddleware = (params: GuardParameters) => GuardResult

/**
 * Props for the Router component
 */
export type RouterProps = {
  /** Root route node from the routing tree */
  root: RouteNode
  /** Loading state component (default: "Loading...") */
  loading?: ReactNode
  /** 404 Not Found component (default: "404 Not Found") */
  missing?: ReactNode
  /** Error boundary fallback component */
  error?: ReactNode
  /** Access denied component for failed guards */
  accessDenied?: ReactNode
}

const ParamsContext = createContext<Record<string, string>>({})

/**
 * Hook to access route parameters.
 *
 * @returns Object containing route parameters
 *
 * @example
 * ```typescript
 * function UserProfile() {
 *   const { id } = useParams();
 *   return <div>User ID: {id}</div>;
 * }
 * ```
 */
export function useParams(): Record<string, string> {
  return useContext(ParamsContext)
}

/**
 * Hook to get the current pathname.
 * Updates when navigation occurs.
 *
 * @returns Current pathname
 *
 * @example
 * ```typescript
 * function Breadcrumbs() {
 *   const path = useCurrentPath();
 *   return <div>Current: {path}</div>;
 * }
 * ```
 */
export function useCurrentPath(): string {
  const [path, setPath] = useState(() => window.location.pathname)

  useEffect(() => {
    const handlePop = () => setPath(window.location.pathname)
    window.addEventListener("popstate", handlePop)
    return () => window.removeEventListener("popstate", handlePop)
  }, [])

  return path
}

/**
 * Information about the current route match
 */
export type CurrentMatch = {
  /** Matched route pattern (e.g., "/users/:id") */
  pattern: string
  /** Function to check if a path matches this route */
  matches: (path: string) => boolean
  /** Current pathname */
  path: string
  /** Route parameters */
  params: Record<string, string>
}

const CurrentMatchContext = createContext<CurrentMatch | null>(null)

/**
 * Hook to access current route match information.
 *
 * @returns Current match object or null
 *
 * @example
 * ```typescript
 * function RouteInfo() {
 *   const match = useCurrentMatch();
 *   if (!match) return null;
 *   return <div>Pattern: {match.pattern}</div>;
 * }
 * ```
 */
export function useCurrentMatch(): CurrentMatch | null {
  return useContext(CurrentMatchContext)
}

/**
 * Hook to get a navigation function.
 *
 * @returns Navigation function
 * @throws {Error} If used outside of a Router
 *
 * @example
 * ```typescript
 * function LoginButton() {
 *   const navigate = useNavigate();
 *   return <button onClick={() => navigate('/login')}>Login</button>;
 * }
 * ```
 */
export function useNavigate(): (path: string) => void {
  const match = useCurrentMatch()
  if (!match) throw new Error("useNavigate must be used within a Router")
  return useCallback((path: string) => {
    let href = path
    if (href !== "/" && href.endsWith("/")) {
      href = href.slice(0, -1)
    }
    navigate(href)
  }, [])
}

/**
 * Search/query parameters object
 */
export type SearchParams = {
  [key: string]: string
}

/**
 * Hook to access URL search/query parameters.
 *
 * @returns Object containing search parameters
 *
 * @example
 * ```typescript
 * function SearchResults() {
 *   const { q, page } = useSearchParams();
 *   return <div>Search: {q}, Page: {page}</div>;
 * }
 * ```
 */
export function useSearchParams(): SearchParams {
  const params = new URLSearchParams(window.location.search)
  const searchParams: SearchParams = {}
  for (const [key, value] of params.entries()) {
    searchParams[key] = value
  }
  return searchParams
}

/**
 * Set a URL search parameter without triggering a full navigation.
 *
 * @param key - Parameter key
 * @param value - Parameter value (null/undefined to remove)
 * @param reload - Whether to trigger a re-render (default: false)
 *
 * @example
 * ```typescript
 * // Set parameter
 * setSearchParam('page', 2);
 *
 * // Remove parameter
 * setSearchParam('filter', null);
 *
 * // Set and reload
 * setSearchParam('sort', 'desc', true);
 * ```
 */
export function setSearchParam(key: string, value: string | number | boolean | null | undefined, reload = false): void {
  if (!key || typeof key !== "string") {
    console.error("setSearchParam: key must be a non-empty string")
    return
  }

  const params = new URLSearchParams(window.location.search)
  if (value === null || value === undefined) {
    params.delete(key)
  } else {
    params.set(key, String(value))
  }
  const paramString = params.toString()
  const newUrl = `${window.location.pathname}${paramString ? `?${paramString}` : ""}`
  window.history.replaceState({}, "", newUrl)
  if (reload) {
    window.dispatchEvent(new PopStateEvent("popstate"))
  }
}

/**
 * Match a path against a pattern and extract parameters.
 * Used internally for route matching.
 *
 * @param pattern - Route pattern (e.g., "/users/:id")
 * @param path - Path to match (e.g., "/users/123")
 * @returns Parameters object or null if no match
 * @internal
 */
function matchPath(pattern: string, path: string): Record<string, string> | null {
  const patternParts = pattern.split("/").filter(Boolean)
  const pathParts = path.split("/").filter(Boolean)

  if (patternParts.length !== pathParts.length) return null

  const params: Record<string, string> = {}
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(":")) {
      const key = patternParts[i].slice(1)
      try {
        params[key] = decodeURIComponent(pathParts[i])
      } catch {
        // If decoding fails, use the raw value
        params[key] = pathParts[i]
      }
    } else if (patternParts[i] !== pathParts[i]) {
      return null
    }
  }
  return params
}

/**
 * Internal match result type
 * @internal
 */
type MatchResult = {
  component: React.ComponentType<any>
  pattern: string
  layouts: React.ComponentType<any>[]
  params: Record<string, string>
  guards: PageGuard[]
  middleware: PageMiddleware[]
  heads: HeadDefinition[]
}

/**
 * Find a matching route for the given path.
 *
 * @param root - Root route node
 * @param path - Path to match
 * @returns Match result or null
 * @internal
 */
export function findMatch(root: RouteNode, path: string): MatchResult | null {
  const m = match(path, root)
  if (!m) return null

  // Validate that we have a page component
  if (!m.names.page) {
    console.error(`No page component found for path: ${path}`)
    return null
  }

  const result: MatchResult = {
    component: m.names.page as React.ComponentType<any>,
    pattern: m.pattern,
    layouts: (m.stacks.layout || []) as React.ComponentType<any>[],
    params: m.params,
    guards: (m.stacks.guards || []) as PageGuard[],
    middleware: (m.stacks.middleware || []) as PageMiddleware[],
    heads: (m.stacks.heads || []) as HeadDefinition[],
  }
  return result
}

/**
 * Navigate to a new path (adds to browser history).
 *
 * @param path - Path to navigate to
 *
 * @example
 * ```typescript
 * navigate('/users/123');
 * navigate('/search?q=hello');
 * ```
 */
export function navigate(path: string): void {
  if (!path || typeof path !== "string") {
    console.error("navigate: path must be a non-empty string")
    return
  }

  // Save current scroll position before navigating
  const scrollPos = { x: window.scrollX, y: window.scrollY }
  window.history.replaceState({ ...window.history.state, scrollPos }, "")

  window.history.pushState({ scrollPos: { x: 0, y: 0 } }, "", path)
  window.dispatchEvent(new PopStateEvent("popstate"))
}

/**
 * Redirect to a new path (replaces current history entry).
 *
 * @param path - Path to redirect to
 *
 * @example
 * ```typescript
 * redirect('/login'); // Replace current page with login
 * ```
 */
export function redirect(path: string): void {
  if (!path || typeof path !== "string") {
    console.error("redirect: path must be a non-empty string")
    return
  }

  window.history.replaceState({ scrollPos: { x: 0, y: 0 } }, "", path)
  window.dispatchEvent(new PopStateEvent("popstate"))
}

/**
 * Internal component for client-side redirects
 * @internal
 */
function Navigate({ to }: { to: string }) {
  useEffect(() => {
    window.history.replaceState({ scrollPos: { x: 0, y: 0 } }, "", to)
    window.dispatchEvent(new PopStateEvent("popstate"))
  }, [to])
  return null
}

/**
 * Props for the Link component
 */
type LinkProps = {
  /** Path to navigate to */
  to: string
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">

/**
 * Link component for client-side navigation.
 *
 * @example
 * ```typescript
 * <Link to="/users">Users</Link>
 * <Link to="/profile" className="nav-link">Profile</Link>
 * ```
 */
export function Link({ to, children, className, onClick, ...rest }: LinkProps) {
  const href = to !== "/" && to.endsWith("/") ? to.slice(0, -1) : to
  const handleClick = (e: React.MouseEvent) => {
    // Allow normal browser navigation with modifier keys
    if (e.button === 0 && !e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey) {
      e.preventDefault()
      navigate(href)
    }
    onClick?.(e as any)
  }
  return (
    <a href={href} onClick={handleClick} className={className} {...rest}>
      {children}
    </a>
  )
}

class ErrorBoundary extends Component<{ children: ReactNode; fallback: ReactElement; resetKeys?: any[] }, { hasError: boolean }> {
  constructor(props: any) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("Router Error Boundary caught an error:", error, errorInfo)
  }

  componentDidUpdate(prevProps: any) {
    if (this.props.resetKeys && prevProps.resetKeys) {
      const resetKeysDifferent = this.props.resetKeys.some((key, index) => key !== prevProps.resetKeys[index])
      if (resetKeysDifferent && this.state.hasError) {
        this.setState({ hasError: false })
      }
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback
    }
    return this.props.children
  }
}

const ErrorPanel = () => {
  return (
    <div className="p-4 m-4 bg-slate-300 rounded-xl">
      <h1 className="mb-2">Error</h1>
      <p>An unexpected error has occurred. Please try to reload the page.</p>
      <p>
        <button onClick={() => window.location.reload()} className="mt-4">
          Reload page
        </button>
      </p>
    </div>
  )
}

/**
 * Props for the NavLink component
 */
type NavLinkProps = {
  /** Path to navigate to */
  to: string
  /** Function that receives active state and returns className */
  className?: ({ isActive }: { isActive: boolean }) => string
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "className" | "href">

/**
 * Navigation link component with active state support.
 *
 * The link is considered active if the current path matches the `to` prop
 * or starts with it (for sub-routes).
 *
 * @example
 * ```typescript
 * <NavLink
 *   to="/users"
 *   className={({ isActive }) => isActive ? 'active' : ''}
 * >
 *   Users
 * </NavLink>
 * ```
 */
export function NavLink({ to, className, children, ...rest }: NavLinkProps) {
  const match = useCurrentMatch()
  let href = to
  if (href !== "/" && href.endsWith("/")) {
    href = href.slice(0, -1)
  }
  let isActive = false
  if (match) {
    if (to === "/") {
      // Root path is only active when exactly on root
      isActive = match.path === "/"
    } else {
      // Other paths are active if current path matches or is a sub-route
      isActive = match.path === href || match.path.startsWith(href + "/")
    }
  }

  return (
    <Link to={to} className={className?.({ isActive })} {...rest}>
      {children}
    </Link>
  )
}

function getStateFromWindowLocation() {
  return {
    path: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash,
  }
}

/**
 * Main router component that handles client-side routing.
 *
 * Features:
 * - File-based routing with dynamic parameters
 * - Route guards for authentication
 * - Middleware for parameter validation
 * - Layout nesting
 * - Automatic scroll restoration
 * - Error boundaries
 *
 * @example
 * ```typescript
 * import { Router } from '@peaque/framework';
 *
 * function App() {
 *   return (
 *     <Router
 *       root={routeTree}
 *       loading={<LoadingSpinner />}
 *       missing={<NotFound />}
 *       accessDenied={<AccessDenied />}
 *     />
 *   );
 * }
 * ```
 */
export function Router({ root, loading = <div>Loading...</div>, missing = <div>404 Not Found</div>, error = <ErrorPanel />, accessDenied = <div>Access Denied</div> }: RouterProps): ReactElement {
  const [path, setPath] = useState(() => window.location.pathname)
  const [guardState, setGuardState] = useState<{
    status: "pending" | "allowed" | "redirect" | "denied" | "404"
    match?: MatchResult
    target?: string
  }>({ status: "pending" })

  useEffect(() => {
    // Take manual control of scroll restoration
    if (window.history.scrollRestoration) {
      window.history.scrollRestoration = "manual"
    }

    const handlePop = () => setPath(window.location.pathname)
    window.addEventListener("popstate", handlePop)

    // Continuously update scroll position in history state
    let scrollTimeout: NodeJS.Timeout | null = null
    const handleScroll = () => {
      if (scrollTimeout) clearTimeout(scrollTimeout)
      scrollTimeout = setTimeout(() => {
        const scrollPos = { x: window.scrollX, y: window.scrollY }
        window.history.replaceState({ ...window.history.state, scrollPos }, "")
      }, 100)
    }
    window.addEventListener("scroll", handleScroll)

    return () => {
      window.removeEventListener("popstate", handlePop)
      window.removeEventListener("scroll", handleScroll)
      if (scrollTimeout) clearTimeout(scrollTimeout)
    }
  }, [])

  useEffect(() => {
    const match = findMatch(root, path)
    if (!match) {
      setGuardState({ status: "404" })
      return
    }

    const runGuards = async () => {
      // Execute stackable guards first (auth checks, etc.)
      for (const guard of match.guards) {
        try {
          const result = await guard({
            path,
            params: match.params,
            pattern: match.pattern,
          })
          if (result === true) {
            continue
          } else if (typeof result === "string") {
            setGuardState({ status: "redirect", target: result })
            return
          } else {
            setGuardState({ status: "denied" })
            return
          }
        } catch (error) {
          console.error("Error in route guard:", error)
          setGuardState({ status: "denied" })
          return
        }
      }

      // Execute non-stackable middleware (parameter validation, etc.)
      for (const middleware of match.middleware) {
        try {
          const result = await middleware({
            path,
            params: match.params,
            pattern: match.pattern,
          })
          if (result === true) {
            continue
          } else if (typeof result === "string") {
            setGuardState({ status: "redirect", target: result })
            return
          } else {
            setGuardState({ status: "denied" })
            return
          }
        } catch (error) {
          console.error("Error in route middleware:", error)
          setGuardState({ status: "denied" })
          return
        }
      }

      setGuardState({ status: "allowed", match })
    }

    setGuardState({ status: "pending" })
    runGuards()
  }, [path, root])

  // Handle scroll position after navigation
  useEffect(() => {
    if (guardState.status === "allowed") {
      const scrollPos = window.history.state?.scrollPos
      const currentScrollY = window.scrollY

      // Wait for content to render and async data to load
      const timeoutId = setTimeout(() => {
        // Only scroll if user hasn't scrolled yet (avoid jarring jumps)
        if (Math.abs(window.scrollY - currentScrollY) < 50) {
          if (scrollPos) {
            // Restore saved scroll position (back/forward navigation)
            window.scrollTo(scrollPos.x, scrollPos.y)
          } else {
            // Scroll to top (new navigation)
            window.scrollTo(0, 0)
          }
        }
      }, 50)

      return () => clearTimeout(timeoutId)
    }
  }, [guardState])

  if (guardState.status === "404") return <>{missing}</>
  if (guardState.status === "pending") return <>{loading}</>
  if (guardState.status === "redirect") return <Navigate to={guardState.target!} />
  if (guardState.status === "denied") return <>{accessDenied}</>

  if (!guardState.match) return <>{missing}</>

  const { component: Component, layouts, params, pattern, heads } = guardState.match
  document.title = heads.filter((h) => h.title).at(-1)?.title || "Peaque App"
  const content = layouts.reduceRight(
    (child, Layout) => <Layout>{child}</Layout>,
    <ErrorBoundary fallback={<>{error}</>} resetKeys={[path]}>
      <Component {...params} />
    </ErrorBoundary>
  )

  return (
    <CurrentMatchContext.Provider value={{ params, pattern, path, matches: (path) => matchPath(pattern, path) != null }}>
      <ParamsContext.Provider value={params}>{content}</ParamsContext.Provider>
    </CurrentMatchContext.Provider>
  )
}
