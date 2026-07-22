import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        teal: {
          brand: '#00d8c7',
        },
        indigo: {
          brand: '#4a42fc',
        },
        night: '#0a0a12',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(90deg, #00d8c7, #4a42fc)',
      },
    },
  },
  plugins: [],
};

export default config;
