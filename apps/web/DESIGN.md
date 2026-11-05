---
name: Weekend Food Hub
description: A hand-marked kitchen label from Tapilon, Daanbantayan, carried as a logo system and printed on every order.
colors:
  ink-charcoal: "#2E2A26"
  brand-orange: "#EA580C"
  kraft-label: "#CDAE86"
  dill-sprig: "#5C7F4A"
  dill-sprig-on-dark: "#9BBF84"
  cabbage-ruby: "#B21E4B"
  mist: "#F7F5EE"
  thermal-black: "#000000"
typography:
  script-name:
    fontFamily: "Yellowtail, cursive"
    fontWeight: 400
    lineHeight: 1
  stamped-caps:
    fontFamily: "Zilla Slab, Rockwell, serif"
    fontWeight: 700
    lineHeight: 1
  caption-caps:
    fontFamily: "Zilla Slab, Rockwell, serif"
    fontWeight: 600
    lineHeight: 1
components:
  app-icon:
    backgroundColor: "{colors.brand-orange}"
    textColor: "{colors.ink-charcoal}"
    size: "512px"
  avatar:
    backgroundColor: "{colors.brand-orange}"
    textColor: "{colors.ink-charcoal}"
    size: "1024px"
  kitchen-label:
    backgroundColor: "{colors.kraft-label}"
    textColor: "{colors.ink-charcoal}"
    width: "1120px"
    height: "600px"
  kitchen-label-sweet-treats:
    backgroundColor: "{colors.kraft-label}"
    textColor: "{colors.ink-charcoal}"
    width: "1000px"
    height: "470px"
  lockup-reverse:
    backgroundColor: "{colors.ink-charcoal}"
    textColor: "{colors.mist}"
  lockup-mono:
    backgroundColor: "#FFFFFF"
    textColor: "{colors.thermal-black}"
---

# Design System: Weekend Food Hub

<!-- Scope: the first part records Weekend Food Hub's brand identity (logo system) shipped in public/brand/, src/app/icon.svg and the staff app icons. "Storefront theme" at the end records how that identity became the shared web theme for every store on the site (src/app/globals.css, @wfh/shared theme.ts), each store with its own accent. -->

## Overview

**Creative North Star: "The Hand-Marked Kitchen Label"**

The brand is the label a cook writes on a jar, a frozen pack or tonight's order: a connected brush-script name over stamped, wide-tracked slab capitals, finished with a drawn swash, two dill sprigs and a dotted rule. It is meant to read as made by hand in a real kitchen in Tapilon, and it lives where the kitchen's work already lives: the Facebook Page avatar, the site header and the sticker printed on every order bag.

The system is two voices and one saturated field. Every letter is charcoal ink (or mist on dark, or pure black on thermal paper). Brand orange is the one loud colour, used as a full field (icon, avatar, Android background) or as a fine dotted rule, never as letters. Kraft is the label ground; dill is only ever the sprigs; cabbage ruby belongs to the Sweet Treats by Yang band alone. Depth is flat print: no gradients, no shadows, no texture overlays.

The identity rejects the round food-stall badge with spoon, fork and ribbon. A round crop exists only because platforms mask the avatar that way; it carries no emblem furniture.

**Key Characteristics:**
- Brush-script name (Yellowtail) over stamped slab caps (Zilla Slab), both outlined to paths in every logo file.
- The d's exit stroke becomes a tapered swash that sweeps back under the whole of "Weekend" and runs clear of the capitals below.
- Paired dill leaf sprigs flank the stamped caps.
- Notched ticket corners (concave quarter-circle cuts) on the label and the square icon, with an inset rule that follows the notch.
- Dotted rules and middot-separated rows of stamped facts.
- Black-only versions that survive a 203 dpi thermal printer.

## Colors

A flat print palette: warm charcoal ink on white, kraft or orange, with one saturated field colour and two small accents that each have exactly one job.

### Primary
- **Market Orange** (brand-orange): the one saturated field. Fills the square icon, the avatar, the favicon and the Android adaptive-icon background (`apps/staff/app.json`). On white and on charcoal grounds it draws the fine dotted rule above the origin line. It is never used for letters.

