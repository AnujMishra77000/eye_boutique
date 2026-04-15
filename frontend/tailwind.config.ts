import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        matte: {
          950: "#061330",
          900: "#0d1f4b",
          850: "#163062",
          800: "#23427e",
          700: "#2f5798"
        },
        neon: {
          blue: "#6fd3ff",
          soft: "#fff3f8",
          pink: "#ffd8ea"
        }
      },
      boxShadow: {
        "neon-ring": "0 0 0 1px rgba(33, 63, 133, 0.72)",
        "neon-glow": "0 0 0 1px rgba(33, 63, 133, 0.68), 0 0 24px rgba(255, 225, 239, 0.34)",
        panel: "0 24px 48px rgba(4, 12, 30, 0.42)"
      },
      backgroundImage: {
        "matte-gradient":
          "radial-gradient(1250px circle at 10% -15%, rgba(111, 211, 255, 0.30), transparent 35%), radial-gradient(1100px circle at 100% 8%, rgba(255, 157, 207, 0.28), transparent 38%), linear-gradient(180deg, #061330 0%, #102a5b 52%, #1b3f7a 100%)"
      },
      fontFamily: {
        sans: ["Sora", "ui-sans-serif", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};

export default config;
