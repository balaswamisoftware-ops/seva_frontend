/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  corePlugins: { preflight: false }, // avoid clashing with PrimeReact base styles
  blocklist: ['grid'], // let PrimeFlex own `.grid` (flex+wrap). We don't use Tailwind's `grid-cols-*`.
  theme: {
    extend: {
      colors: {
        saffron: { 50: '#fff8ed', 500: '#f59e0b', 600: '#d97706', 700: '#b45309' },
        spiritual: { primary: '#b45309', accent: '#fbbf24' },
      },
    },
  },
  plugins: [],
};
