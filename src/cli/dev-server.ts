import { generateBackendProgram, GeneratedBackendProgram } from "../compiler/backend-generator.js"
import { buildPageRouter, generatePageRouterJS, PageRouter } from "../compiler/frontend-generator.js"
import { HttpServer } from "../http/http-server.js"
import { PeaqueRequest } from "../http/http-types.js"

/// fifteenth attempt at a dev server that reloads even better, but is still fast
export class DevServer {
  private basePath: string
  private port: number
  private noStrict: boolean
  private server: HttpServer
  private frontend?: PageRouter
  private backend?: GeneratedBackendProgram

  constructor(basePath: string, port: number, noStrict: boolean) {
    this.basePath = basePath
    this.port = port
    this.noStrict = noStrict
    this.server = new HttpServer(this.requestHandler.bind(this))

    buildPageRouter(this.basePath).then((router) => {
      this.frontend = router
    })

    generateBackendProgram({baseDir: this.basePath, importPrefix: "../src/"}).then((program) => {
      this.backend = program
    })
  }

  async start() {
    await this.server.startServer(this.port)
    console.log(`🚀  Peaque Dev Server running at http://localhost:${this.port}`)
  }

  private requestHandler(req: PeaqueRequest) {
    const path = req.path()
    console.log(`Request for ${path}`)

    // if path starts with /@src/ or /@deps/, serve from filesystem
    if (path.startsWith("/@src/") || path.startsWith("/@deps/")) {
      //return this.serveFile(req)
    }

    // if path starts with /api/, handle API requests
    if (path.startsWith("/api/")) {
      //return this.handleApiRequest(req)
    }

    // if the path is /peaque.js, serve the Peaque runtime
    if (path === "/peaque.js") {
      //return this.servePeaqueRuntime(req)
    }

    // if the path is /peaque.css, serve the Peaque CSS
    if (path === "/peaque.css") {
      //return this.servePeaqueCss(req)
    }

    // if the file exists in the public directory, serve it
    // if (this.publicDir && this.fileExistsInPublicDir(path)) {
    //   return this.serveFileFromPublicDir(req)
    // }
    // otherwise, serve the main application page
    //return this.serveMainPage(req)
  }
}


const devServer = new DevServer("C:\\projects\\peaque-claude-experiments\\peaque-manager-coach", 3000, false)
devServer.start()
