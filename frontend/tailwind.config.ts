import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Space Grotesk", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      colors: {
        primary:       "var(--primary)",
        "primary-light": "var(--primary-light)",
        purple:        "var(--purple)",
        cyan:          "var(--cyan)",
        surface:       "var(--bg-surface)",
        elevated:      "var(--bg-elevated)",
      },
      borderRadius: {
        card: "var(--radius-card)",
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};
export default config;
