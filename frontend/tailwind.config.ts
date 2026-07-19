import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "#F7F7F4",
        dot: "#E4E4DE",
        ink: "#1F2933",
        marker: {
          blue: "#4C6FFF",
          coral: "#FF6B57",
        },
        sticky: "#FFE58A",
      },
      fontFamily: {
        sans: ["var(--font-body)", "ui-sans-serif", "system-ui"],
        display: ["var(--font-display)", "ui-sans-serif", "system-ui"],
      },
    },
  },
  plugins: [],
};

export default config;