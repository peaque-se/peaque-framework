import type { ReactElement, ReactNode } from "react"
import { Component, useCallback, useEffect } from "react"
import { match, RouteNode } from "../router/router.js"
import type { HeadDefinition } from "./head.js"
import { useRouterResult } from "./useRouterResult.js"

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

export type SearchParams = Record<string, string>

export type Location = {
  path: string
  search: string
  hash: string
  searchParams: SearchParams
}

export type CurrentMatch = {
  pattern: string
  matches: (path: string) => boolean
  path: string
  location: Location
  params: Record<string, string>
}

// const CurrentMatchContext = createContext<CurrentMatch | null>(null)

export function useCurrentMatch() {
  return useRouterResult().match
}

export function useParams(): Record<string, string> {
  const match = useCurrentMatch()
  if (!match) throw new Error("useParams must be used within a Router")
  return match.params
}

export function useCurrentPath(): string {
  const match = useCurrentMatch()
  if (!match) throw new Error("useCurrentPath must be used within a Router")
  return match.path
}

export function useNavigate() {
  const match = useCurrentMatch()
  if (!match) throw new Error("useNavigate must be used within a Router")
  return useCallback((path: string) => {
    navigate(path)
  }, [])
}

export function useSearchParams(): SearchParams {
  const match = useCurrentMatch()
  if (!match) throw new Error("useSearchParams must be used within a Router")
  return match.location.searchParams
}

export function setSearchParam(key: string, value: string | number | boolean | null | undefined, reload = false) {
  const location = extractLocationFromWindow()
  const params = { ...location.searchParams }
  if (value === null || value === undefined) {
    delete params[key]
  } else {
    params[key] = String(value)
  }
  const newLocation = { ...location, searchParams: params }
  const newHref = locationToHref(newLocation)
  navigate(newHref, { replace: !reload })
}

export function matchPath(pattern: string, path: string): Record<string, string> | null {
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

export function navigate(path: string, options: { replace?: boolean } = { replace: false }) {
  // normalize path by removing trailing slash (except for root)
  let href = path
  if (href !== "/" && href.endsWith("/")) {
    href = href.slice(0, -1)
  }

  // Save current scroll position before navigating
  const scrollPos = { x: window.scrollX, y: window.scrollY }
  window.history.replaceState({ ...window.history.state, scrollPos }, "")

  if (options.replace) {
    window.history.replaceState({ scrollPos: { x: 0, y: 0 } }, "", href)
  } else {
    window.history.pushState({ scrollPos: { x: 0, y: 0 } }, "", href)
  }
  window.dispatchEvent(new PopStateEvent("popstate"))
}

export function redirect(path: string) {
  navigate(path, { replace: true })
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
  const href = to !== "/" && to.endsWith("/") ? to.slice(0, -1) : to
  const handleClick = (e: React.MouseEvent) => {
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

class ErrorBoundary extends Component<{ children: ReactNode; fallback: ReactElement; resetKey: string }, { hasError: boolean }> {
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
    if (this.props.resetKey && prevProps.resetKey) {
      const resetKeysDifferent = this.props.resetKey !== prevProps.resetKey
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

const locationCache = new Map<string, Location>()

function extractLocationFromWindow(): Location {
  const href = window.location.href
  if (locationCache.has(href)) {
    return locationCache.get(href)!
  }

  const searchParams = new URLSearchParams(window.location.search)
  const paramsObj: SearchParams = {}
  searchParams.forEach((value, key) => {
    paramsObj[key] = value
  })
  const location = {
    path: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash,
    searchParams: paramsObj,
  }
  locationCache.set(href, location)
  return location
}

function locationToHref(location: Location): string {
  const params = new URLSearchParams(location.searchParams).toString()
  return `${location.path}${params ? `?${params}` : ""}${location.hash}`
}

export function Router({ root, loading = <div>Loading...</div>, missing = <div>404 Not Found</div>, error = <ErrorPanel />, accessDenied = <div>Access Denied</div> }: RouterProps): ReactElement {
  const res = useRouterResult(root)

  if (res.status === "pending") {
    return <>{loading}</>
  }
  if (res.status === "404") {
    return <>{missing}</>
  }
  if (res.status === "denied") {
    return <>{accessDenied}</>
  }
  if (res.status === "redirect") {
    return <Navigate to={res.match?.path || "/"} />
  }
  if (res.match === null) {
    return <>{missing}</>
  }

  if (res.title) document.title = res.title

  // render the matched component within the layout hierarchy
  const Component = res.content!
  const layouts = res.layouts || []
  const params = res.match.params || {}

  const content = layouts.reduceRight(
    (child, Layout) => <Layout>{child}</Layout>,
    <ErrorBoundary fallback={<>{error}</>} resetKey={res.match!.path}>
      <Component {...params} />
    </ErrorBoundary>
  )

  return <>{content}</>
}
