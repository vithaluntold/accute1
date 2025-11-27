# Disabled UI Components

**Last Updated:** November 27, 2025

These landing page components are built but disabled because they contain placeholder data. Enable them when you have real data to display.

---

## Disabled Components

### 1. TestimonialCarousel
**File:** `client/src/components/testimonial-carousel.tsx`
**Status:** ❌ Disabled (placeholder data)

**What it does:**
- Auto-rotating carousel with founder/client testimonials
- Displays quote, author name, role, company, avatar
- Metrics highlighting (e.g., "30% productivity increase")
- Dot navigation, auto-play with pause-on-hover

**To enable:**
1. Replace placeholder testimonials with real client quotes
2. Add real client photos/avatars
3. Import and add to landing.tsx:
```tsx
import { TestimonialCarousel } from "@/components/testimonial-carousel";
// Add in landing page:
<TestimonialCarousel />
```

---

### 2. LogoCarousel / TrustedBySection  
**File:** `client/src/components/logo-carousel.tsx`
**Status:** ❌ Disabled (placeholder data)

**What it does:**
- Infinite scrolling logo carousel (CSS animation)
- "Trusted by forward-thinking accounting firms" header
- Configurable speed prop
- Fade gradients on edges

**Placeholder logos:** QuickBooks, Xero, Intuit, Microsoft, Google, Razorpay, OpenAI, Azure, Anthropic, Stripe

**To enable:**
1. Replace with logos of actual clients/partners
2. Get permission to use their logos
3. Import and add to landing.tsx:
```tsx
import { TrustedBySection } from "@/components/logo-carousel";
// Add in landing page:
<TrustedBySection />
```

---

### 3. AnimatedCounter
**File:** `client/src/components/animated-counter.tsx`
**Status:** ❌ Disabled (placeholder metrics)

**What it does:**
- Animated number counters (0 → target on scroll)
- Intersection Observer for scroll trigger
- Shows stats like "15+ Hours Saved Weekly"

**Placeholder stats:**
- 15+ Hours Saved Weekly
- 12 AI Agents  
- 100+ Permissions
- 21 Day Free Trial

**To enable:**
1. Update with real, verified metrics
2. Only the "12 AI Agents" and "21 Day Free Trial" are factual
3. Import and add to landing.tsx:
```tsx
import { AnimatedCounter } from "@/components/animated-counter";
// Add in landing page:
<AnimatedCounter />
```

---

## Kept Components (Factual Data)

### 1. NumberedProducts
**File:** `client/src/components/numbered-products.tsx`
**Status:** ✅ Enabled (describes real features)

Displays actual product features with Workplete-style numbering (01, 02, 03, 04).

---

### 2. IndustryTabs
**File:** `client/src/components/industry-tabs.tsx`
**Status:** ✅ Enabled (describes real use cases)

Shows industry-specific use cases for Tax, Bookkeeping, Audit, Advisory, Multi-Partner firms.

---

### 3. FAQSection
**File:** `client/src/components/faq-section.tsx`
**Status:** ✅ Enabled (factual Q&A)

Accordion FAQ with real answers about Accute features, security, pricing, etc.

---

## Quick Enable/Disable Reference

| Component | File | Enable By Adding |
|-----------|------|------------------|
| Testimonials | `testimonial-carousel.tsx` | `<TestimonialCarousel />` |
| Logo Carousel | `logo-carousel.tsx` | `<TrustedBySection />` |
| Animated Stats | `animated-counter.tsx` | `<AnimatedCounter />` |

---

## Future: When You Have Real Data

1. Collect 3-5 real client testimonials with permission
2. Get logo usage permission from partners
3. Track actual metrics (hours saved, clients onboarded)
4. Update component data and re-enable
