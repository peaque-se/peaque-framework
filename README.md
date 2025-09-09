# Peaque Framework

> The last JavaScript framework ever to be needed

Peaque is a modern, full-stack TypeScript web framework that combines the simplicity of file-based routing with the power of React, built-in styling with Tailwind CSS, and seamless development experience with Hot Module Replacement (HMR).

## ✨ Features

### 🚀 **Zero Configuration**
- Get started instantly with no setup required
- Automatic Tailwind CSS configuration
- Built-in TypeScript support
- Smart project structure detection

### 📁 **File-Based Routing**
- **Pages**: Create routes by adding `page.tsx` files in folders
- **API Routes**: Build APIs with `route.ts` files using HTTP method exports
- **Layouts**: Wrap pages with `layout.tsx` files for shared UI
- **Route Guards**: Protect routes with `guard.ts` files for authentication/authorization
- **Dynamic Routes**: Use `[param]` folders for parameterized routes

### ⚡ **Development Experience**
- **Hot Module Replacement (HMR)**: Instant updates without page refresh
- **Fast Builds**: Powered by esbuild for lightning-fast compilation
- **Live Reloading**: Automatic page updates on file changes
- **Error Handling**: Clear error messages and stack traces

### 🎨 **Built-in Styling**
- **Tailwind CSS**: Utility-first CSS framework included by default
- **Auto-purging**: Unused styles automatically removed in production
- **Custom Configurations**: Override with your own `tailwind.config.js`
- **PostCSS**: Built-in processing with autoprefixer

### 🔒 **Route Protection**
- **Guard Functions**: Implement authentication and authorization logic
- **Nested Guards**: Hierarchical protection with layout inheritance
- **Flexible Logic**: Custom guard functions with full TypeScript support

### 🏗️ **Production Ready**
- **Optimized Builds**: Minified and tree-shaken production bundles
- **Static Generation**: Pre-built assets for fast loading
- **SEO Friendly**: Server-side rendering support
- **Type Safety**: Full TypeScript integration throughout

## 🚀 Quick Start

### Installation

```bash
npm install @peaque/framework
```

### Project Structure

```
my-app/
├── pages/
│   ├── page.tsx              # Home page (/)
│   ├── about/
│   │   └── page.tsx          # About page (/about)
│   ├── blog/
│   │   ├── layout.tsx        # Blog layout
│   │   ├── page.tsx          # Blog index (/blog)
│   │   └── [slug]/
│   │       └── page.tsx      # Blog post (/blog/:slug)
│   └── dashboard/
│       ├── guard.ts          # Protect dashboard routes
│       ├── layout.tsx        # Dashboard layout
│       └── page.tsx          # Dashboard (/dashboard)
├── api/
│   ├── users/
│   │   └── route.ts          # API: /api/users
│   └── posts/
│       ├── route.ts          # API: /api/posts
│       └── [id]/
│           └── route.ts      # API: /api/posts/:id
├── public/
│   └── favicon.ico           # Static assets
├── styles.css                # Global styles
└── package.json
```

### Commands

```bash
# Development server with HMR
peaque dev

# Production build
peaque build

# Production server
peaque start
```

## 📖 Documentation

### Creating Pages

Create a `page.tsx` file in any folder within `pages/`:

```typescript
// pages/page.tsx - Home page
export default function HomePage() {
  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold text-blue-600">
        Welcome to Peaque!
      </h1>
    </div>
  );
}
```

```typescript
// pages/about/page.tsx - About page
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
// pages/blog/[slug]/page.tsx
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
// pages/blog/layout.tsx
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
// pages/dashboard/guard.ts
import { PeaqueRequest } from '@peaque/framework';

export function GUARD(request: PeaqueRequest): boolean | Promise<boolean> {
  // Check authentication
  const token = request.headers.authorization;
  
  if (!token) {
    // Redirect to login or show error
    return false;
  }
  
  // Verify token and return result
  return verifyToken(token);
}

async function verifyToken(token: string): Promise<boolean> {
  // Your authentication logic here
  return true; // or false
}
```

### API Routes

Create backend APIs with HTTP method exports:

```typescript
// api/users/route.ts
import { PeaqueRequest, PeaqueReply } from '@peaque/framework';

export async function GET(request: PeaqueRequest, reply: PeaqueReply) {
  const users = await getUsersFromDatabase();
  reply.send({ users });
}

export async function POST(request: PeaqueRequest, reply: PeaqueReply) {
  const userData = request.body;
  const newUser = await createUser(userData);
  reply.code(201).send({ user: newUser });
}

export async function DELETE(request: PeaqueRequest, reply: PeaqueReply) {
  const { id } = request.params;
  await deleteUser(id);
  reply.code(204).send();
}
```

### Dynamic API Routes

```typescript
// api/posts/[id]/route.ts
import { PeaqueRequest, PeaqueReply } from '@peaque/framework';

export async function GET(request: PeaqueRequest, reply: PeaqueReply) {
  const { id } = request.params;
  const post = await getPostById(id);
  
  if (!post) {
    reply.code(404).send({ error: 'Post not found' });
    return;
  }
  
  reply.send({ post });
}

export async function PUT(request: PeaqueRequest, reply: PeaqueReply) {
  const { id } = request.params;
  const updateData = request.body;
  
  const updatedPost = await updatePost(id, updateData);
  reply.send({ post: updatedPost });
}
```

## 🎨 Styling

Peaque includes Tailwind CSS by default. Just start using utility classes:

```typescript
export default function StyledPage() {
  return (
    <div className="min-h-screen bg-gradient-to-r from-blue-500 to-purple-600">
      <div className="container mx-auto px-4 py-16">
        <h1 className="text-5xl font-bold text-white text-center mb-8">
          Beautiful Design
        </h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Feature One</h2>
            <p className="text-gray-600">Description here...</p>
          </div>
          {/* More cards... */}
        </div>
      </div>
    </div>
  );
}
```

### Custom Tailwind Configuration

Override defaults with your own `tailwind.config.js`:

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          500: '#3b82f6',
          900: '#1e3a8a',
        }
      }
    },
  },
  plugins: [],
}
```

## 🔧 Configuration

Peaque works out of the box, but you can customize it:

### Environment Variables

```bash
# .env
PORT=3000
HOST=localhost
NODE_ENV=development
```

### TypeScript Configuration

Peaque respects your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "node",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["pages/**/*", "api/**/*", "components/**/*"]
}
```

## 🚀 Deployment

### Build for Production

```bash
peaque build
```

This generates optimized assets in `.peaque/dist/`:
- `peaque.js` - Your application bundle
- `peaque.css` - Processed and purged styles
- `index.html` - HTML entry point

### Start Production Server

```bash
peaque start
```

### Deploy to Vercel, Netlify, etc.

The framework generates static assets that can be deployed anywhere:

1. Run `peaque build`
2. Upload the `.peaque/dist/` folder
3. Configure your host to serve `index.html` for all routes

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## 📄 License

MIT © Peaque Framework

---

**Built with ❤️ by the Peaque team**

*The last JavaScript framework ever to be needed.*