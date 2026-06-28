/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
 
        bg: "#F7F3EE",          // warm beige
        surface: "#FFFDF9",     // white cards
        surface2: "#EFE5D9",    // secondary surface

        // Borders
        line: "#D5C6B5",

        // Primary brand
        accent: "#8B1E2D",      // Burgundy
        accent2: "#B23A48",     // Light Burgundy

        // Info
        data: "#B08D57",        // Bronze

        // Semantic
        warn: "#C0392B",
        good: "#2E8B57",

        // Typography
        text: "#2C2520",
        textdim: "#74685C",
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "monospace"],
      },
      keyframes: {
        "rise-in": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "rise-in": "rise-in 0.6s ease-out forwards",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
