import { useSyncExternalStore } from "react"
import { RouteNode } from "../router/router.js"
import { CurrentMatch, findMatch, Location, matchPath } from "./client-router.js"
import equal from "fast-deep-equal"

const currentRoot: { root: RouteNode | null } = { root: null }

const listener = async () => {
  if (currentRoot.root) {
    await pageChanged(currentRoot.root, document.location.href)
  }
}

function init() {
  if (typeof window === "undefined") return
  window.addEventListener("popstate", listener)
  listener()
}
init()

export type RouterResult = {
  status: "pending" | "allowed" | "redirect" | "denied" | "404"
  match: CurrentMatch | null
  layouts: React.ComponentType<{ children: React.ReactNode }>[] | null
  content: React.ComponentType<any> | null
  title: string | null
}

export function useRouterResult(root?: RouteNode): RouterResult {
  if (root && root !== currentRoot.root) {
    currentRoot.root = root
    listener()
  }

  return useSyncExternalStore<RouterResult>(subscribe, getSnapshot)
}

let routedHref = "" as string
async function pageChanged(root: RouteNode, href: string) {
  if (routedHref === href) return
  routedHref = href
  const path = new URL(href).pathname
  const match = findMatch(root, path)
  if (!match) {
    setCurrentRouterResult({ status: "404", match: null, layouts: null, content: null, title: null })
    return
  }

  const guardsAndMiddlewares = [...match.guards, ...match.middleware]

  if (guardsAndMiddlewares.length > 0) {
    setCurrentRouterResult({ status: "pending", match: null, layouts: null, content: null, title: null })
    for (const guard of guardsAndMiddlewares) {
      try {
        const guardResult = await guard({ params: match.params, path, pattern: match.pattern })
        if (guardResult === true) {
          continue
        } else if (typeof guardResult === "string") {
          window.history.pushState(null, "", guardResult) // immediate redirect
          window.dispatchEvent(new PopStateEvent("popstate"))
          return
        } else {
          setCurrentRouterResult({ status: "denied", match: null, layouts: null, content: null, title: null })
          return
        }
      } catch (e) {
        setCurrentRouterResult({ status: "denied", match: null, layouts: null, content: null, title: null })
        return
      }
    }
  }

  const searchParams = { ...Object.fromEntries(new URLSearchParams(window.location.search).entries()) }

  const location: Location = {
    path,
    search: window.location.search,
    hash: window.location.hash,
    searchParams,
  }

  const resultMatch: CurrentMatch = {
    params: match.params,
    pattern: match.pattern,
    location,
    path,
    matches: (path) => matchPath(match.pattern, path) != null,
  }

  const title = match.heads.filter((h) => h.title).at(-1)?.title || "Peaque App"

  setCurrentRouterResult({ status: "allowed", match: resultMatch, layouts: match.layouts, content: match.component, title })

  window.dispatchEvent(new CustomEvent("routeChange", { detail: { path, location, title } }))
}

/// Below here is the external store implementation for the router state
function setCurrentRouterResult(value: RouterResult) {
  if (currentRouterResult.current.status === value.status && equal(currentRouterResult.current, value)) return
  currentRouterResult.current = value
  notifySubscribers()
}
const subscribers: Set<() => void> = new Set()
const currentRouterResult: { current: RouterResult } = { current: { status: "pending", match: null, content: null, title: null, layouts: null } }
function subscribe(callback: () => void) {
  subscribers.add(callback)
  return () => subscribers.delete(callback)
}
function notifySubscribers() {
  for (const callback of subscribers) {
    callback()
  }
}
function getSnapshot(): RouterResult {
  return currentRouterResult.current
}
