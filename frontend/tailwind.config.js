/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eefcf9",
          500: "#0ea37f",
          700: "#0a6d55",
          900: "#064036"
        }
      }
    }
  },
  plugins: [],
};