### Secondary
- **Dill Sprig** (dill-sprig): the paired leaf sprigs beside the stamped caps, on white and on kraft. Nothing else.
- **Pale Dill** (dill-sprig-on-dark): the same sprigs when the lockup sits on charcoal (the reverse lockup).

### Tertiary
- **Cabbage Ruby** (cabbage-ruby): the horizontal band across the top of the Sweet Treats by Yang label. Reserved for that sub-brand.

### Neutral
- **Ink Charcoal** (ink-charcoal): every letter, the swash, the label's inset rule and the label's dotted rules; also the ground behind the reverse lockup.
- **Kraft Label** (kraft-label): the label ground, for the main label lockup and sub-brand labels.
- **Mist** (mist): letters and swash in the reverse lockup on charcoal.
- **Thermal Black** (thermal-black): the only colour in the one-colour versions (mono, mono-compact, Android monochrome).

### Named Rules
**The One Field Rule.** Orange appears as a whole ground or as a hairline dotted rule, never as type. Letters on orange are charcoal; kraft or mist on orange falls near 2:1 and is not used.

**The One Job Rule.** In the marks, dill is sprigs and ruby is the Sweet Treats band. Neither becomes a text, border or background colour elsewhere. (On the website, ruby is Sweet Treats by Yang's store accent; see "Storefront theme".)

**The Black Means Black Rule.** One-colour versions are pure black, not charcoal, so thermal printers render them solid.

## Typography

**Display Font:** Yellowtail (brush script; Google Fonts, Apache 2.0)
**Label Font:** Zilla Slab Bold and SemiBold (slab serif; Google Fonts, OFL)

**Character:** A quick, confident marker hand for names over the flat, even capitals of a rubber stamp for facts. The script is personal; the caps are matter-of-fact.

Both faces are outlined to paths in every logo file, so the marks do not depend on font loading. The web app loads both (next/font) for the storefront theme, with Geist for UI text; see "Storefront theme".

### Hierarchy
- **Script Name** (Yellowtail, 400): the brand or sub-brand name only ("Weekend", "Sweet Treats"), set large. In the primary lockup the d's exit stroke is redrawn as the swash.
- **Stamped Caps** (Zilla Slab Bold 700, uppercase, wide tracking): the second line of the name ("FOOD HUB", "BY YANG"), between the sprigs.
- **Caption Caps** (Zilla Slab SemiBold 600, uppercase, wider tracking, small): origin and category facts ("TAPILON · DAANBANTAYAN", "CHAOFAN · SILOG · PALUTO · FROZEN", "WEEKEND FOOD HUB · TAPILON"), separated by middots.

### Named Rules
**The Two Voices Rule.** Script is for names; slab caps are for facts. No third face, no script facts, no slab names.

**The Feeling Not Schedule Rule.** "Weekend" is always set as a name in script, never paired with days or times in the mark.

## Layout

Lockups are centred and stacked: script name, swash, stamped caps flanked by sprigs, then (in the full versions) a rule and the origin line. The swash spans from under the W to the d's bowl and sits in the gap between the script and the caps without touching either line of capitals.

The system ships as sized cuts rather than one scalable mark:
- **Primary lockup** (`logo.svg`, 1000 x 400): the full mark with sprigs, orange dotted rule and origin line. Also `logo-2000.png`.
- **Compact lockup** (`logo-compact.svg`, 1000 x 300): script, swash, caps and sprigs; no rule or origin line. For site headers.
- **Reverse lockup** (`logo-reverse.svg`): mist letters, pale dill sprigs and orange dotted rule, for charcoal grounds.
- **Label lockup** (`logo-label.svg`, 1120 x 600): the mark inside the kraft label, with an origin caption row above the top dotted rule and a category row below the bottom one. Also `logo-label-2240.png`.
- **Mono** (`logo-mono.svg`): pure black, sprigs kept, solid rule in place of dots. Also `logo-mono-1000.png`.
- **Mono compact** (`logo-mono-compact.svg`): black script, swash and caps only; no sprigs, rule or origin line. For thermal labels under about 50 mm.
- **Icon** (`icon.svg`, 512): notched orange square with inset charcoal rule and charcoal script W.
- **Icon small** (`icon-small.svg`, also `src/app/icon.svg`): the notched square without the inset rule and with a larger W, below 64 px.
- **Avatar** (`avatar.svg`, `avatar-1024.png`): full-bleed orange square with the W, for round or rounded platform masks.

On the Android adaptive icon the W stays within about 0.21 of the canvas from centre so the launcher mask never clips it.

## Elevation & Depth

Flat print. There are no shadows, gradients, glows or paper textures in any file; separation comes from ground colour (white, kraft, orange, charcoal) and from the inset rule on the label and icon.

### Named Rules
**The Printed Matter Rule.** Every version must be reproducible by a single-pass printer. If an effect cannot be printed flat, it is not part of the mark.

## Shapes

The signature shape is the notched ticket: a rectangle with each corner cut by a concave quarter circle (about 1/8 of the side on the 512 icon, about 1/13 of the short side on the label). An inset rule, 3 units on the label and 7 on the 512 icon, follows the same outline with a smaller notch. Masked platforms (avatar, iOS, Android) drop the notch and the inset rule because the platform supplies the shape, and the small icon drops the inset rule for legibility.

Rules are dotted (evenly spaced small round dots) in colour and solid bars in black versions. The swash is a single tapered stroke; in black versions its thin end keeps a minimum stroke width so a 203 dpi printer does not break it. Where the swash crosses its own d, a thin knockout keeps the strokes apart.

## Components

### Square Icon
- **Shape:** notched square, inset charcoal rule (icon.svg) or no rule (icon-small.svg).
- **Colour:** orange field, charcoal script W, no swash.
- **Use:** favicon and app icon; `icon-small` below 64 px.

### Avatar
- **Shape:** full-bleed square, cropped round or rounded by the platform.
- **Colour:** orange field, charcoal W, no notch, no inset rule, no swash.

### Kitchen Label
- **Shape:** notched kraft ticket with a charcoal inset rule.
- **Content:** origin caption row (Tapilon, Daanbantayan, Cebu), charcoal dotted rule, the lockup, charcoal dotted rule, category row.
- **Colour:** kraft ground, charcoal letters and rules, dill sprigs. No orange on kraft.

### Sub-brand Label (Sweet Treats by Yang, demonstration)
- **Shape:** the same notched kraft ticket, with a cabbage-ruby band across the top inside the inset rule.
- **Content:** sub-brand name in script, "BY YANG" in stamped caps between dill sprigs, dotted rule, and the parent line "WEEKEND FOOD HUB · TAPILON".
- **Status:** drawn as a demonstration only, pending owner approval.

## Do's and Don'ts

### Do:
- **Do** set every letter in Ink Charcoal on white, kraft or orange, in Mist on charcoal, and in pure black in one-colour versions.
- **Do** use the compact lockup for headers, mono-compact for thermal labels under about 50 mm, and icon-small below 64 px.
- **Do** keep the swash clear of the stamped caps; it sweeps under the script and stops short of the capitals.
- **Do** give a sub-brand its own name in script and its own band colour on the kraft label, while keeping charcoal letters, dill sprigs and the notched ticket shared.
- **Do** separate facts in a caption or category row with middots.

### Don't:
- **Don't** set letters in orange, or put kraft or mist letters on orange.
- **Don't** use dill for anything but the sprigs, or ruby for anything but the Sweet Treats band.
- **Don't** add a swash, notch or inset rule to the avatar or other platform-masked icons.
- **Don't** build a round emblem badge with spoon, fork or ribbon; the round avatar is a platform crop, not a badge.
- **Don't** add shadows, gradients or textures to any version of the mark.
- **Don't** run the swash through FOOD HUB with a knockout; it was tested and cost legibility at the 44 px header size.
- **Don't** lift the label's caption row into web pages as a small-caps eyebrow over sections; it belongs to the printed label.

## Storefront theme

Every store on the site shares one web theme drawn from this identity: the kitchen-label look with each store's own accent. It is the same idea as the sub-brand label (shared charcoal letters and notched ticket, its own band colour), applied to a screen. A new store looks finished on day one and belongs to the same family without looking like a Weekend Food Hub branch.

### Colour
- **Ink:** every letter is Ink Charcoal on white or Mist. The page ground is Mist, cards and inputs are white (`surface`). Warm greys come from the `ink-50…950` ramp in `src/app/globals.css`, where `ink-900` is Ink Charcoal.
- **Dark mode is the reverse lockup:** a charcoal ground (`ink-950`, cards `ink-900`) with Mist letters.
- **Store accent:** each store picks one accent (`store.stores.accent_color`; Weekend Food Hub Market Orange `#EA580C`, Sweet Treats by Yang Cabbage Ruby `#B21E4B`). `accentTheme()` in `packages/shared/src/theme.ts` turns it into CSS variables, set on a `.store-theme` wrapper (store pages) or streamed onto `:root` (admin):
  - `accent` (Tailwind colour; CSS `--accent-line`): dotted rules, progress bars, borders, focus rings and hover underlines. It is the store's colour, or the nearest lighter or darker shade that reaches 3:1 on the page and cards (Mist and white in light mode; charcoal page and cards in dark mode), so a pale or very dark accent never vanishes.
  - `accent-button` and `on-accent`: the button field and its letters. Letters are Ink Charcoal or white, whichever contrasts more; if neither reaches 4.5:1 on the accent, the button uses the nearest shade that does. In dark mode the field must also stand 3:1 off the charcoal grounds. Market Orange buttons are `#F5621F` with charcoal letters (4.5:1) in both modes; ruby buttons are the accent with white letters, lifted to `#CE3D61` in dark mode.
  - `accent-soft`: a pale tint (deep tint in dark mode) for notes and the selected-state ground, always with ink or mist letters.
  - Each value has a light and dark version (`--accent-line-light`/`-dark` and so on); `globals.css` picks the active one per colour scheme.
- **Kraft soft** (`kraft-soft`): the ground for the store's standing notes (pickup, delivery and notice text).
- **Secondary text** uses `muted` (ink-600 in light, ink-400 in dark): at least 5.5:1 everywhere. Lighter greys are for borders and disabled states only. Input borders are ink-500 (ink-400 in dark) so fields read at 3:1.
- **Status colours** stay semantic and flat: green (available, open), amber (subject to availability, paused), red (sold out, errors).

### Named Rules
**The One Field Rule, on screen.** The accent is a field (buttons, the cart bar, selected chips, progress bars, dotted rules) and never letters. Links are charcoal with an ink underline (`linkClass`), turning to the accent only on hover. Admins pick the accent in Hours & settings, which shows a live preview and blocks nothing: the contrast rule adjusts the button shade instead.

**The Two Voices Rule, on screen.** Yellowtail is only for the store's name in the store header (or the store's uploaded logo instead). Zilla Slab caps (`.stamp`) are for short facts: tagline, category chips and headings, badges, the open/closed pill, order codes. Body text, forms and prices use Geist, the one UI text face, for reading on phones.

