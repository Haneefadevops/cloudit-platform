import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#050811',
          900: '#0B1120',
          800: '#12203A',
          700: '#1a2d4d',
        },
        sand: {
          50: '#FAF8F5',
          100: '#F3EFE8',
          200: '#E8E2D9',
        },
        gold: {
          300: '#E4C65A',
          400: '#D4AF37',
          500: '#C5A028',
          600: '#A6821F',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-playfair)', 'Georgia', 'serif'],
      },
      backgroundImage: {
        'gold-gradient': 'linear-gradient(135deg, #E4C65A 0%, #D4AF37 50%, #C5A028 100%)',
      },
      boxShadow: {
        'soft': '0 25px 50px -12px rgba(11, 17, 32, 0.12)',
        'glow': '0 0 40px -10px rgba(212, 175, 55, 0.35)',
      },
    },
  },
  plugins: [],
};

export default config;
