import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './styles/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        red: {
          50: '#fff7f8',
          100: '#fdebed',
          500: '#d62828',
          600: '#c1121f',
          700: '#a30f1a'
        },
        gray: {
          100: '#f4f5f7',
          200: '#e5e7eb',
          400: '#9ca3af',
          500: '#6b7280',
          700: '#3f4652',
          900: '#1f232b'
        }
      },
      fontFamily: {
        sans: ['Inter', 'var(--font-inter)', 'ui-sans-serif', 'system-ui']
      },
      boxShadow: {
        'soft': '0 4px 10px rgba(15,23,42,0.08)'
      },
      borderRadius: {
        'md': '12px',
        'sm': '8px'
      }
    }
  },
  plugins: []
}

export default config
