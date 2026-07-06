tailwind.config = {
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f0f7ff',
          100: '#daeeff',
          200: '#b3dcff',
          300: '#7ac0ff',
          400: '#38a1ff',
          500: '#0066cc',   /* Sky Blue — single accent per design.md */
          600: '#0052a3',
          700: '#003d7a',
          800: '#002952',
          900: '#001a33',
          950: '#000d1a',
          primary: '#0066cc',
          dark:    '#003d7a',
          light:   '#7ac0ff',
          accent:  '#38a1ff',
          muted:   '#3380cc',
        },
        deepblue: {
          950: '#0a0b10',
          900: '#111218',
          800: '#1a1b23',
          700: '#23252e',
          600: '#2c2e39',
        },
        gold: {
          DEFAULT: '#C9A227',
          light:   '#E8C547',
          dark:    '#9E7B0D',
          50:      '#fefce8',
        },
        surface: {
          dark1: '#272729',
          dark2: '#2a2a2c',
          parch: '#f5f5f7',
        }
      },
      fontFamily: {
        sans:    ['Manrope', 'ui-sans-serif', 'system-ui'],
        display: ['Lexend', 'ui-sans-serif', 'system-ui'],
        manrope: ['Manrope', 'sans-serif'],
        lexend:  ['Lexend', 'sans-serif'],
      }
    }
  }
}
