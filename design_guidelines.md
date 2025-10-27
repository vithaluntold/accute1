# Accute Design Guidelines (Compacted)
## AI-Powered Accounting Workflow Automation Platform

---

## Core Principles & Approach

**Design Philosophy:** Linear/Notion-inspired productivity UI + Carbon Design System (enterprise data)
- **Precision First:** Clear hierarchy for accurate decision-making
- **Efficiency-Driven:** Maximize information density, minimize clicks
- **Trust Through Clarity:** Transparent data, consistent patterns
- **Innovation Balance:** Modern aesthetic without sacrificing usability

---

## Typography

### Font Stack
- **Display/Headers:** Orbitron (600, 700) - Logo, major headlines, primary CTAs ONLY
- **UI/Body:** Exo 2 (400, 500, 600) - All dashboards, navigation, forms, tables
- **Data/Code:** System monospace - Financial data, numbers, timestamps

### Type Scale & Usage
- H1 (3xl-4xl): Landing pages, major dividers
- H2 (2xl): Dashboard headers, page titles  
- H3 (xl): Card headers, workflow titles
- H4 (lg): Component headers, form sections
- Body (base): Primary content, form labels
- Small (sm): Helper text, metadata
- Micro (xs): Captions, fine print

**Rules:** Line-height 1.5-1.6 (body), 1.2 (headers). Use font-weight before increasing size.

---

## Layout & Spacing

### Spacing System (Tailwind Units)
- **Micro (2, 4):** Related elements, icon-text gaps
- **Standard (6, 8):** Component padding, form fields
- **Section (12, 16):** Card padding, component groups
- **Major (24, 32):** Page margins, section dividers

### Grid & Breakpoints
- **Dashboard:** 12-column grid, 6-unit gaps
- **Sidebar:** 64-80 units (collapsed: 16 units icon-only)
- **Responsive:** Mobile (<768px) single-column | Tablet (768-1024px) 2-column | Desktop (>1024px) multi-column

### Container Widths
- Dashboards: Fluid with page padding
- Content pages: max-w-7xl
- Forms/Settings: max-w-3xl
- Modals: max-w-2xl (max-w-4xl for complex)

---

## Color System

### Primary Gradient (Brand Identity)
**Porsche to Pink:** Creates an energetic, modern feel for AI-powered automation
- **Porsche:** #e5a660 (warm gold) - Reliability, trust
- **Pink:** #d76082 (vibrant rose) - Innovation, energy
- **Gradient:** `linear-gradient(135deg, #e5a660 0%, #d76082 100%)`

### Semantic Colors
- **Primary:** Porsche-Pink gradient for CTAs, highlights, active states
- **Success:** #10b981 (Emerald) - Completed workflows, success states
- **Warning:** #f59e0b (Amber) - Pending actions, cautions
- **Error:** #ef4444 (Red) - Failed executions, errors
- **Info:** #3b82f6 (Blue) - Information, guidance

### Surface Colors (Light Mode)
- **Background:** #ffffff (Pure white)
- **Surface:** #f8fafc (Slate 50) - Cards, elevated surfaces
- **Surface Hover:** #f1f5f9 (Slate 100) - Hover states
- **Border:** #e2e8f0 (Slate 200) - Subtle divisions
- **Border Strong:** #cbd5e1 (Slate 300) - Emphasized borders

### Surface Colors (Dark Mode)
- **Background:** #0f172a (Slate 900)
- **Surface:** #1e293b (Slate 800) - Cards, elevated surfaces
- **Surface Hover:** #334155 (Slate 700) - Hover states
- **Border:** #475569 (Slate 600) - Subtle divisions
- **Border Strong:** #64748b (Slate 500) - Emphasized borders

### Text Colors (Light Mode)
- **Primary:** #0f172a (Slate 900) - Headers, primary text
- **Secondary:** #475569 (Slate 600) - Descriptions, labels
- **Tertiary:** #94a3b8 (Slate 400) - Metadata, helpers
- **On Primary:** #ffffff - Text on gradient backgrounds

### Text Colors (Dark Mode)
- **Primary:** #f8fafc (Slate 50) - Headers, primary text
- **Secondary:** #cbd5e1 (Slate 300) - Descriptions, labels
- **Tertiary:** #64748b (Slate 500) - Metadata, helpers
- **On Primary:** #ffffff - Text on gradient backgrounds

### Accent Colors
- **Accent Blue:** #60a5fa (Sky 400) - Links, interactive elements
- **Accent Purple:** #a78bfa (Violet 400) - AI features, premium
- **Accent Teal:** #2dd4bf (Teal 400) - Automation, workflows

---

## Navigation

### Top Nav (Fixed, 16 units high)
Logo (Orbitron) | Workspace switcher | Role indicator | Notifications | Profile | Search (Cmd+K expandable)
- Blur backdrop on scroll

### Sidebar (Collapsible)
- Icon-only mode available
- Active state: Left border indicator
- Sub-menus: Inline expansion with indentation
- Bottom: Settings, AI agent status, help
- Role-based visibility

### Breadcrumbs
Format: Home > Workflows > Invoice Automation (last item non-clickable)

---

