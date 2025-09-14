# Peaque Framework

> The last JavaScript framework ever to be needed

Peaque is a modern, full-stack TypeScript web framework that combines file-based routing with React, built-in Tailwind CSS, and advanced Hot Module Replacement (HMR). Built from the ground up for developer productivity with zero configuration.

## ✨ Features

### 🚀 **Zero Configuration**
- Get started instantly with no setup required
- Automatic Tailwind CSS 4 configuration with PostCSS
- Built-in TypeScript support with path resolution
- Smart `src/` based project structure detection
- Environment variable loading with `.env` support

### 📁 **File-Based Routing**
- **Pages**: Create routes with `src/pages/**/page.tsx` files
- **API Routes**: Build APIs with `src/api/**/route.ts` files using HTTP method exports
- **Layouts**: Wrap pages with `src/pages/**/layout.tsx` files for shared UI
- **Route Guards**: Protect routes with `src/pages/**/guard.ts` files
- **Dynamic Routes**: Use `[param]` folders for parameterized routes
- **WebSocket Support**: Full WebSocket integration with upgrade handling

### ⚡ **Advanced Development Experience**
- **Sophisticated HMR**: WebSocket-based hot reloading with incremental rebuilds
- **Fast Builds**: Powered by esbuild with smart caching and path resolution
- **File Watching**: Intelligent file monitoring with chokidar
- **Live Asset Updates**: Real-time CSS and JavaScript recompilation
- **Advanced Routing**: Client-side SPA router with React integration

### 🎨 **Built-in Styling**
- **Tailwind CSS 4**: Latest utility-first CSS framework
- **Auto-processing**: PostCSS pipeline with autoprefixer
- **Development Optimization**: Fast CSS rebuilds during development
- **Custom Configurations**: Override with your own `tailwind.config.js`

### 🔒 **Route Protection**
- **Guard Functions**: Implement authentication and authorization logic
- **Nested Guards**: Hierarchical protection with layout inheritance
- **TypeScript Integration**: Full type safety for guard functions

### 🍪 **Advanced Cookie Management**
- **CookieJar API**: Comprehensive cookie handling with full options support
- **Secure Defaults**: HTTP-only and secure cookie options
- **TypeScript Integration**: Full type safety for cookie operations

### 🌐 **WebSocket Support**
- **Native WebSocket Integration**: Built-in WebSocket server capabilities
- **Request Upgrades**: Seamless HTTP to WebSocket upgrades
- **Type-Safe Handlers**: TypeScript interfaces for WebSocket events

## 🚀 Quick Start

### Installation

```bash
npm install @peaque/framework@latest
```

### Project Structure

```
my-app/
├── src/
│   ├── pages/
│   │   ├── page.tsx              # Home page (/)
│   │   ├── about/
│   │   │   └── page.tsx          # About page (/about)
│   │   ├── blog/
│   │   │   ├── layout.tsx        # Blog layout
│   │   │   ├── page.tsx          # Blog index (/blog)
│   │   │   └── [slug]/
│   │   │       └── page.tsx      # Blog post (/blog/:slug)
│   │   └── dashboard/
│   │       ├── guard.ts          # Protect dashboard routes
│   │       ├── layout.tsx        # Dashboard layout
│   │       └── page.tsx          # Dashboard (/dashboard)
│   ├── api/
│   │   ├── users/
│   │   │   └── route.ts          # API: /api/users
│   │   └── posts/
│   │       ├── route.ts          # API: /api/posts
│   │       └── [id]/
│   │           └── route.ts      # API: /api/posts/:id
│   ├── public/
│   │   └── favicon.ico           # Static assets
│   └── styles.css                # Global styles
├── .env                          # Environment variables
└── package.json
```

### Available Commands

```bash
# Development server with advanced HMR
peaque dev

# Production build (Coming Soon)
# peaque build

# Production server (Coming Soon)
# peaque start
```

**Note**: Currently only the `dev` command is implemented. Production build and start commands are planned for future releases.

