/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0A0B0D",
        surface: "#14161A",
        surface2: "#1C1F24",
        line: "#272A30",
        accent: "#C8862E",
        accent2: "#E2A857",
        data: "#5FC9C2",
        warn: "#C25450",
        text: "#ECE8E1",
        textdim: "#8D9097",
        // Blueprint palette
        blueprint: "#3878C8",
        blueprintdim: "#7aa8e0",
        blueprintbg: "#070C14",
        blueprintline: "#1a2535",
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
        "spin-slow": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
      },
      animation: {
        "rise-in": "rise-in 0.6s ease-out forwards",
        "spin-slow": "spin-slow 18s linear infinite",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
