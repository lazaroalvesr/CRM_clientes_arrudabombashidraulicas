---
name: Arruda Bombas · Prospecção
description: A commercial workbench for the Arruda Bombas team.
colors:
  paper: "#f5f5f2"
  surface: "#fff"
  ink: "#252b30"
  muted: "#656e76"
  line: "#e1e4e3"
  red: "#c63c28"
  green: "#227147"
  green-light: "#eaf5ee"
  nav: "#1f292e"
typography:
  display:
    fontFamily: "Segoe UI, sans-serif"
    fontSize: "clamp(38px,4vw,59px)"
    fontWeight: 600
    lineHeight: 1.09
    letterSpacing: "-.035em"
  headline:
    fontFamily: "Segoe UI, sans-serif"
    fontSize: "30px"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "-.025em"
  title:
    fontFamily: "Segoe UI, sans-serif"
    fontSize: "21px"
    fontWeight: 650
    letterSpacing: "-.025em"
  body:
    fontFamily: "Segoe UI, sans-serif"
    fontSize: "14px"
    lineHeight: 1.5
  label:
    fontFamily: "Segoe UI, sans-serif"
    fontSize: "12px"
    fontWeight: 650
rounded:
  tag: "4px"
  control: "7px"
  panel: "12px"
  dialog: "14px"
spacing:
  control-gap: "8px"
  grid-gap: "16px"
  panel-inset: "24px"
  page-inset: "36px"
components:
  button-primary:
    backgroundColor: "{colors.red}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.panel}"
    padding: "22px 24px"
---

# Design System: Arruda Bombas · Prospecção

## Overview

**Creative North Star: "Commercial workbench"**

This name describes the implemented UI contract; it is not a separately approved brand metaphor. Graphite navigation frames a daylight workspace with compact company records and red actions. The interface is restrained, operational, and written in Brazilian Portuguese.

This is a scan of `plataforma/public/index.html`, `style.css`, and `app.js`, dated 2026-09-15. No external visual board or approved composition was supplied; reference service access was unavailable. PRODUCT.md supplies the durable product constraints. The interface is prepared for hosting, but no production host or real company provider is established.

**Key Characteristics:**

- Graphite navigation and white bordered work surfaces.
- Compact records showing evidence, potential, and team ownership.
- Explicit empty, error, unknown-data, and connection states.
- Responsive company records and a right-side detail sheet.

## Colors

A signal-red primary accent sits beside quiet warm-neutral surfaces and cool graphite navigation. Frontmatter records the reused source tokens; state-specific colors remain in the source stylesheet and component examples.

### Primary

- **Signal red:** primary actions, text actions, source links, and focused field borders.

### Neutral

- **Daylight paper / white surface:** workspace and nested forms or records.
- **Graphite / ink:** persistent navigation and primary reading text.
- **Muted slate / divider:** secondary information, full-opacity placeholders, and structural borders.

Green denotes qualified or positive evidence and WhatsApp actions. Amber marks intermediate priority and provider notices; these are status roles rather than additional brand accents. Status labels and priority letters accompany color.

## Typography

Segoe UI with a sans-serif fallback serves every role. The system uses compact labels and readable data with restrained heading tracking. Scores use tabular numerals.

Display typography belongs to authentication. Workspace headlines reduce to (26px) at the mobile breakpoint. Section titles commonly use (15–18px); record names use (13px), and table labels and metadata use (11–12px). The smallest (10px) text is reserved for secondary brand, navigation, and footer details. These are observed sizes, not a mathematical type scale.

## Layout

The desktop shell has a fixed (224px) sidebar and a (74px) header. Content is centered within a (1500px) maximum width with the page inset from frontmatter. Filters use four unequal columns; settings use two columns. Authentication uses a (46% / 54%) split with a focused form capped at (385px).

At (1150px) and below the sidebar narrows to (195px), filters become two columns, and settings stack. At (800px) and below navigation becomes a toggled drawer, the header becomes (65px), page padding becomes (26px 18px), and company results become stacked records with retained table semantics. The users table can scroll within its container. Authentication stacks its story above the form. At (420px) and below filter and dialog forms use one column, as does the detail grid. Above (1600px), top spacing increases.

## Elevation & Depth

Everyday panels are flat white surfaces with fine borders. Shadows identify overlays: dialogs use `0 20px 70px #17242933`, mobile navigation uses `14px 0 50px #1b292033`, and toast messages use `0 8px 24px #12201824`. A dark translucent dialog backdrop separates the active task. The detail sheet has a sticky white heading.

## Shapes

Controls have gently rounded corners; tags are tighter and panels softer, following frontmatter. Avatars are circular. Dialogs use the dialog radius, while the edge-attached detail sheet is square. Small inline outline SVGs carry consistent strokes rather than icon-font glyphs.

## Components

- **Buttons:** white bordered secondary, red primary, transparent quiet, and pale-green WhatsApp variants. Standard minimum height is (42px); compact controls use (34px). Hover changes backgrounds and borders over (.16s). Keyboard focus uses a (3px) warm outline with (3px) offset. Disabled buttons use (.55) opacity.
- **Fields:** white, bordered, at least (43px) high; textarea minimum height is (94px). Focus adds a red border and a subtle (3px) red halo. Placeholders use the muted token at full opacity. Errors appear in explicit warm-tinted alert blocks.
- **Navigation:** left-aligned icon and text rows on graphite; active rows use a lighter graphite fill, white text, and a warm icon. Mobile navigation is hidden until opened and moves over (.2s).
- **Chips and status:** compact rounded text labels. Priority letters and numeric scores keep qualification legible without color alone. Chips describe segments; status tags describe follow-up stage.
- **Panels and records:** bordered filters, settings blocks, and result containers. Company rows combine initials, company and city, segment, priority, evidence, ownership, and actions. Mobile composition preserves those relationships.
- **Detail sheet:** right attached, (540px) wide up to the viewport width; evidence, source, scoring rules, contact actions, and follow-up fields are separated into readable sections.
- **Feedback:** centered explanatory empty states; connection notices above filters; toast feedback fades over (.18s). Reduced-motion preference removes transitions and animations.

## Do's and Don'ts

### Do:

- **Do** preserve visible labels, keyboard focus, and full-opacity muted placeholders.
- **Do** pair status colors with words, letters, or numeric scores.
- **Do** keep company evidence and unknown information explicit in Brazilian Portuguese.
- **Do** use existing border, radius, and spacing relationships for new work surfaces.

### Don't:

- **Don't** imply a configured provider or verified company data when unavailable.
- **Don't** turn ordinary work panels into elevated overlays.
- **Don't** replace the responsive company records with a clipped desktop table on mobile.
