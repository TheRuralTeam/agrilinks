import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";
import tokens from "./design-system/tokens.json";

const colorToHsl = (hex: string) => {
	const [r, g, b] = hex.slice(1).match(/.{2}/g)!.map((channel) => parseInt(channel, 16) / 255);
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const delta = max - min;
	const lightness = (max + min) / 2;
	let hue = 0;
	let saturation = 0;

	if (delta !== 0) {
		saturation = delta / (1 - Math.abs(2 * lightness - 1));
		if (max === r) hue = ((g - b) / delta) % 6;
		else if (max === g) hue = (b - r) / delta + 2;
		else hue = (r - g) / delta + 4;
		hue = (hue * 60 + 360) % 360;
	}

	return `${Math.round(hue)} ${Math.round(saturation * 100)}% ${Math.round(lightness * 100)}%`;
};

const semanticColor = (hex: string) => `hsl(${colorToHsl(hex)} / <alpha-value>)`;

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			fontFamily: {
				sans: [tokens.typography.family, ...tokens.typography.fallback]
			},
			screens: {
				compact: `${tokens.breakpoint.compact}px`,
				medium: `${tokens.breakpoint.medium}px`,
				expanded: `${tokens.breakpoint.expanded}px`,
				wide: `${tokens.breakpoint.wide}px`
			},
			borderRadius: {
				DEFAULT: `${tokens.radius.card}px`,
				control: `${tokens.radius.control}px`,
				card: `${tokens.radius.card}px`,
				panel: `${tokens.radius.panel}px`,
				pill: `${tokens.radius.pill}px`,
				lg: `${tokens.radius.card}px`,
				md: `${tokens.radius.card}px`,
				sm: `${tokens.radius.card}px`,
				xl: `${tokens.radius.card}px`,
				'2xl': `${tokens.radius.card}px`
			},
			colors: {
				border: 'hsl(var(--border))',
				'border-strong': 'hsl(var(--border-strong))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: {
					DEFAULT: 'hsl(var(--background))',
					secondary: 'hsl(var(--background-secondary))'
				},
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: semanticColor(tokens.color.brand.primary),
					light: 'hsl(var(--primary-light))',
					hover: 'hsl(var(--primary-hover))',
					foreground: semanticColor(tokens.color.brand.onPrimary)
				},
				secondary: {
					DEFAULT: semanticColor(tokens.color.surface.subtle),
					light: 'hsl(var(--secondary-light))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				business: {
					DEFAULT: 'hsl(var(--business))',
					light: 'hsl(var(--business-light))',
					foreground: 'hsl(var(--business-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					light: 'hsl(var(--accent-light))',
					hover: 'hsl(var(--accent-hover))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				success: {
					DEFAULT: semanticColor(tokens.color.status.success.color),
					foreground: semanticColor(tokens.color.status.success.onColor),
					surface: semanticColor(tokens.color.status.success.surface)
				},
				warning: {
					DEFAULT: semanticColor(tokens.color.status.warning.color),
					foreground: semanticColor(tokens.color.status.warning.onColor),
					surface: semanticColor(tokens.color.status.warning.surface)
				},
				destructive: {
					DEFAULT: semanticColor(tokens.color.status.danger.color),
					foreground: semanticColor(tokens.color.status.danger.onColor),
					surface: semanticColor(tokens.color.status.danger.surface)
				},
				info: {
					DEFAULT: semanticColor(tokens.color.status.info.color),
					foreground: semanticColor(tokens.color.status.info.onColor),
					surface: semanticColor(tokens.color.status.info.surface)
				},
				muted: {
					DEFAULT: semanticColor(tokens.color.surface.subtle),
					foreground: semanticColor(tokens.color.text.secondary)
				},
				border: {
					DEFAULT: semanticColor(tokens.color.border.default),
					strong: semanticColor(tokens.color.border.strong)
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))',
					border: 'hsl(var(--card-border))'
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				}
			},
			backgroundImage: {
				'gradient-primary': 'var(--gradient-primary)',
				'gradient-business': 'var(--gradient-business)',
				'gradient-hero': 'var(--gradient-hero)',
				'gradient-card': 'var(--gradient-card)'
			},
			boxShadow: {
				'xs': 'var(--shadow-xs)',
				'soft': 'var(--shadow-soft)',
				'medium': 'var(--shadow-medium)',
				'strong': 'var(--shadow-strong)',
				'glow': 'var(--shadow-glow)',
				'inner': 'var(--shadow-inner)'
			},
			transitionTimingFunction: {
				'fast': 'cubic-bezier(0.4, 0, 0.2, 1)',
				'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
				'bounce': 'cubic-bezier(0.34, 1.56, 0.64, 1)'
			},
			transitionDuration: {
				'fast': '150ms',
				'normal': '250ms',
				'slow': '400ms'
			},
			keyframes: {
				'accordion-down': {
					from: {
						height: '0'
					},
					to: {
						height: 'var(--radix-accordion-content-height)'
					}
				},
				'accordion-up': {
					from: {
						height: 'var(--radix-accordion-content-height)'
					},
					to: {
						height: '0'
					}
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out'
			}
		}
	},
	plugins: [animate],
} satisfies Config;
