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


// API Router Types
export type {
  PeaqueRequest,
  RouteHandler,
  HttpMethod,
  CookieOptions,
  CookieJar,
} from './public-types.js';

// Head Management Types
export type {
  HeadConfig,
  ResolvedHeadConfig,
  MetaTag,
  LinkTag,
  ScriptTag,
  IconConfig,
} from './public-types.js';


