import fs from 'fs';
import path from 'path';

export class TailwindUtils {
  /**
   * Generates a Tailwind CSS configuration file for a project
   */
  static generateTailwindConfig(projectRoot: string): void {
    const peaqueDir = path.join(projectRoot, '..', '.peaque');
    const configPath = path.join(peaqueDir, 'tailwind.config.js');

    // Only generate if it doesn't exist
    if (fs.existsSync(configPath)) {
      return;
    }

    // Ensure .peaque directory exists
    fs.mkdirSync(peaqueDir, { recursive: true });

    const configContent = `/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx}",
    "./src/components/**/*.{js,ts,jsx,tsx}",
    "./src/api/**/*.{js,ts}",
    "./src/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
`;

    fs.writeFileSync(configPath, configContent);
  }

  /**
   * Generates a PostCSS configuration file for a project
   */
  static generatePostCSSConfig(projectRoot: string): void {
    const peaqueDir = path.join(projectRoot, '..', '.peaque');
    const configPath = path.join(peaqueDir, 'postcss.config.js');

    // Only generate if it doesn't exist
    if (fs.existsSync(configPath)) {
      return;
    }

    // Ensure .peaque directory exists
    fs.mkdirSync(peaqueDir, { recursive: true });

    const configContent = `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
`;

    fs.writeFileSync(configPath, configContent);
  }

  /**
   * Generates the main CSS file with Tailwind directives
   */
  static generateMainCSS(projectRoot: string): void {
    const cssPath = path.join(projectRoot, 'styles.css');

    // Only generate if it doesn't exist
    if (fs.existsSync(cssPath)) {
      return;
    }

    const cssContent = `@tailwind base;
@tailwind components;
@tailwind utilities;

/* Add your custom styles here */
`;

    fs.writeFileSync(cssPath, cssContent);
  }

  /**
   * Sets up Tailwind CSS for a project by generating all necessary files
   */
  static setupTailwindForProject(projectRoot: string): void {
    // Only generate files if user doesn't have custom configs
    const hasUserTailwindConfig = fs.existsSync(path.join(projectRoot, 'tailwind.config.js'));
    const hasUserPostCSSConfig = fs.existsSync(path.join(projectRoot, 'postcss.config.js'));
    const hasUserCSS = fs.existsSync(path.join(projectRoot, 'styles.css'));

    // Generate hidden configs in .peaque if user doesn't have custom ones
    if (!hasUserTailwindConfig) {
      this.generateTailwindConfig(projectRoot);
    }

    if (!hasUserPostCSSConfig) {
      this.generatePostCSSConfig(projectRoot);
    }

    if (!hasUserCSS) {
      this.generateMainCSS(projectRoot);
    }

    // Silent operation - no console logs for magical setup
  }
}
