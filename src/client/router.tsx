import { createContext, useContext, useEffect, useState, Component, useCallback } from "react"
import type { ReactElement, ReactNode } from "react"
import type { HeadDefinition } from "./head.js"

export type GuardResult = boolean | string | Promise<boolean | string>
export type Guard = () => GuardResult

export type Route = {
  path?: string
  param?: string
  page?: React.ComponentType<any>
  layout?: React.ComponentType<any>
  children?: Route[]
  guard?: Guard
  head?: HeadDefinition
  prefixLinks?: boolean
}

export type RouterProps = {
  root: Route
  fallback?: ReactNode
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
  path: string
  linkPrefix: string
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
      let href = match.linkPrefix + path
      if (href !== "/" && href.endsWith("/")) {
        href = href.slice(0, -1)
      }
      navigate(href)
    }, [match.linkPrefix])
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
  linkPrefix: string
  layouts: React.ComponentType<any>[]
  params: Record<string, string>
  guards: Guard[]
  heads: HeadDefinition[]
}

function findMatch(root: Route, path: string): MatchResult | null {
  const layoutStack: React.ComponentType<any>[] = [...root.layout ? [root.layout] : []]
  const guardStack: Guard[] = [...root.guard ? [root.guard] : []]
  const headStack: HeadDefinition[] = [...root.head ? [root.head] : []]
  const pattern = []

  // divide the path into segments and traverse the route tree, one segment at a time until we find a match or exhaust the tree
  // nodes in the tree can have a path (static segment) or param (dynamic segment)
  // at each segment, we look for a matching child route (static first, then dynamic)
  // if we find a match, we push its layout and guard onto the stack (if any) and continue to the next segment
  // if we don't find a match, we stop and return null
  // if we exhaust all segments and are at a route with a component, we have a match
  const segments = path === "/" ? [] : path.split("/")
  let currentRoutes: Route[] = [root]
  let params: Record<string, string> = {}

  let matchedRoute: Route | null = root
  for (const segment of segments) {
    for (const route of currentRoutes) {
      matchedRoute = null
      if (route.param) {
        params[route.param] = segment
        pattern.push(`:${route.param}`)
      } else if (route.path === segment || (!route.path && segment === "")) {
        pattern.push(route.path)
      } else {
        continue
      }
      if (route.layout) layoutStack.push(route.layout)
      if (route.guard) guardStack.push(route.guard)
      if (route.head) headStack.push(route.head)
      matchedRoute = route
      break
    }
    if (matchedRoute) {
      currentRoutes = matchedRoute.children || []
      pattern.push(matchedRoute.path || "")
    } else {
      return null
    }
  }
  // After processing all segments, check if we have a matching route with a component
  if (matchedRoute) {
    if (matchedRoute.page) {
      return {
        component: matchedRoute.page,
        pattern: pattern.join("/"),
        linkPrefix: "",
        layouts: layoutStack,
        params,
        guards: guardStack,
        heads: headStack
      }
    }
  }
  return null
}

export function navigate(path: string) {
  window.history.pushState(null, "", path)
  window.dispatchEvent(new PopStateEvent("popstate"))
}

function Navigate({ to }: { to: string }) {
  useEffect(() => {
    window.history.replaceState(null, "", to)
    window.dispatchEvent(new PopStateEvent("popstate"))
  }, [to])
  return null
}

type LinkProps = {
  to: string
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">

export function Link({ to, children, className, ...rest }: LinkProps) {
  const currentMatch = useCurrentMatch()
  let href = (currentMatch?.linkPrefix ?? "") + to
  if (href !== "/" && href.endsWith("/")) {
    href = href.slice(0, -1)
  }

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault()
    navigate(href)
  }

  return (
    <a href={href} onClick={onClick} className={className} {...rest}>
      {children}
    </a>
  )
}

class ErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactElement; resetKeys?: any[] },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Router Error Boundary caught an error:', error, errorInfo);
  }

  componentDidUpdate(prevProps: any) {
    if (this.props.resetKeys && prevProps.resetKeys) {
      const resetKeysDifferent = this.props.resetKeys.some((key, index) => 
        key !== prevProps.resetKeys[index]
      );
      if (resetKeysDifferent && this.state.hasError) {
        this.setState({ hasError: false });
      }
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

const ErrorPanel = () => {
  return (
    <div className="p-4 m-4 bg-slate-300 rounded-xl">
      <h1 className="mb-2">Error</h1>
      <p>An unexpected error has occurred. Please try to reload the page.</p>
      <p><button onClick={()=>window.location.reload()} className="mt-4">Reload page</button></p>
    </div>
  )
}

type NavLinkProps = {
  to: string
  className?: ({ isActive }: { isActive: boolean }) => string
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "className" | "href">

export function NavLink({ to, className, children, ...rest }: NavLinkProps) {
  const match = useCurrentMatch()
  let href = (match?.linkPrefix ?? "") + to
  if (href !== "/" && href.endsWith("/")) {
    href = href.slice(0, -1)
  }
  let isActive = false
  if (match) {
    if (to === "/") {
      isActive = match.path === match.linkPrefix
    } else {
      isActive = match.path === href || match.path.startsWith(href + "/")
    }
  }

  return (
    <Link to={to} className={className?.({ isActive })} {...rest}>
      {children}
    </Link>
  )
}

export function Router({ root, fallback = <div>Loading...</div> }: RouterProps): ReactElement {
  const [path, setPath] = useState(() => window.location.pathname)
  const [guardState, setGuardState] = useState<{
    status: "pending" | "allowed" | "redirect" | "denied" | "404"
    match?: MatchResult
    target?: string
  }>({ status: "pending" })

  useEffect(() => {
    const handlePop = () => setPath(window.location.pathname)
    window.addEventListener("popstate", handlePop)
    return () => window.removeEventListener("popstate", handlePop)
  }, [])

  useEffect(() => {
    const match = findMatch(root, path)
    if (!match) {
      setGuardState({ status: "404" })
      return
    }

    const runGuards = async () => {
      for (const guard of match.guards) {
        try {
          const result = await guard()
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
  }, [path, root])

  if (guardState.status === "404") return <div>404 Not Found</div>
  if (guardState.status === "pending") return <>{fallback}</>
  if (guardState.status === "redirect") return <Navigate to={guardState.target!} />
  if (guardState.status === "denied") return <div>Access Denied</div>

  if (!guardState.match) return <div>404 Not Found</div>

  const { component: Component, layouts, params, pattern, linkPrefix, heads } = guardState.match
  document.title = heads.find(h => h.title)?.title || "Peaque App"
  const content = layouts.reduceRight(
    (child, Layout) => <Layout>{child}</Layout>,
    <ErrorBoundary fallback={<ErrorPanel/>} resetKeys={[path]}>
      <Component {...params} />
    </ErrorBoundary>
  )

  return (
    <CurrentMatchContext.Provider value={{ params, pattern, linkPrefix, path, matches: (path) => matchPath(pattern, linkPrefix + path) != null }}>
      <ParamsContext.Provider value={params}>{content}</ParamsContext.Provider>
    </CurrentMatchContext.Provider>
  )
}