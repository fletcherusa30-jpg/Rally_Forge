/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: '#0A1A2F',
        'brand-slate': '#2E3A45',
        'cool-gray': '#F5F7FA',
        teal: '#1BA6A6',
        gold: '#C9A86A'
      }
    }
  },
  plugins: []
};

