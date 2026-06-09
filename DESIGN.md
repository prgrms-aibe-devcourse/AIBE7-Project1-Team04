---
name: Modern Professional Pulse
colors:
  surface: '#f9f9ff'
  surface-dim: '#d3daef'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f1f3ff'
  surface-container: '#e9edff'
  surface-container-high: '#e1e8fd'
  surface-container-highest: '#dce2f7'
  on-surface: '#141b2b'
  on-surface-variant: '#434655'
  inverse-surface: '#293040'
  inverse-on-surface: '#edf0ff'
  outline: '#737686'
  outline-variant: '#c3c6d7'
  surface-tint: '#0053db'
  primary: '#004ac6'
  on-primary: '#ffffff'
  primary-container: '#2563eb'
  on-primary-container: '#eeefff'
  inverse-primary: '#b4c5ff'
  secondary: '#ae3025'
  on-secondary: '#ffffff'
  secondary-container: '#fc6958'
  on-secondary-container: '#690002'
  tertiary: '#4c5660'
  on-tertiary: '#ffffff'
  tertiary-container: '#646e78'
  on-tertiary-container: '#e7f1fd'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dbe1ff'
  primary-fixed-dim: '#b4c5ff'
  on-primary-fixed: '#00174b'
  on-primary-fixed-variant: '#003ea8'
  secondary-fixed: '#ffdad5'
  secondary-fixed-dim: '#ffb4a9'
  on-secondary-fixed: '#410001'
  on-secondary-fixed-variant: '#8c1711'
  tertiary-fixed: '#dae4ef'
  tertiary-fixed-dim: '#bdc8d3'
  on-tertiary-fixed: '#131d25'
  on-tertiary-fixed-variant: '#3e4851'
  background: '#f9f9ff'
  on-background: '#141b2b'
  surface-variant: '#dce2f7'
typography:
  headline-lg:
    fontFamily: Montserrat
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Montserrat
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Montserrat
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-sm:
    fontFamily: Montserrat
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Montserrat
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Montserrat
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Montserrat
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Montserrat
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  container-max: 1200px
  gutter: 24px
---

## Brand & Style
The design system embodies a Corporate Modern aesthetic—balancing high-performance reliability with a vibrant, energetic edge. It is designed for professional environments that require clarity and efficiency without sacrificing personality. The primary blue signals trust and stability, while the secondary coral injects a sense of urgency and warmth, preventing the UI from feeling sterile. 

The overall style utilizes clean lines, ample whitespace, and subtle depth to guide the user's focus. It prioritizes functional elegance, ensuring that data-heavy interfaces remain legible and approachable.

## Colors
This palette is anchored by a high-contrast relationship between deep blues and clean whites. 

- **Primary (#2563EB):** Used for main actions, active states, and brand recognition.
- **Secondary (#FF6B5A):** Reserved for highlights, notifications, or call-to-action buttons that need to stand out from the primary blue.
- **Background (#F4F8FF):** A cool, tinted white that reduces eye strain and differentiates the canvas from card elements.
- **Surface (#FFFFFF):** Used for cards, modals, and input fields to create a clear "lift" from the background.
- **Text Hierarchy:** Main headings and body text use #111827 for maximum readability, while secondary information uses #6B7280.

## Typography
Montserrat is utilized across all levels to maintain a cohesive, geometric, and modern feel. 

- **Headlines:** Use Bold (700) or Semi-Bold (600) weights with slight negative letter-spacing for a tight, professional look.
- **Body:** Standardized at 16px for optimal readability. Use the "Medium Grey" (#6B7280) for longer passages of secondary text to reduce visual weight.
- **Labels:** Small labels and captions should use a heavier weight (600) and uppercase styling to ensure they remain legible at smaller scales.

## Layout & Spacing
The layout follows a strict 8px grid system to ensure mathematical harmony between elements. 

- **Grid:** A 12-column fluid grid is preferred for desktop, transitioning to 4 columns for mobile.
- **Margins:** Standard page margins are set to 24px (lg) on mobile and scale up to 48px or auto-centering on large displays.
- **Sectioning:** Use the XL (32px) spacing unit to separate major content blocks, and the MD (16px) unit for internal component padding.

## Elevation & Depth
This design system uses a "Tonal Layering" approach combined with soft ambient shadows. 

- **Level 0 (Background):** #F4F8FF. Flat.
- **Level 1 (Cards/Surface):** #FFFFFF. Use a very soft, diffused shadow: `0 4px 20px rgba(37, 99, 235, 0.04)`. Note the subtle blue tint in the shadow to harmonize with the primary brand color.
- **Level 2 (Modals/Popovers):** #FFFFFF. High elevation shadow: `0 12px 32px rgba(17, 24, 39, 0.08)`.
- **Interactions:** On hover, cards should slightly lift (increase shadow spread) rather than change color, maintaining the integrity of the white surface.

## Shapes
Following the "ROUND_EIGHT" (8px) principle, the design system utilizes a balanced corner radius that feels friendly but remains structured.

- **Standard (8px):** Buttons, Input Fields, and Cards.
- **Large (16px):** Modals and large promotional banners.
- **Small (4px):** Checkboxes, tags, and internal nested elements.

## Components
- **Buttons:** Primary buttons use a solid #2563EB fill with white text. Secondary buttons use #FF6B5A to draw attention to alternative actions. Ghost buttons use the Primary color for text and a #DDE7F3 border.
- **Input Fields:** Use #FFFFFF background with a #DDE7F3 border. On focus, the border transitions to #2563EB with a 2px thickness.
- **Cards:** White backgrounds with an 8px corner radius and Level 1 elevation. Padding should be a consistent 24px (lg).
- **Chips/Tags:** Small 4px rounded corners. Use a light tint of the primary color (e.g., 10% opacity) for the background and the full primary hex for the text.
- **Lists:** Separated by thin 1px horizontal lines using the Border color (#DDE7F3).
- **Navigation:** Top navigation bars should be white with a subtle bottom border (#DDE7F3) rather than a shadow to keep the header feeling "anchored" rather than "floating."