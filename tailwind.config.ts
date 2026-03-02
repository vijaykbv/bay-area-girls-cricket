import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        vv: {
          violet:      "#B896D4",
          dark:        "#8A5CB8",   // deeper violet for hover/active
          light:       "#E8D4F5",   // soft violet tint for backgrounds/badges
          xlight:      "#F5EEF9",   // near-white violet for hover rows
          black:       "#000000",
          white:       "#FFFFFF",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