**The Printed Matter Rule, on screen.** No shadows or glass (backdrop blur) anywhere, including dialogs, menus, toasts and the cart bar: separation comes from borders and solid grounds.

**The Thumb Rule.** Anything tapped on a phone (chips, quantity steppers, close buttons, header and footer links) is at least 44 px tall. Emoji are not used as icons.

### Shapes and rules
- **Notched ticket card** (`.ticket-card`): menu items, the checkout summary and the order card. Concave 12 px corner cuts with a 1 px rule that follows them, painted as background layers on the card itself so dialogs opened from inside a card still cover the page. Other cards, inputs and buttons keep plain rounded corners.
- **Dotted rule** (`.rule-dotted`): round dots in the store's accent, under the store header.
- **Facebook prompt** (`src/components/facebook-prompt.tsx`): a kraft-soft note, "Hey, like our page if you haven't already. That will help us a lot.", with an outline button that opens the store's Facebook Page (`store.stores.facebook_url`). Shown under "Place order" at checkout and under the status on the order page (not on cancelled or rejected orders). A plain link: nothing loads from Facebook, whose external Like button was retired in February 2026.
- **Store header** (`src/components/store-header.tsx`): the name in script (or the logo), the tagline in stamped caps on the menu page, then the dotted rule. Every store page (menu, checkout, account, login, order status, legal pages opened from a store) starts with it.

### What stays out of the theme
- Kraft as a card ground, dill sprigs and the label's caption rows belong to printed labels and logo files, not web pages.
- The kitchen ticket and item labels (`/admin/print`) stay pure black for thermal printers.
