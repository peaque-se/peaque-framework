import { PeaqueRequest, MatchingRoute } from "./http-types"
import { HttpMethod } from "./http-types"

class RouteNode {
  children: Map<string, RouteNode> = new Map()
  paramChild?: { name: string; node: RouteNode }
  handler?: (req: PeaqueRequest) => Promise<void> | void
  originalPath?: string
}

export class Router {
  private routes: Map<HttpMethod, RouteNode> = new Map()

  // add a route to the router. the path can contain parameters like /api/user/:id/list
  // e.g. /api/user/:userId/post/:postId
  // the parameters will be extracted and returned in the MatchingRoute object
  addRoute(method: HttpMethod, path: string, handler: (req: PeaqueRequest) => Promise<void> | void) {
    if (!this.routes.has(method)) {
      this.routes.set(method, new RouteNode())
    }
    const root = this.routes.get(method)!
    const parts = path.split("/").filter((p) => p !== "")
    let current = root
    for (const part of parts) {
      if (part.startsWith(":")) {
        const paramName = part.slice(1)
        if (!current.paramChild) {
          current.paramChild = { name: paramName, node: new RouteNode() }
        }
        current = current.paramChild.node
      } else {
        if (!current.children.has(part)) {
          current.children.set(part, new RouteNode())
        }
        current = current.children.get(part)!
      }
    }
    current.handler = handler
    current.originalPath = path
  }

  getMatchingRoute(method: HttpMethod, path: string): MatchingRoute | undefined {
    const root = this.routes.get(method)
    if (!root) return undefined
    const parts = path.split("/").filter((p) => p !== "")
    let current = root
    const params: Record<string, string> = {}
    for (const part of parts) {
      if (current.children.has(part)) {
        current = current.children.get(part)!
      } else if (current.paramChild) {
        params[current.paramChild.name] = part
        current = current.paramChild.node
      } else {
        return undefined
      }
    }
    if (current.handler) {
      return {
        method,
        path: current.originalPath!,
        parameters: params,
        handler: current.handler,
      }
    }
    return undefined
  }

  reset(): void {
    this.routes.clear()
  }
}
