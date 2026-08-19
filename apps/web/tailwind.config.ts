import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#0b0f14",
          900: "#11161d",
          800: "#171d26",
          700: "#232b37",
          600: "#333d4d",
          400: "#7c8a9c",
          200: "#c7d0da",
          100: "#e8ecf1",
        },
        signal: {
          DEFAULT: "#3ddbc4",
          dim: "#2aa895",
        },
        status: {
          online: "#3ecf72",
          warning: "#f2b84b",
          critical: "#ef5b5b",
        },
      },
      fontFamily: {
        sans: [
          "IBM Plex Sans",
          "-apple-system",
          "Segoe UI",
          "sans-serif",
        ],
        mono: ["IBM Plex Mono", "SFMono-Regular", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
