/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        fpl: {
          purple: '#37003c',
          green: '#00ff87',
          cyan: '#02efff',
          magenta: '#e90052',
        },
        pitch: {
          dark: '#14381e',
          light: '#1b4d29',
          line: 'rgba(255, 255, 255, 0.35)',
        },
      },
    },
  },
  plugins: [],
}

