import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        green: {
          50:  '#f0f7f3',
          100: '#dceee5',
          200: '#b9dccb',
          300: '#8ec3a9',
          400: '#5fa483',
          500: '#3d8766',
          600: '#2d6a4f',
          700: '#1a4731',
          800: '#163d2a',
          900: '#123324',
          950: '#0a1f16',
        },
        gold: {
          400: '#d4a843',
          500: '#c9a84c',
          600: '#b8961e',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
