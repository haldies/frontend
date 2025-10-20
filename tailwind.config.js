/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './entrypoints/**/*.{html,js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './modules/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#6366f1',
          foreground: '#e0e7ff',
        },
      },
    },
  },
  plugins: [],
}
