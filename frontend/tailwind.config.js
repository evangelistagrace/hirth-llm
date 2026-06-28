/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#06090F",
        surface: "#0A1828",
        surface2: "#0F2035",
        line: "#162540",
        accent: "#5FC9C2",
        accent2: "#7DDAD3",
        data: "#7AB8E0",
        muted: "#2D6070",
        warn: "#C25450",
        good: "#5FAE7C",
        text: "#E3EEF7",
        textdim: "#5C7891",
      },
      fontFamily: {
        sans: ["IBM Plex Sans", "system-ui", "sans-serif"],
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
