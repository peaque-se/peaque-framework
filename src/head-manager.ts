import path from 'path';
import { HeadConfig, ResolvedHeadConfig, MetaTag, LinkTag, ScriptTag, IconConfig } from './public-types.js';

export class HeadManager {
  private headConfigs: Map<string, ResolvedHeadConfig> = new Map();
  private iconFiles: Map<string, string> = new Map();

  /**
   * Add a head configuration for a specific route path
   */
  addHeadConfig(routePath: string, config: HeadConfig, filePath?: string, priority: number = 0): void {
    const resolved: ResolvedHeadConfig = {
      ...config,
      _filePath: filePath,
      _priority: priority
    };
    this.headConfigs.set(routePath, resolved);
  }

  /**
   * Add discovered icon files
   */
  addIconFiles(iconFiles: { [key: string]: string }): void {
    for (const [key, filePath] of Object.entries(iconFiles)) {
      this.iconFiles.set(key, filePath);
    }
  }

  /**
   * Resolve head configuration for a specific route, merging configs from parent routes
   */
  resolveHeadConfig(routePath: string): ResolvedHeadConfig {
    const configs = this.getRelevantConfigs(routePath);
    return this.mergeConfigs(configs, routePath);
  }

  /**
   * Get all head configs that apply to a given route path (including parent routes)
   */
  private getRelevantConfigs(routePath: string): ResolvedHeadConfig[] {
    const relevantConfigs: ResolvedHeadConfig[] = [];
    
    // Add root config if exists
    if (this.headConfigs.has('/')) {
      relevantConfigs.push(this.headConfigs.get('/')!);
    }

    // Add configs from parent paths
    const pathParts = routePath.split('/').filter(part => part.length > 0);
    let currentPath = '';
    
    for (const part of pathParts) {
      currentPath += '/' + part;
      if (this.headConfigs.has(currentPath)) {
        relevantConfigs.push(this.headConfigs.get(currentPath)!);
      }
    }

    // Sort by priority (lower priority = applied first, higher priority = overrides)
    relevantConfigs.sort((a, b) => (a._priority || 0) - (b._priority || 0));

    return relevantConfigs;
  }

  /**
   * Merge multiple head configurations, with later configs overriding earlier ones
   */
  private mergeConfigs(configs: ResolvedHeadConfig[], routePath: string): ResolvedHeadConfig {
    const merged: ResolvedHeadConfig = {
      meta: [],
      links: [],
      scripts: [],
      icons: []
    };

    for (const config of configs) {
      // Simple properties - later configs override
      if (config.title !== undefined) merged.title = config.title;
      if (config.description !== undefined) merged.description = config.description;
      if (config.keywords !== undefined) merged.keywords = config.keywords;
      if (config.author !== undefined) merged.author = config.author;
      if (config.viewport !== undefined) merged.viewport = config.viewport;
      if (config.charset !== undefined) merged.charset = config.charset;

      // Arrays - merge and deduplicate
      if (config.meta) {
        merged.meta = this.mergeMeta(merged.meta!, config.meta);
      }
      if (config.links) {
        merged.links = this.mergeLinks(merged.links!, config.links);
      }
      if (config.scripts) {
        merged.scripts = this.mergeScripts(merged.scripts!, config.scripts);
      }
      if (config.icons) {
        merged.icons = this.mergeIcons(merged.icons!, config.icons);
      }
    }

    // Add automatically discovered icons for this route
    this.addDiscoveredIcons(merged, routePath);

    return merged;
  }

  private mergeMeta(existing: MetaTag[], newMeta: MetaTag[]): MetaTag[] {
    const merged = [...existing];
    
    for (const meta of newMeta) {
      // Remove existing meta tag with same name/property
      const existingIndex = merged.findIndex(existing => 
        (meta.name && existing.name === meta.name) ||
        (meta.property && existing.property === meta.property) ||
        (meta.httpEquiv && existing.httpEquiv === meta.httpEquiv)
      );
      
      if (existingIndex >= 0) {
        merged[existingIndex] = meta;
      } else {
        merged.push(meta);
      }
    }
    
    return merged;
  }