## 📖 Documentation

### Creating Pages

Create a `page.tsx` file in any folder within `src/pages/`:

```typescript
// src/pages/page.tsx - Home page
export default function HomePage() {
  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold text-blue-600">
        Welcome to Peaque Framework v2!
      </h1>
      <p className="mt-4 text-gray-600">
        Built with advanced HMR and zero configuration.
      </p>
    </div>
  );
}
```

```typescript
// src/pages/about/page.tsx - About page
export default function AboutPage() {
  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-4">About Us</h1>
      <p className="text-gray-600">Learn more about our company...</p>
    </div>
  );
}
```

### Dynamic Routes

Use square brackets for dynamic segments:

```typescript
// src/pages/blog/[slug]/page.tsx
import { useParams } from '@peaque/framework';

export default function BlogPostPage() {
  const { slug } = useParams();

  return (
    <article className="prose max-w-4xl mx-auto p-8">
      <h1>Blog Post: {slug}</h1>
      <p>Content for {slug}...</p>
    </article>
  );
}
```

### Layouts

Create shared layouts with `layout.tsx`:

```typescript
// src/pages/blog/layout.tsx
import { ReactNode } from 'react';

interface BlogLayoutProps {
  children: ReactNode;
}

export default function BlogLayout({ children }: BlogLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">My Blog</h1>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}
```

### Route Guards

Protect routes with authentication logic:

```typescript
// src/pages/dashboard/guard.ts
import { PeaqueRequest } from '@peaque/framework';

export function GUARD(request: PeaqueRequest): boolean | Promise<boolean> {
  // Check authentication
  const authHeader = request.requestHeader('authorization');

  if (!authHeader) {
    return false;
  }

  // Verify token and return result
  return verifyToken(authHeader);
}

async function verifyToken(token: string): Promise<boolean> {
  // Your authentication logic here
  return true; // or false
}
```

### API Routes

Create backend APIs with HTTP method exports:

```typescript
// src/api/users/route.ts
import { PeaqueRequest } from '@peaque/framework';

export async function GET(request: PeaqueRequest) {
  const users = await getUsersFromDatabase();
  request.send({ users });
}

export async function POST(request: PeaqueRequest) {
  const userData = request.body();
  const newUser = await createUser(userData);
  request.code(201).send({ user: newUser });
}

export async function DELETE(request: PeaqueRequest) {
  const id = request.queryParam('id');
  if (!id) {
    request.code(400).send({ error: 'Missing id parameter' });
    return;
  }

  await deleteUser(id);
  request.code(204).send();
}
```

### Dynamic API Routes

```typescript
// src/api/posts/[id]/route.ts
import { PeaqueRequest } from '@peaque/framework';

export async function GET(request: PeaqueRequest) {
  const id = request.pathParam('id');
  const post = await getPostById(id);

  if (!post) {
    request.code(404).send({ error: 'Post not found' });
    return;
  }

  request.send({ post });
}

export async function PUT(request: PeaqueRequest) {
  const id = request.pathParam('id');
  const updateData = request.body();

  const updatedPost = await updatePost(id, updateData);
  request.send({ post: updatedPost });
}
```

### WebSocket Support

Upgrade HTTP requests to WebSocket connections:

```typescript
// src/api/chat/route.ts
import { PeaqueRequest } from '@peaque/framework';

export async function GET(request: PeaqueRequest) {
  if (request.isUpgradeRequest()) {
    const ws = request.upgradeToWebSocket({
      onMessage: (message, socket) => {
        console.log('Received:', message);
        socket.send(`Echo: ${message}`);
      },
      onClose: (code, reason, socket) => {
        console.log('WebSocket closed:', code, reason);
      },
      onError: (error, socket) => {
        console.error('WebSocket error:', error);
      }
    });

    ws.send('Welcome to the chat!');
  } else {
    request.send({ message: 'WebSocket endpoint' });
  }
}
```

### Advanced Cookie Management

Peaque provides a comprehensive CookieJar API:

