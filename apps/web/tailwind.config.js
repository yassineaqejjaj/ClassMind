/** @type {import('tailwindcss').Config} */
// Tokens issus de la maquette « Identité & design system v1 ».
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ['"Inter Variable"', "Inter", "system-ui", "sans-serif"] },
      colors: {
        ink: "#172554", // bleu nuit : structure
        brand: { DEFAULT: "#4F46E5", dark: "#4338CA", soft: "#E0E7FF", deep: "#3730A3", night: "#312E81" }, // indigo : agir
        teal: { DEFAULT: "#2DD4BF", soft: "#CCFBF1", deep: "#115E59" }, // progression
        amber: { DEFAULT: "#F59E0B", soft: "#FEF3C7", deep: "#92400E" }, // attention
        muted: "#5A6B82",
        line: "#E2E8F0",
        ok: "#115E59",
        warn: "#92400E",
        bad: "#991B1B",
      },
      borderRadius: { xl: "12px", "2xl": "16px", "3xl": "24px" },
    },
  },
  plugins: [],
};