  private mergeLinks(existing: LinkTag[], newLinks: LinkTag[]): LinkTag[] {
    const merged = [...existing];
    
    for (const link of newLinks) {
      // Remove existing link with same rel and href
      const existingIndex = merged.findIndex(existing => 
        existing.rel === link.rel && existing.href === link.href
      );
      
      if (existingIndex >= 0) {
        merged[existingIndex] = link;
      } else {
        merged.push(link);
      }
    }
    
    return merged;
  }

  private mergeScripts(existing: ScriptTag[], newScripts: ScriptTag[]): ScriptTag[] {
    const merged = [...existing];
    
    for (const script of newScripts) {
      // Remove existing script with same src
      const existingIndex = merged.findIndex(existing => 
        existing.src === script.src
      );
      
      if (existingIndex >= 0) {
        merged[existingIndex] = script;
      } else {
        merged.push(script);
      }
    }
    
    return merged;
  }

  private mergeIcons(existing: IconConfig[], newIcons: IconConfig[]): IconConfig[] {
    const merged = [...existing];
    
    for (const icon of newIcons) {
      // Remove existing icon with same rel (child icons override parent icons of same type)
      const existingIndex = merged.findIndex(existing => 
        existing.rel === icon.rel
      );
      
      if (existingIndex >= 0) {
        merged[existingIndex] = icon;
      } else {
        merged.push(icon);
      }
    }
    
    return merged;
  }

  private addDiscoveredIcons(config: ResolvedHeadConfig, routePath: string): void {
    if (!config.icons) config.icons = [];

    // Get icons that apply to this route (hierarchical resolution with proper overrides)
    const relevantIcons = this.getRelevantIcons(routePath);

    for (const [rel, iconInfo] of relevantIcons.entries()) {
      const filename = path.basename(iconInfo.filePath);
      // Preserve folder structure: root icons at root, route-specific icons in subfolders
      const href = iconInfo.routePath === '/' ? '/' + filename : iconInfo.routePath + '/' + filename;

      // Check if this icon is already configured manually
      const exists = config.icons.some(icon => icon.href === href);
      
      if (!exists) {
        const iconConfig: IconConfig = {
          rel: rel as IconConfig['rel'],
          href: href
        };

        // Add type if we can determine it from extension
        const ext = path.extname(filename).toLowerCase();
        if (ext === '.ico') {
          iconConfig.type = 'image/x-icon';
        } else if (ext === '.png') {
          iconConfig.type = 'image/png';
        } else if (ext === '.jpg' || ext === '.jpeg') {
          iconConfig.type = 'image/jpeg';
        } else if (ext === '.svg') {
          iconConfig.type = 'image/svg+xml';
        }

        config.icons.push(iconConfig);
      }
    }
  }

  /**
   * Get icons that apply to a specific route path (hierarchical resolution)
   */
  private getRelevantIcons(routePath: string): Map<string, {filePath: string, routePath: string}> {
    const iconsByType = new Map<string, {filePath: string, routePath: string}>();
    
    // Collect all potential icon paths for this route (from parent to child)
    const pathSegments = routePath.split('/').filter(segment => segment.length > 0);
    const candidatePaths = ['/'];
    
    // Build candidate paths: /, /blog, /blog/posts, etc.
    let currentPath = '';
    for (const segment of pathSegments) {
      currentPath += '/' + segment;
      candidatePaths.push(currentPath);
    }

    // Collect icons from parent paths first (so child paths override parent paths)
    for (const candidatePath of candidatePaths) {
      for (const [iconKey, iconFilePath] of this.iconFiles.entries()) {
        const [iconRoutePath, rel, filename] = iconKey.split('_', 3);
        
        // If this icon belongs to the current candidate path
        if (iconRoutePath === candidatePath) {
          // Child routes override parent routes for same icon type (rel)
          iconsByType.set(rel, {
            filePath: iconFilePath,
            routePath: iconRoutePath
          });
        }
      }
    }

    return iconsByType;
  }

