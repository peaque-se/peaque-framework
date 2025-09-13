
// Head management types for custom meta tags, icons, and head elements
export interface HeadDefinition {
  title?: string
  meta?: Array<{
    name?: string
    property?: string
    httpEquiv?: string
    charset?: string
    content?: string
  }>
  link?: Array<{
    rel: string
    href: string
    as?: string
    type?: string
    sizes?: string
    media?: string
    crossOrigin?: "anonymous" | "use-credentials" | ""
  }>
  script?: Array<{
    src?: string
    type?: string
    async?: boolean
    defer?: boolean
    innerHTML?: string
  }>
  style?: Array<{
    type?: string
    innerHTML: string
  }>
  extra?: Array<Record<string, any>>
}
