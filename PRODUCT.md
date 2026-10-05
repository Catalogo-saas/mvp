# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Product Purpose

Multi-tenant storefront SaaS with configurable catalogs, product options, cart, checkout, order tracking and merchant management. See README.md for platform workflows.

## Users

Merchants manage their stores; shoppers browse products and order. The Strom demonstration is also a sales presentation to the prospective merchant.

## Capabilities and Constraints

Strom must use the existing commerce system and preserve other tenants. Its 24-product catalog, prices, stock, payment details and delivery conditions are illustrative. Demo orders must not send emails or collect real payments.

## Brand Commitments

For the Strom demo: use the existing Vene template and merchant configuration, with black primary, yellow secondary, the public lightning logo, real product photography and a complete checkout. Inherit Vene's Manrope/Sora typography and shared commerce layouts. Banners, categories, purchase information and product groups remain editable in the existing merchant editor; R2-hosted SVG banner artwork is separate from editable copy. No custom Strom runtime branch.

## Evidence on Hand

Instagram https://www.instagram.com/strom.suplementos/ confirms yellow/black branding, retail and wholesale, sports supplements, apparel, accessories and Bolívar 403. ENA whey and Star creatine 300 g were identified visually. Other catalog items are representative; manufacturer source pages and image origins are in prisma/strom-catalog.json.

## Betel

Betel is a real published merchant at `/betel`, configured through the existing Dana template and editor. Preserve the supplied original logo and the confirmed cream (`#F8EDE2`), copper (`#8C4F37`), rose (`#D5A095`) and brown (`#4B2415`) palette. Its initial catalog is empty, with Indumentaria and Hogar categories and WhatsApp +54 381 348-8267. Payment, delivery and WhatsApp ordering remain disabled until the merchant supplies actual conditions. This tenant configuration does not replace Strom's documented design context or establish a new platform identity. [Betel's handoff](docs/BETEL.md) records provenance, verification and the distinction between published tenant data and local shared UI changes awaiting application deployment.
