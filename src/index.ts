// Main exports for the Peaque framework

export {
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
  Guard,
  GuardResult,
  CurrentMatch,
  SearchParams
} from './client/router.js';


// API Router Types
export type {
  PeaqueRequest,
  PeaqueReply,
  RouteHandler,
  RouteDefinition,
  HttpMethod,
  FrameworkConfig,
  BuildResult,
} from './types.js';

