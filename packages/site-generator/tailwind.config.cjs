module.exports = {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "hsl(var(--color-primary))",
          light: "hsl(var(--color-primary-light))",
          dark: "hsl(var(--color-primary-dark))",
        },
        secondary: {
          DEFAULT: "hsl(var(--color-secondary))",
          light: "hsl(var(--color-secondary-light))",
          dark: "hsl(var(--color-secondary-dark))",
        },
        accent: {
          DEFAULT: "hsl(var(--color-accent))",
          light: "hsl(var(--color-accent-light))",
          dark: "hsl(var(--color-accent-dark))",
          soft: "hsl(var(--color-accent-soft))",
        },
        surface: {
          DEFAULT: "hsl(var(--color-surface))",
          muted: "hsl(var(--color-surface-muted))",
          tint: "hsl(var(--color-surface-tint))",
          elevated: "hsl(var(--color-surface-elevated))",
        },
        text: {
          primary: "hsl(var(--color-text-primary))",
          secondary: "hsl(var(--color-text-secondary))",
          muted: "hsl(var(--color-text-muted))",
        },
        border: {
          DEFAULT: "hsl(var(--color-border))",
          strong: "hsl(var(--color-border-strong))",
        },
        ink: {
          DEFAULT: "hsl(var(--color-ink))",
          soft: "hsl(var(--color-ink-soft))",
        },
        "white-soft": "hsl(0 0% 100% / 0.85)",
      },
      fontFamily: {
        primary: ["var(--font-primary)", "serif"],
        secondary: ["var(--font-secondary)", "sans-serif"],
      },
      fontSize: {
        "display-xl": ["clamp(3.5rem, 8vw, 7rem)", { lineHeight: "1.05", letterSpacing: "-0.02em" }],
        "display-lg": ["clamp(2.5rem, 5vw, 4.5rem)", { lineHeight: "1.1", letterSpacing: "-0.01em" }],
        "display-md": ["clamp(2rem, 4vw, 3rem)", { lineHeight: "1.15" }],
        "display-sm": ["clamp(1.5rem, 3vw, 2.25rem)", { lineHeight: "1.2" }],
        "heading-xl": ["clamp(1.75rem, 3vw, 2.5rem)", { lineHeight: "1.25" }],
        "heading-lg": ["clamp(1.5rem, 2.5vw, 2rem)", { lineHeight: "1.3" }],
        "heading-md": ["clamp(1.25rem, 2vw, 1.5rem)", { lineHeight: "1.35" }],
        "heading-sm": ["clamp(1.125rem, 1.5vw, 1.25rem)", { lineHeight: "1.4" }],
        "body-lg": ["1.125rem", { lineHeight: "1.7" }],
        "body": ["1rem", { lineHeight: "1.6" }],
        "body-sm": ["0.875rem", { lineHeight: "1.5" }],
        "caption": ["0.75rem", { lineHeight: "1.5", letterSpacing: "0.02em" }],
      },
      boxShadow: {
        "glow": "0 0 40px -10px var(--color-accent)",
        "glow-lg": "0 0 80px -20px var(--color-accent)",
        "soft": "var(--shadow-soft)",
        "card": "var(--shadow-card)",
        "card-lg": "var(--shadow-lift)",
        "card-hover": "0 20px 64px -16px rgb(0 0 0 / 0.2), 0 8px 24px -8px rgb(0 0 0 / 0.1)",
      },
      backgroundImage: {
        "noise": "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E\")",
      },
      animation: {
        "fade-in": "fadeIn 0.6s ease-out forwards",
        "fade-in-up": "fadeInUp 0.8s ease-out forwards",
        "fade-in-down": "fadeInDown 0.8s ease-out forwards",
        "float": "float 6s ease-in-out infinite",
        "bounce-slow": "bounce 2s infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(30px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeInDown: {
          "0%": { opacity: "0", transform: "translateY(-30px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-20px)" },
        },
      },
    },
  },
  plugins: [],
};
