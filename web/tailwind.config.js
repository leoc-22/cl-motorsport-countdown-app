/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Space Grotesk"', 'var(--font-sans)', 'sans-serif'],
        sans: ['"Inter"', 'var(--font-sans)', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 45px rgba(59,130,246,0.35)',
      },
      colors: {
        surface: {
          DEFAULT: '#0F172A',
          raised: '#111827',
        },
      },
    },
  },
  plugins: [],
}
