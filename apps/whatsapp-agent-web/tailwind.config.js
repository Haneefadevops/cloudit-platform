/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          teal: '#00d8c7',
          indigo: '#4a42fc',
          navy: '#12142b',
        },
        page: '#f6f7fd',
        line: '#e6e8f5',
        muted: '#6b7280',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(90deg, #00d8c7, #4a42fc)',
      },
      boxShadow: {
        card: '0 1px 3px rgba(18,20,43,0.08)',
        pop: '0 10px 30px rgba(18,20,43,0.14)',
      },
      borderRadius: {
        card: '14px',
      },
    },
  },
  plugins: [],
};
