---
name: Strom storefront
description: Sports-commerce demo; scope limited to the strom template.
colors:
  primary: "#ffdf00"
  ink: "#151515"
  background: "#fcfbf7"
  surface: "#ffffff"
typography:
  display:
    fontFamily: "Barlow Condensed, sans-serif"
    fontSize: "clamp(54px, 6.7vw, 96px)"
    fontWeight: 800
    lineHeight: 0.94
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Manrope, sans-serif"
rounded:
  button: "6px"
  card: "12px"
  stage: "24px"
spacing:
  desktop-gutter: "48px"
  mobile-gutter: "20px"
components:
  hero-action:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.button}"
    padding: "17px 22px"
---

# Design System: Strom

## Overview

This document governs the `strom` template only. Roma, Dana, Vene and the platform UI retain their existing identities.

Values describe the seeded demonstration defaults; merchant design settings can override supported colors, typography and radii.

## Colors

- Yellow `#ffdf00` leads the hero; ink `#151515` supplies copy and primary actions. Warm background `#fcfbf7`, white product photography surfaces.

## Typography

- Barlow Condensed 600/700/800 for display and section headings, uppercase; Manrope for body and commerce details. Display up to 96 px with −0.025 em tracking.

## Layout

The storefront container is 1440 px; checkout is 1160 px. Below 800 px, Strom checkout places the summary in the form before the final action.
- Wide two-column yellow hero: headline and catalog actions at left, product stage at right. On phones copy precedes a 300 px product stage.
- Desktop six-column category rail; three at intermediate widths and two on phones. Product grids use four columns, with two on mobile.
- 48 px desktop and 20 px phone gutters; section spacing 60–70 px desktop and 40 px phone.

## Elevation & Depth

Large surfaces rely on contrasting flat grounds, borders and isolated product photography rather than decorative shadows.

## Shapes

- Product surfaces use 12 px corners, stage 24 px desktop/16 px mobile, action buttons 6 px. No decorative gradients or glow.

## Components

- Shared commerce pages use black text for prices, links and totals; yellow actions retain black labels. Visible black focus rings and reduced-motion support.
- Home banners, category selection and product groups are stored in the existing visual configuration. Wholesale callout belongs to the sports storefront template.

## Do's and Don'ts

- Do preserve the public lightning logo, readable product packaging and prominent demo disclosures through checkout and order tracking.
- Do use black text for yellow controls and commerce totals.
- Don't apply these rules to the other storefront templates or platform UI.
- Don't present illustrative inventory, prices or payment instructions as confirmed Strom commercial data.
