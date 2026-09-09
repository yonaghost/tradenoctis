import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/app/**/*.{ts,tsx}', './src/components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        noctis: {
          bg: '#0B0F14',
          surface: '#111820',
          card: '#18212B',
          border: '#263340',
          ink: '#F1F5F9',
          muted: '#94A3B8',
          accent: '#00E5A0',
          accentDark: '#00B981',
        },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