  /**
   * Generate HTML string for head elements
   */
  generateHeadHTML(config: ResolvedHeadConfig): string {
    const parts: string[] = [];

    // Basic meta tags with fallbacks for essential tags
    const charset = config.charset || 'UTF-8';
    parts.push(`  <meta charset="${this.escapeHtml(charset)}">`);
    
    const viewport = config.viewport || 'width=device-width, initial-scale=1.0';
    parts.push(`  <meta name="viewport" content="${this.escapeHtml(viewport)}">`);
    
    const title = config.title || 'Peaque App';
    parts.push(`  <title>${this.escapeHtml(title)}</title>`);
    if (config.description) {
      parts.push(`  <meta name="description" content="${this.escapeHtml(config.description)}">`);
    }
    if (config.keywords) {
      parts.push(`  <meta name="keywords" content="${this.escapeHtml(config.keywords)}">`);
    }
    if (config.author) {
      parts.push(`  <meta name="author" content="${this.escapeHtml(config.author)}">`);
    }

    // Custom meta tags
    if (config.meta) {
      for (const meta of config.meta) {
        parts.push(this.generateMetaTag(meta));
      }
    }

    // Link tags (including icons)
    if (config.icons) {
      for (const icon of config.icons) {
        parts.push(this.generateIconTag(icon));
      }
    }
    if (config.links) {
      for (const link of config.links) {
        parts.push(this.generateLinkTag(link));
      }
    }

    // Script tags
    if (config.scripts) {
      for (const script of config.scripts) {
        parts.push(this.generateScriptTag(script));
      }
    }

    return parts.join('\n');
  }

  private generateMetaTag(meta: MetaTag): string {
    let tag = '  <meta';
    
    if (meta.name) tag += ` name="${this.escapeHtml(meta.name)}"`;
    if (meta.property) tag += ` property="${this.escapeHtml(meta.property)}"`;
    if (meta.httpEquiv) tag += ` http-equiv="${this.escapeHtml(meta.httpEquiv)}"`;
    if (meta.charset) tag += ` charset="${this.escapeHtml(meta.charset)}"`;
    if (meta.content) tag += ` content="${this.escapeHtml(meta.content)}"`;
    
    tag += '>';
    return tag;
  }

  private generateIconTag(icon: IconConfig): string {
    let tag = `  <link rel="${icon.rel}" href="${this.escapeHtml(icon.href)}"`;
    
    if (icon.type) tag += ` type="${this.escapeHtml(icon.type)}"`;
    if (icon.sizes) tag += ` sizes="${this.escapeHtml(icon.sizes)}"`;
    if (icon.color) tag += ` color="${this.escapeHtml(icon.color)}"`;
    
    tag += '>';
    return tag;
  }

  private generateLinkTag(link: LinkTag): string {
    let tag = `  <link rel="${this.escapeHtml(link.rel)}" href="${this.escapeHtml(link.href)}"`;
    
    if (link.type) tag += ` type="${this.escapeHtml(link.type)}"`;
    if (link.sizes) tag += ` sizes="${this.escapeHtml(link.sizes)}"`;
    if (link.media) tag += ` media="${this.escapeHtml(link.media)}"`;
    if (link.crossOrigin) tag += ` crossorigin="${this.escapeHtml(link.crossOrigin)}"`;
    if (link.integrity) tag += ` integrity="${this.escapeHtml(link.integrity)}"`;
    if (link.as) tag += ` as="${this.escapeHtml(link.as)}"`;
    
    tag += '>';
    return tag;
  }

  private generateScriptTag(script: ScriptTag): string {
    let tag = '  <script';
    
    if (script.src) tag += ` src="${this.escapeHtml(script.src)}"`;
    if (script.type) tag += ` type="${this.escapeHtml(script.type)}"`;
    if (script.async) tag += ' async';
    if (script.defer) tag += ' defer';
    if (script.crossOrigin) tag += ` crossorigin="${this.escapeHtml(script.crossOrigin)}"`;
    if (script.integrity) tag += ` integrity="${this.escapeHtml(script.integrity)}"`;
    
    tag += '>';
    
    if (script.innerHTML) {
      tag += script.innerHTML + '</script>';
    } else {
      tag += '</script>';
    }
    
    return tag;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }
}