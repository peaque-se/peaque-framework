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
  navigate
} from './client/router.js';

export type {
  Route,
  RouterProps,
  Guard,
  GuardResult,
  CurrentMatch,
  SearchParams
} from './client/router.js';

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
