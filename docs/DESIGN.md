Here’s a structured **Scandinavian Minimalism Web App Design Guide** you can hand straight to a UI developer. It extracts principles from the mockup and expands them into a full design system with tokens, colors, typography, spacing, and components.

---

# Scandinavian Minimalism Design Guide

## 1. Core Principles

* **Clarity before decoration**: everything serves function.
* **Whitespace is active**: generous padding and breathing room.
* **Neutral color palette**: light, soft, and calm with minimal accents.
* **Simple geometry**: rounded edges, no clutter.
* **Typography hierarchy**: clean sans-serif, strong weight contrast.

---

## 2. Color Palette (Tokens)

```css
--color-bg: #FAFAF9;          /* Off-white background */
--color-surface: #FFFFFF;     /* White surface/cards */
--color-border: #E5E5E5;      /* Light gray borders */
--color-text-primary: #1A1A1A;    /* Near-black for headings */
--color-text-secondary: #4D4D4D;  /* Soft gray for body */
--color-text-muted: #7A7A7A;      /* Even lighter for metadata */

/* Accent Colors (Nature-inspired) */
--color-accent-1: #2D2D2D;    /* Charcoal – strong neutral, primary action */
--color-accent-2: #6BAA75;    /* Sage green – calm, natural balance */
--color-accent-3: #A3B6D3;    /* Nordic blue – crisp, airy */
--color-accent-4: #D9A982;    /* Sand/clay – warmth against neutrals */

```

---

## 3. Typography

**Font family**:
`Inter`, `Helvetica Neue`, `Arial`, sans-serif.

**Scale (tokens)**:

```css
--font-h1: 32px/40px;  /* Large hero headings */
--font-h2: 24px/32px;  /* Section headings */
--font-body: 16px/24px; /* Paragraph text */
--font-small: 14px/20px; /* Labels, meta */
```

**Weight system**:

* Headings: `700` (bold).
* Body: `400` (regular).
* Labels/buttons: `500` (medium).

---

## 4. Spacing System

Use multiples of **8px** (Nordic rhythm: clean and consistent).

```css
--space-xxs: 4px;
--space-xs: 8px;
--space-sm: 16px;
--space-md: 24px;
--space-lg: 32px;
--space-xl: 48px;
```

---

## 5. Borders and Radius

```css
--radius-sm: 6px;
--radius-md: 12px;
--radius-lg: 20px;
```

Use **radius-md** for input fields and buttons.
Use **radius-lg** sparingly on cards/sections.

Borders:
`1px solid var(--color-border)`

---

## 6. Shadows

Keep shadows subtle to maintain minimalism:

```css
--shadow-sm: 0px 1px 2px rgba(0,0,0,0.04);
--shadow-md: 0px 2px 6px rgba(0,0,0,0.08);
```

Apply only to cards, modals, dropdowns.

---

## 7. Components

### Buttons

Primary (dark outline look from mockup):

```css
background: transparent;
border: 1px solid var(--color-accent);
border-radius: var(--radius-md);
padding: var(--space-xs) var(--space-sm);
color: var(--color-accent);
font-weight: 500;
```

Hover:
Background: `var(--color-accent)`
Text: `#FFFFFF`

---

### Input Fields

```css
background: #FFFFFF;
border: 1px solid var(--color-border);
border-radius: var(--radius-md);
padding: var(--space-xs) var(--space-sm);
font-size: var(--font-body);
```

Focus:
Border `1px solid var(--color-accent)`
Shadow `var(--shadow-sm)`

---

### Cards

```css
background: var(--color-surface);
border: 1px solid var(--color-border);
border-radius: var(--radius-lg);
padding: var(--space-md);
box-shadow: var(--shadow-sm);
```

---

## 8. Layout

* Grid: 12-column, 80px max content width per column.
* Section padding: `var(--space-xl)` top and bottom.
* Header height: 64px.

---

## 9. Iconography

* Use line icons (e.g., Feather or Lucide).
* Stroke width: 1.5px.
* Color: `var(--color-text-secondary)` by default.

---

## 10. Interaction States

* **Hover**: Increase contrast (darken text or background slightly).
* **Focus**: Visible outline (`2px solid var(--color-accent)` with subtle shadow).
* **Disabled**: Reduce opacity to 40%, remove shadows.

---

This guide should be enough for a developer to set up tokens in CSS variables, Tailwind config, or a design system like Figma. It stays true to Scandinavian minimalism: clean, neutral, and breathable.

Would you like me to also create a **ready-to-paste Tailwind config file** with these tokens, so your dev can drop it straight into their project?
