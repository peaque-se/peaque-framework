// Main exports for the Peaque framework
export {
  Router,
  Link,
  NavLink,
  useParams,
  useNavigate,
  useCurrentPath,
  useCurrentMatch,
  useSearchParams,
  setSearchParam,
  navigate,
  redirect
} from './client/client-router.js';

export type {
  RouterProps,
  PageGuard,
  PageMiddleware,
  GuardParameters,
  GuardResult,
  CurrentMatch,
  SearchParams
} from './client/client-router.js';

export type {
  HeadDefinition
} from './client/head.js';

// API Router Types
export type {
  PeaqueRequest,
  RequestHandler,
  RequestMiddleware,
  HttpMethod,
  CookieOptions,
  CookieJar,
} from './http/http-types.js';

export {
  InterruptFurtherProcessing
} from './exceptions/index.js';

export type {
  RouteNode
} from './router/router.js';