```typescript
// src/api/auth/session/route.ts
import { PeaqueRequest } from '@peaque/framework';

export async function GET(request: PeaqueRequest) {
  // Get specific cookie
  const sessionId = request.cookies().get('sessionId');

  // Get all cookies
  const allCookies = request.cookies().getAll();

  request.send({ sessionId, allCookies });
}

export async function POST(request: PeaqueRequest) {
  const { userId } = request.body();

  // Set cookie with advanced options
  request.cookies().set('sessionId', generateSessionId(userId), {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 86400, // 24 hours
    path: '/'
  });

  request.send({ success: true });
}

export async function DELETE(request: PeaqueRequest) {
  // Remove cookie
  request.cookies().remove('sessionId', {
    path: '/',
    secure: true,
    httpOnly: true
  });

  request.send({ success: true });
}
```

## 🎨 Styling

Peaque includes Tailwind CSS 4 by default with PostCSS processing:

```typescript
export default function StyledPage() {
  return (
    <div className="min-h-screen bg-gradient-to-r from-blue-500 to-purple-600">
      <div className="container mx-auto px-4 py-16">
        <h1 className="text-5xl font-bold text-white text-center mb-8">
          Beautiful Design with Tailwind CSS 4
        </h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white/10 backdrop-blur rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Feature One</h2>
            <p className="text-blue-100">Advanced HMR with WebSocket support</p>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Feature Two</h2>
            <p className="text-blue-100">File-based routing with TypeScript</p>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Feature Three</h2>
            <p className="text-blue-100">Zero configuration setup</p>
          </div>
        </div>
      </div>
    </div>
  );
}
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file in your project root:

```bash
# .env
PORT=3000
HOST=localhost
NODE_ENV=development

# Client-side accessible variables (prefixed with PEAQUE_PUBLIC_)
PEAQUE_PUBLIC_API_URL=https://api.example.com
PEAQUE_PUBLIC_APP_NAME=My Peaque App
```

Variables prefixed with `PEAQUE_PUBLIC_` are automatically available on the client side.

### Client-Side Router

Use Peaque's built-in router hooks:

```typescript
import {
  useParams,
  useNavigate,
  useCurrentPath,
  useSearchParams,
  Link,
  NavLink
} from '@peaque/framework';

export default function NavigationExample() {
  const params = useParams();
  const navigate = useNavigate();
  const currentPath = useCurrentPath();
  const [searchParams, setSearchParams] = useSearchParams();

  return (
    <div>
      <nav>
        <Link to="/">Home</Link>
        <NavLink to="/about" activeClassName="text-blue-600">
          About
        </NavLink>
      </nav>

      <p>Current path: {currentPath}</p>
      <button onClick={() => navigate('/dashboard')}>
        Go to Dashboard
      </button>
    </div>
  );
}
```

## 🚧 Development Status

**Current Version**: 2.0.5

**Implemented Features**:
- ✅ Advanced development server with HMR
- ✅ File-based routing system
- ✅ TypeScript compilation with esbuild
- ✅ Tailwind CSS 4 processing
- ✅ WebSocket support
- ✅ Cookie management
- ✅ Route guards and layouts
- ✅ Static asset serving

**Planned Features**:
- 🚧 Production build system (`peaque build`)
- 🚧 Production server (`peaque start`)
- 🚧 Static site generation
- 🚧 SEO optimizations
- 🚧 Deployment guides

## 🤝 Contributing

We welcome contributions! This framework is actively developed and evolving rapidly.

## 📄 License

MIT © 2025 Peaque Framework

---

**Built with ❤️ by the Peaque team**

*The last JavaScript framework ever to be needed.*

---

**Version 2.0.5 Features**:
- 🆕 Complete v2 architecture with custom HTTP server
- 🆕 Advanced WebSocket integration
- 🆕 Sophisticated HMR system with incremental builds
- 🆕 Enhanced CookieJar API with full options support
- 🆕 Smart file watching with chokidar
- 🆕 TypeScript path resolution and module handling