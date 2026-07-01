# Design System

## Name

Fresh Operations

## Product Surface

Com Tam Lang CEO BI dashboard: a production Next.js app shell with sidebar navigation, top status bar, filter bar, KPI cards, Recharts visualizations, data tables, alert tables, and a floating AI assistant.

## Color Tokens

Use a restrained light dashboard base with fresh F&B accents.

| Token | Value | Role |
| --- | --- | --- |
| `--bg` | `#F4FBFA` | Page background |
| `--surface` | `#FFFFFF` | Cards, toolbar, panels |
| `--surface-2` | `#F8FCFB` | Table heads, soft panel backgrounds |
| `--ink` | `#102A2C` | Primary text |
| `--muted` | `#5C7174` | Secondary text |
| `--line` | `#D8E9E7` | Borders and grid lines |
| `--brand` | `#0F7C80` | Primary action and selection |
| `--brand-2` | `#2563EB` | Comparison and secondary series |
| `--success` | `#16A36A` | Healthy state |
| `--warning` | `#F59E0B` | Caution state |
| `--danger` | `#F9735B` | Attention/risk state |
| `--cash` | `#0F7C80` | Cash/channel series |
| `--transfer` | `#2563EB` | Bank transfer/channel series |
| `--appfood` | `#F59E0B` | App food/channel series |

## Typography

Use `Noto Sans`, `Inter`, and system sans fallbacks. Product UI uses one sans family stack across labels, KPI, tables, controls, and charts. Use fixed rem sizes rather than fluid display type.

## Layout

- Desktop: persistent sidebar plus dense dashboard canvas.
- Tablet: compact sidebar/navigation and two-column chart flow.
- Mobile: compact brand header, horizontally scrollable nav, full-width filters, readable KPI cards, charts and tables stacked vertically.
- Cards use 8-12px radii depending on density. Avoid nested card effects.

## Components

- Buttons: primary teal, secondary white with teal border, disabled opacity with clear cursor state.
- Inputs/selects: consistent height, border, focus ring, readable placeholder.
- KPI cards: no side stripes; status is conveyed by subtle background, text color, and delta.
- Widgets: calm white surface, clear header, consistent chart padding.
- Tables: sticky header, readable row height, internal scroll, status row tint.
- AI assistant: floating action on desktop; mobile position must not cover filter controls.

## Chart Rules

- Use one shared palette across all chart types.
- Limit single-point bar width with `maxBarSize` so one day does not become a giant block.
- Use lighter grid lines and readable axis labels.
- Use consistent tooltip styling.

## Motion

Transitions should be 150-220ms, limited to hover, focus, panel open/close, and loading feedback. Provide reduced-motion fallback.
