---
name: Strom configured Vene demo
description: Seeded Strom settings on the existing Vene storefront; not a platform-wide design system.
colors:
  primary: "#151515"
  secondary: "#ffdf00"
  background: "#fcfbf7"
typography:
  display:
    fontFamily: "Sora, sans-serif"
  body:
    fontFamily: "Manrope, sans-serif"
rounded:
  card: "12px"
---

# Design System: Strom configured Vene demo

## Overview

Strom uses the existing `vene` template through ordinary merchant configuration. This document records that demo's seeded settings; Roma, Dana, Vene defaults and the platform UI retain their existing identities.

Values describe the seeded demonstration defaults; merchant design settings can override supported colors, typography and radii.

## Colors

The seed sets primary black and secondary yellow (`theme.accent`), with `useTemplateColors: false`. Yellow banner artwork and purchase information accompany black announcement/footer surfaces. Primary contrast is white; secondary contrast and body text are black.

## Typography

`font: "template"` inherits Vene's Sora headings and Manrope body typography from the shared storefront. There is no Strom-specific type scale.

## Layout

Inherit Vene's shared responsive layouts. The seed orders standard banners, purchase information, featured categories and two product groups. Six categories use the existing `three-even` mosaic; mobile product columns are configured to two.

## Shapes

The demo configures a 12 px card radius and square, contained product images. Other shapes follow the existing template and shared commerce components.

## Components

Banners, category tiles, purchase information (including wholesale contact) and product groups are configured in the same merchant editor that renders the public storefront. The desktop and mobile R2 banners use stock photography as a full-bleed image across the complete hero, without a yellow split or inset photo; only a compact translucent black panel sits behind the white copy for contrast. Title, description, position and links remain editable banner fields. Photo sources, license and crop details are recorded in `prisma/strom-banners.ts` and embedded in `prisma/strom-assets/`; the stock imagery is illustrative, not Strom inventory or an endorsement. Both banners link to the catalog. `pnpm strom:banners` verifies the current tenant and artwork; add `--apply` to publish the photos and update only the two banner items. Commerce uses shared components without a custom Strom runtime branch.

## Do's and Don'ts

- Do preserve the public lightning logo, readable product packaging and prominent demo disclosures through checkout and order tracking.
- Do adapt Strom through the existing template configuration and editor.
- Don't introduce a fourth template or impose these demo settings on other tenants or the platform UI.
- Don't present illustrative inventory, prices or payment instructions as confirmed Strom commercial data.
