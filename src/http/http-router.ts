import { MatchingRoute, RequestHandler, RequestMiddleware, PeaqueRequest } from "./http-types.js"
import { HttpMethod } from "./http-types.js"

class RouteNode {
  children: Map<string, RouteNode> = new Map()
  paramChild?: { name: string; node: RouteNode }
  wildcardChild?: { name: string; node: RouteNode }
  handler?: RequestHandler
  originalPath?: string
  middleware: RequestMiddleware[] = [] // Middleware stack for this route
}

export class Router {
  private routes: Map<HttpMethod, RouteNode> = new Map()
  private middlewareStack: RequestMiddleware[] = [] // Global middleware stack
  // add a route to the router. the path can contain parameters like /api/user/:id/list
  // e.g. /api/user/:userId/post/:postId
  // wildcard routes like /file/download/*filepath will capture the rest of the path
  // the parameters will be extracted and returned in the MatchingRoute object
  addRoute(method: HttpMethod, path: string, handler: RequestHandler): Router {
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
      } else if (part.startsWith("*")) {
        const wildcardName = part.length > 1 ? part.slice(1) : "wildcard"
        if (!current.wildcardChild) {
          current.wildcardChild = { name: wildcardName, node: new RouteNode() }
        }
        current = current.wildcardChild.node
      } else {
        if (!current.children.has(part)) {
          current.children.set(part, new RouteNode())
        }
        current = current.children.get(part)!
      }
    }
    current.handler = handler
    current.originalPath = path
    current.middleware = [...this.middlewareStack] // Copy current middleware stack
    return this
  }

  // Add middleware to the stack that will be applied to subsequent routes
  use(middleware: RequestMiddleware): Router {
    const newRouter = new Router()
    // Share the same route tree
    newRouter.routes = this.routes
    // Copy the middleware stack and add the new middleware
    newRouter.middlewareStack = [...this.middlewareStack, middleware]
    return newRouter
  }

  getMatchingRoute(method: HttpMethod, path: string): MatchingRoute | undefined {
    const root = this.routes.get(method)
    if (!root) return undefined
    const parts = path.split("/").filter((p) => p !== "")
    let current = root
    const params: Record<string, string> = {}

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]

      if (current.children.has(part)) {
        current = current.children.get(part)!
      } else if (current.paramChild) {
        params[current.paramChild.name] = part
        current = current.paramChild.node
      } else if (current.wildcardChild) {
        // Wildcard matches the rest of the path
        const remainingPath = parts.slice(i).join("/")
        params[current.wildcardChild.name] = remainingPath
        current = current.wildcardChild.node
        break // Wildcard consumes the rest of the path
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
        middleware: current.middleware,
      }
    }
    return undefined
  }

  getRequestHandler(): RequestHandler {
    return async (req) => {
      const method = req.method()
      const path = req.path()
      const matchingRoute = this.getMatchingRoute(method, path)
      if (matchingRoute) {
        for (const [key, value] of Object.entries(matchingRoute.parameters)) {
          req.setPathParam(key, value)
        }
        if (matchingRoute.middleware.length > 0) {
          await executeMiddlewareChain(req, matchingRoute.middleware, matchingRoute.handler)
        } else {
          return await matchingRoute.handler(req)
        }
      }
    }
  }

  reset(): void {
    // Only reset this instance's middleware stack, keep shared routes
    this.middlewareStack = []
  }
}

export async function executeMiddlewareChain(req: PeaqueRequest, middleware: RequestMiddleware[], finalHandler: RequestHandler): Promise<void> {
  // if any middleware is missing, throw an error
  if (middleware.some(mw => typeof mw !== 'function')) {
    throw new Error("⚠️  Error: One or more middleware functions are not valid.")
  }
  let index = 0
  const next = async (): Promise<void> => {
    if (index < middleware.length) {
      const currentMiddleware = middleware[index]
      index++
      await currentMiddleware(req, next)
    } else {
      await finalHandler(req)
    }
  }

  await next()
}
