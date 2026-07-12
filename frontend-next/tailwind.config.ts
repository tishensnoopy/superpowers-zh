import type { Config } from 'tailwindcss';

export default {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#F5851F',
          dark: '#FF6B35',
        },
      },
      fontFamily: {
        sans: ['var(--font-default)', 'var(--font-custom)', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
