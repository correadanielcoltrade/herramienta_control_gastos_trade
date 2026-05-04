import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    fontFamily: {
      sans: ["Poppins", "system-ui", "sans-serif"],
      serif: ["Poppins", "system-ui", "sans-serif"],
      mono: ["Poppins", "system-ui", "sans-serif"],
    },
    extend: {
      colors: {
        brand: {
          50: "#f3f0ff",
          100: "#ede9fe",
          200: "#ddd6fe",
          300: "#c4b5fd",
          400: "#a78bfa",
          500: "#8b5cf6",
          600: "#7c3aed",
          700: "#6d28d9",
          800: "#5b21b6",
          900: "#4c1d95"
        },
        accent: {
          50: "#fdf2f8",
          100: "#fce7f3",
          200: "#fbcfe8",
          300: "#f9a8d4",
          400: "#f472b6",
          500: "#ec4899",
          600: "#e91e8c",
          700: "#be185d",
          800: "#831843",
          900: "#500724"
        },
        cyan: {
          50: "#ecf9ff",
          100: "#cff2fe",
          300: "#a5f3fc",
          500: "#06b6d4",
          600: "#0891b2",
          700: "#0e7490"
        }
      },
      boxShadow: {
        panel: "0 10px 25px rgba(99, 102, 241, 0.08)",
        button: "0 4px 12px rgba(139, 92, 246, 0.3)"
      }
    },
  },
  plugins: [],
} satisfies Config;

