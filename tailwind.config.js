/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#143042",
        odakom: "#52695e",
        public: "#0f766e"
      }
    }
  },
  plugins: []
};
