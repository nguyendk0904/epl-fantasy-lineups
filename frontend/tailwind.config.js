/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          skyblue: '#0593C6',
          'skyblue-light': '#3FB6E4',
          'skyblue-dark': '#046C94',
          white: '#FCFFFF',
          hotpink: '#D83995',
          'hotpink-dark': '#B02A78',
          'hotpink-light': '#F27CBF',
          dark: '#07202B',
          darker: '#041620',
          card: '#0C2E3D',
          'card-hover': '#11405A',
          border: '#164B63',
          'border-light': '#1F6285',
          muted: '#86A9BA',
        },
        pitch: {
          dark: '#0F4A45',
          light: '#14605A',
          stripe1: '#0C403B',
          stripe2: '#115246',
          line: 'rgba(252, 255, 255, 0.35)',
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-in-left': 'slideInLeft 0.3s ease-out',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'toast-in': 'toastIn 0.4s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInLeft: {
          '0%': { opacity: '0', transform: 'translateX(-10px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 5px rgba(5, 147, 198, 0.3)' },
          '50%': { boxShadow: '0 0 20px rgba(5, 147, 198, 0.6)' },
        },
        toastIn: {
          '0%': { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
      backgroundImage: {
        'gradient-brand': 'linear-gradient(135deg, #0593C6 0%, #D83995 100%)',
        'gradient-dark': 'linear-gradient(180deg, #07202B 0%, #041620 100%)',
      },
    },
  },
  plugins: [],
}