## Components

### Cards
- Subtle border, minimal shadow
- Header: Title (Exo 2 semibold) + 3-dot menu
- Body: p-6 padding
- Footer: Metadata (timestamps, status badges)

### Buttons
**Hierarchy:** Primary (main actions) | Secondary (outlined/subtle) | Tertiary (text-only) | Danger (destructive)
**Sizes:** sm (8u) table actions | base (10u) standard | lg (12u) landing CTAs
**Icon Buttons:** Min 8x8 units, tooltips on hover

### Tables
- Sticky header, sortable columns
- Row height: 12-14 units
- Zebra striping (subtle)
- Actions: Right-aligned icons
- Pagination: Bottom-right
- **Financial data:** Right-align numbers, monospace font, currency formatting

### Forms
- Single-column (focused) | Two-column (data-heavy)
- Field spacing: 6-8 units vertical
- Input height: 10-11 units, rounded-md
- Label above, helper below, required asterisk
- Error: Border + message below
- **Special:** Date pickers (inline calendar), file upload (drag-drop), multi-select (tags), rich text (minimal toolbar)

### Modals & Drawers
- **Modal:** Centered, backdrop blur, header (title + X), scrollable body, footer actions right-aligned
- **Confirmation:** Icon indicator, explicit action labels ("Delete Workflow" not "Confirm")
- **Drawer:** Right-side, full-height, 33-50% width

### Status & Notifications
- **Badges:** Pill-shaped, icon + text, xs (tables) / sm (cards)
- **States:** Active, Pending, Completed, Failed, Draft, Archived
- **Progress:** Linear bars (workflow), circular loaders (processing), step indicators (multi-stage)
- **Toasts:** Top-right, auto-dismiss with priority levels

---

## Role-Specific Dashboards

### Super Admin
4-column org overview | System health metrics | License/billing charts | Activity feed (full-width)

### Admin  
Team performance (2-3 columns) | Active workflows | Client activity | Quick actions panel

### Employee
Task kanban/list toggle | Workflow queue with priority | Time tracking | Recent documents

### Client Portal
Prominent upload zone (drag-drop) | Document status timeline | Progress visualization | Secure messaging

---

## Workflow Builder

**Layout:** Center canvas (zoom controls) | Left palette (searchable nodes) | Right panel (node config) | Top toolbar (save, test, deploy, history)
**Nodes:** Rounded rectangles, icon + label, connection points, success/error borders, snap-to-grid

---

## AI Agent Marketplace

**Grid:** 3-4 columns (responsive)
**Filters:** Categories, providers (OpenAI, Azure, Anthropic), ratings
**Card:** Icon, name, description, rating stars, "Try" + "Install" buttons
**Detail View:** Hero section, capabilities, integration preview, reviews, pricing, install CTA

---

## Animations (Keep <200ms)

- Page transitions: Fade + 100ms vertical shift
- Card hover: Subtle lift + shadow
- Button press: Scale to 98%
- Modal: Fade + scale 95%→100%
- Dropdowns: Slide + fade (150ms)
- **Loading:** Skeleton screens (initial), inline spinners (buttons), progress bars (uploads), shimmer placeholders

---

## Icons & Assets

**Library:** Heroicons (outline for nav, solid for actions)
- Size: 4-6 units, scale with text
- Spacing: 2 units left of labels
- **Custom needs:** AI agent icons, workflow nodes, integration logos (QuickBooks, Xero, Zoho)

### Visual Assets
- **Hero:** 3D isometric workflow illustration (floating documents, AI nodes, data flow), right 50%, subtle parallax
- **Empty states:** Minimal line art
- **AI cards:** Geometric patterns, provider logos, rounded square avatars

---

## Accessibility (WCAG AA)

- **Keyboard:** Full navigation, visible focus indicators
- **Screen readers:** ARIA labels on interactive elements
- **Contrast:** WCAG AA minimum (verify with final colors)
- **Touch targets:** Min 44x44px mobile
- **Forms:** Color + text error indicators
- **Images:** Descriptive alt text
- **Zoom:** Scalable to 200%

---

## Responsive Strategy

### Mobile (<768px)
- Sidebar: Hamburger → full-screen drawer
- Tables: Horizontal scroll or card transform
- Grids: Stack single-column
- Forms: Full-width, larger touch targets
- Navigation: Bottom tab bar (Client portal)

### Desktop (>1024px)
- Hover tooltips/previews
- Keyboard shortcuts
- Multi-panel views
- Drag-and-drop workflow builder

---

## Page Templates

### Landing Page Flow
Hero (animated workflow viz, Orbitron headline, dual CTAs) → Features grid (3-col) → Workflow demo → AI integration (2-col) → Multi-role benefits (tabs/accordion) → Security badges → Pricing table (3-4 col) → Trial signup → Footer

### Dashboard Pattern
Top nav + sidebar + main content (grid cards) → Quick stats (4-col) → Charts (2-3 col) → Activity table/feed (full-width)

### Settings
Nested sidebar navigation → Single-column forms → Section dividers → Sticky save footer/button → Inline success messages

---

**End of Guidelines** | Version: Compacted for Developer Efficiency