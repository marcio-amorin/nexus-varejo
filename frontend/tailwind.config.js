/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary:   '#F59E0B',   // amarelo âmbar
        secondary: '#EA580C',   // laranja
        dark:      '#1C1C1E',   // fundo escuro
        card:      '#2C2C2E',   // card escuro
        border:    '#3A3A3C',   // borda sutil
        muted:     '#8E8E93',   // texto secundário
      },
    },
  },
  plugins: [],
}
