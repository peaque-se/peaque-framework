import { createContext, useContext, useEffect, useState, Component, useCallback } from "react"
import type { ReactElement, ReactNode } from "react"
import type { HeadDefinition } from "./head.js"
import { match, RouteNode } from "../router/router.js"

export type GuardResult = boolean | string | Promise<boolean | string>
export type GuardParameters = { path: string; params: Record<string, string>; pattern: string }
export type PageGuard = (params: GuardParameters) => GuardResult
export type PageMiddleware = (params: GuardParameters) => GuardResult


export type RouterProps = {
  root: RouteNode
  loading?: ReactNode
  missing?: ReactNode
  error?: ReactNode
  accessDenied?: ReactNode
}

const ParamsContext = createContext<Record<string, string>>({})
export function useParams() {
  return useContext(ParamsContext)
}

export function useCurrentPath() {
  const [path, setPath] = useState(() => window.location.pathname)

  useEffect(() => {
    const handlePop = () => setPath(window.location.pathname)
    window.addEventListener("popstate", handlePop)
    return () => window.removeEventListener("popstate", handlePop)
  }, [])

  return path
}

export type CurrentMatch = {
  pattern: string
  matches: (path: string) => boolean
  location: Location
  params: Record<string, string>
}
const CurrentMatchContext = createContext<CurrentMatch | null>(null)
export function useCurrentMatch() {
  return useContext(CurrentMatchContext)
}

export function useNavigate() {
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

export type SearchParams = {
  [key: string]: string
}
export function useSearchParams(): SearchParams {
  const params = new URLSearchParams(window.location.search)
  const searchParams: SearchParams = {}
  for (const [key, value] of params.entries()) {
    searchParams[key] = value
  }
  return searchParams
}
export function setSearchParam(key: string, value: string | number | boolean | null | undefined, reload = false) {
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

function matchPath(pattern: string, path: string): Record<string, string> | null {
  const patternParts = pattern.split("/").filter(Boolean)
  const pathParts = path.split("/").filter(Boolean)

  if (patternParts.length !== pathParts.length) return null

  const params: Record<string, string> = {}
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(":")) {
      const key = patternParts[i].slice(1)
      params[key] = pathParts[i]
    } else if (patternParts[i] !== pathParts[i]) {
      return null
    }
  }
  return params
}

type MatchResult = {
  component: React.ComponentType<any>
  pattern: string
  layouts: React.ComponentType<any>[]
  params: Record<string, string>
  guards: PageGuard[]
  middleware: PageMiddleware[]
  heads: HeadDefinition[]
}

export function findMatch(root: RouteNode, path: string): MatchResult | null {
  const m = match(path, root)
  if (!m) return null
  const result : MatchResult = {
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

export function navigate(path: string) {
  // Save current scroll position before navigating
  const scrollPos = { x: window.scrollX, y: window.scrollY }
  window.history.replaceState({ ...window.history.state, scrollPos }, "")

  window.history.pushState({ scrollPos: { x: 0, y: 0 } }, "", path)
  window.dispatchEvent(new PopStateEvent("popstate"))
}

export function redirect(path: string) {
  window.history.replaceState({ scrollPos: { x: 0, y: 0 } }, "", path)
  window.dispatchEvent(new PopStateEvent("popstate"))
}

function Navigate({ to }: { to: string }) {
  useEffect(() => {
    window.history.replaceState({ scrollPos: { x: 0, y: 0 } }, "", to)
    window.dispatchEvent(new PopStateEvent("popstate"))
  }, [to])
  return null
}

type LinkProps = {
  to: string
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">

export function Link({ to, children, className, onClick, ...rest }: LinkProps) {
  const href = (to !== "/" && to.endsWith("/")) ? to.slice(0, -1) : to
  const handleClick = (e: React.MouseEvent) => {
    if (e.button === 0 && !e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey) {
      e.preventDefault()
      navigate(href)
    }
    onClick?.(e as any)
  }
  return (<a href={href} onClick={handleClick} className={className} {...rest}>{children}</a>)
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

type NavLinkProps = {
  to: string
  className?: ({ isActive }: { isActive: boolean }) => string
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "className" | "href">

export function NavLink({ to, className, children, ...rest }: NavLinkProps) {
  const match = useCurrentMatch()
  let href = to
  if (href !== "/" && href.endsWith("/")) {
    href = href.slice(0, -1)
  }
  let isActive = false
  if (match) {
    if (to === "/") {
      isActive = match.location.path === "/"
    } else {
      isActive = match.location.path === href || match.location.path.startsWith(href + "/")
    }
  }

  return (
    <Link to={to} className={className?.({ isActive })} {...rest}>
      {children}
    </Link>
  )
}

type Location = {
  path: string
  search: string
  hash: string
}

function extractLocationFromWindow(): Location {
  return {
    path: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash,
  }
}

export function Router({ root, loading = <div>Loading...</div>, missing = <div>404 Not Found</div>, error = <ErrorPanel />, accessDenied = <div>Access Denied</div> }: RouterProps): ReactElement {
  const [location, setLocation] = useState(() => extractLocationFromWindow())
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

    const handlePop = () => setLocation(extractLocationFromWindow())
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
    const match = findMatch(root, location.path)
    if (!match) {
      setGuardState({ status: "404" })
      return
    }

    const runGuards = async () => {
      // Execute stackable guards first (auth checks, etc.)
      for (const guard of match.guards) {
        try {
          const result = await guard({
            path: location.path,
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
        } catch {
          setGuardState({ status: "denied" })
          return
        }
      }

      // Execute non-stackable middleware (parameter validation, etc.)
      for (const middleware of match.middleware) {
        try {
          const result = await middleware({
            path: location.path,
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
        } catch {
          setGuardState({ status: "denied" })
          return
        }
      }

      setGuardState({ status: "allowed", match })
    }

    setGuardState({ status: "pending" })
    runGuards()
  }, [location, root])

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
    <ErrorBoundary fallback={<>{error}</>} resetKeys={[location]}>
      <Component {...params} />
    </ErrorBoundary>
  )

  return (
    <CurrentMatchContext.Provider value={{ params, pattern, location, matches: (path) => matchPath(pattern, path) != null }}>
      <ParamsContext.Provider value={params}>{content}</ParamsContext.Provider>
    </CurrentMatchContext.Provider>
  )
}
