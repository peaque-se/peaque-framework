import { FastifyReply, FastifyRequest } from "fastify"
import { CookieJarImpl, PeaqueRequestImpl } from "./api-router.js"
import type { HttpMethod, PeaqueRequest } from "./public-types.js"

export function createPeaqueRequestFromFastify(req: FastifyRequest): PeaqueRequest {
  const url = req.raw.url || "/"
  const requestPath = url.split("?")[0] || "/"
  return new PeaqueRequestImpl(req.body, req.params as Record<string, string>, req.query as Record<string, string | string[]>, req.headers as Record<string, string | string[]>, req.method as HttpMethod, requestPath, url, req.ip, req.headers.cookie)
}

export function writePeaqueRequestToFastify(request: PeaqueRequest, reply: FastifyReply) {
  if (request instanceof PeaqueRequestImpl) {
    // set status code
    reply.status(request.statusCode)
    // set content type
    if (request.contentType) {
      reply.header("Content-Type", request.contentType)
    }
    // set headers
    for (const [key, values] of Object.entries(request.headersData)) {
      for (const value of values) {
        reply.header(key, value)
      }
    }
    // add cookie headers from the cookie jar
    const cookies = request.cookies() as CookieJarImpl
    const cookieHeader = cookies.getSetCookieHeaders()
    if (cookieHeader.length > 0) {
      for (const cookie of cookieHeader) {
        reply.header("Set-Cookie", cookie)
      }
    }

    // set body
    if (request.sendData !== undefined) {
      reply.send(request.sendData)
    } else {
      reply.send()
    }
  } else {
    throw new Error("writePeaqueRequestToFastify: request is not an instance of PeaqueRequestImpl")
  }
}
