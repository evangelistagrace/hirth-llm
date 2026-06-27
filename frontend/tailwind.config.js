/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#070C14",
        surface: "#0B1729",
        surface2: "#142840",
        line: "#2D5A90",
        accent: "#3878C8",
        accent2: "#5B95DC",
        data: "#7AA8E0",
        warn: "#C25450",
        good: "#5FAE7C",
        text: "#EDF2FA",
        textdim: "#6B86A8",
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
