# VidClaw Design System

## 1. Visual Theme & Atmosphere

VidClaw is a dark-mode-native AI video generation SaaS for e-commerce. The visual language blends **professional tool precision** (inspired by Linear) with **e-commerce warmth** (informed by DoLabAI's approachability). The result: a dark canvas that feels both powerful and inviting — not intimidating, not toyish.

The design uses a deep teal-black background (`#0a1214`) as its foundation, with content organized through **clear step-by-step workflows** using numbered sections (01, 02, 03). This step-based layout is the most critical UX pattern — every tool page follows the same rhythm: select inputs → configure options → execute action → view results.

**Key Characteristics:**
- Dark-mode-native: `#0a1214` root, `#162529` surface, `#1b353a` elevated
- Cyan-blue brand accent: `#0dccf2` primary, gradient to `#60a5fa`
- Inter font family with PingFang SC / Noto Sans SC for Chinese text
- Step-based numbered workflows (① ② ③) with generous spacing
- Parameter controls as horizontal pill/chip buttons, not dropdowns where possible
- Glass-morphism sidebar with blur backdrop
- Generous whitespace — sections separated by 32-48px gaps
- Cards with subtle borders (`#24363a`) and 12px radius

## 2. Color Palette & Roles

### Background Surfaces
- **Root** (`#0a1214`): Deepest background — main canvas
- **Surface** (`#162529`): Cards, panels, form containers
- **Elevated** (`#1b353a`): Hover states, elevated cards, active surfaces
- **Overlay** (`rgba(10, 18, 20, 0.80)`): Modal backdrop

### Text
- **Primary** (`#f1f5f9`): Headlines, important content — near-white with cool undertone
- **Secondary** (`#94a3b8`): Body text, descriptions
- **Muted** (`#64748b`): Placeholders, metadata, de-emphasized
- **Dim** (`#475569`): Disabled states, timestamps

### Brand & Accent
- **Accent** (`#0dccf2`): Primary CTAs, active states, brand elements
- **Accent Hover** (`#0bb8db`): Hover state for accent
- **Accent Subtle** (`rgba(13, 204, 242, 0.10)`): Selected backgrounds, badges
- **Gradient** (`linear-gradient(135deg, #0dccf2, #60a5fa)`): Gradient text, premium buttons

### Semantic
- **Success** (`#34d399`): Completed states, positive indicators
- **Error** (`#f87171`): Failures, destructive actions
- **Warning** (`#fbbf24`): Caution states
- **Info** (`#60a5fa`): Informational badges

### Border
- **Primary** (`#24363a`): Standard card/section borders
- **Subtle** (`#1b353a`): De-emphasized separations

## 3. Typography Rules

### Font Family
- **Primary**: `Inter`, `PingFang SC`, `Noto Sans SC`, `Microsoft YaHei`, system-ui, sans-serif
- **Monospace**: `SF Mono`, `Cascadia Code`, `Fira Code`, ui-monospace, monospace

### Hierarchy

| Role | Size | Weight | Line Height | Use |
|------|------|--------|-------------|-----|
| Page Title | 24px (1.5rem) | 700 | 1.3 | Page heading (e.g. "商品组图") |
| Page Subtitle | 14px (0.875rem) | 400 | 1.5 | Page description text |
| Section Title | 14px (0.875rem) | 600 | 1.4 | Step headers (e.g. "① 选择产品图") |
| Body | 14px (0.875rem) | 400 | 1.5 | Standard content |
| Small | 13px (0.8125rem) | 400 | 1.5 | Secondary info, hints |
| Caption | 12px (0.75rem) | 500 | 1.4 | Labels, badges, metadata |
| Micro | 10px–11px | 500 | 1.3 | Tiny tags, status dots |

### Principles
- Chinese UI text should feel clean and scannable — avoid dense paragraphs
- Step numbers (①②③) use the same weight as section titles
- Page titles are the ONLY large text — everything else stays 14px or smaller
- Use `text-slate-400` for descriptions, `text-white` for titles and active content

## 4. Component Stylings

### Step Section (Core Pattern)
Every tool page uses numbered step sections. This is the signature layout pattern:
```
┌─ rounded-xl border bg-surface p-6 ─────────────────────┐
│  ① 步骤名称                              (section title) │
│  步骤描述文字                        (text-slate-400 sm) │
│                                                          │
│  [Content: upload area / selection grid / form fields]   │
└──────────────────────────────────────────────────────────┘
     ↓ gap-5 (20px)
┌─ rounded-xl border bg-surface p-6 ─────────────────────┐
│  ② 下一步骤                                              │
│  ...                                                      │
└──────────────────────────────────────────────────────────┘
```
- Background: `var(--vc-bg-surface)` / `#162529`
- Border: `1px solid var(--vc-border)` / `#24363a`
- Radius: `var(--vc-radius-lg)` / 12px
- Padding: 20-24px
- Gap between steps: 20px

### Buttons

**Primary CTA (Generate / Submit)**
- Background: `var(--vc-accent)` / `#0dccf2`
- Text: white, 14px weight 500
- Padding: 12px 24px
- Radius: 12px (rounded-xl)
- Full width on tool pages
- Shows cost: "生成 3 张 · 约 9 积分"
- Hover: brightness-110
- Disabled: opacity-50

**Style Selection Chip (Active)**
- Background: `rgba(13, 204, 242, 0.10)`
- Border: `1px solid var(--vc-accent)`
- Text: `var(--vc-accent)` / `#0dccf2`
- Radius: 8px (rounded-lg)
- Padding: 8px 12px

**Style Selection Chip (Inactive)**
- Background: transparent
- Border: `1px solid var(--vc-border)`
- Text: `#94a3b8`
- Hover: border lightens, text brightens

**Parameter Pill (Horizontal Bar)**
- Background: `var(--vc-bg-root)`
- Border: `1px solid var(--vc-border)`
- Text: 12px white
- Radius: 8px
- Padding: 8px 12px
- Layout: horizontal flex row with gaps

**Ghost Button**
- Background: transparent
- Border: `1px solid var(--vc-border)`
- Text: `#94a3b8`
- Radius: 9999px (pill)
- Padding: 4px 12px

### Cards & Containers
- Background: `var(--vc-bg-surface)`
- Border: `1px solid var(--vc-border)`
- Radius: 12px
- Shadow: `var(--vc-shadow-sm)` / `0 1px 2px rgba(0,0,0,0.4)`
- No hover lift — hover changes border or background only

### Inputs
- Background: `var(--vc-bg-root)`
- Border: `1px solid var(--vc-border)`
- Text: white, 14px
- Placeholder: `#64748b`
- Radius: 8px
- Padding: 12px 16px
- Focus: `border-color: var(--vc-accent)`

### Upload Area
- Border: `2px dashed var(--vc-border)`
- Background: `var(--vc-bg-root)`
- Radius: 8px
- Center-aligned icon + text
- Hover: border brightens to `var(--vc-accent)` at 40% opacity
- Active/filled: show thumbnail with checkmark overlay

### Image Grid (Asset Selection)
- Grid: 4-6 columns depending on viewport
- Each item: square aspect ratio, rounded-lg, border-2
- Selected: `border-[var(--vc-accent)]` + `ring-2 ring-[var(--vc-accent)]/30` + checkmark overlay
- Unselected: `border-transparent` + hover `border-white/20`

### Progress / Loading
- Spinner: `animate-spin` with Loader2 icon
- SSE progress: text updates in the button itself ("正在生成第 1/3 张...")
- Button stays disabled during loading

### Results Grid
- Grid: 2-4 columns
- Each result: rounded-xl, border, image with gradient overlay at bottom
- Overlay shows style label + download icon on hover

## 5. Layout Principles

### Page Structure
```
┌─────────────────────────────────────────────────┐
│ [Page Title]                            24px bold │
│ [Description]                     14px slate-400 │
│                                                   │
│ ┌─────────────────┐  ┌──────────────────────────┐│
│ │ Left Column     │  │ Right Column (preview)   ││
│ │ (config/form)   │  │                          ││
│ │                 │  │                          ││
│ └─────────────────┘  └──────────────────────────┘│
│                                                   │
│ [Generate Button - full width]                    │
│                                                   │
│ [Results Grid - full width]                       │
└─────────────────────────────────────────────────┘
```
- Max width: `max-w-5xl` (1024px) for tool pages, `max-w-4xl` for simple pages
- Layout: `lg:grid-cols-[1fr_360px]` — config left, preview right
- Single column on mobile
- Padding: `p-4 md:p-8`

### Spacing Scale
- Step sections gap: 20px (gap-5)
- Inside sections: 12-16px between elements
- Page top margin: 32px (py-8)
- Between page title and content: 24px (space-y-6)

### Grid & Breakpoints
| Breakpoint | Behavior |
|-----------|----------|
| <640px (sm) | Single column, compact padding |
| 640-1024px (md-lg) | Two-column layout begins |
| >1024px (lg) | Full layout with sidebar visible |

## 6. Depth & Elevation

| Level | Treatment | Use |
|-------|-----------|-----|
| Base | `#0a1214` bg, no shadow | Page background |
| Surface | `#162529` bg, `1px solid #24363a` | Cards, form sections |
| Elevated | `#1b353a` bg | Hover states, active items |
| Glass | `rgba(22,37,41,0.70)` + `blur(12px)` | Sidebar |
| Overlay | `rgba(10,18,20,0.80)` | Modal backdrop |
| Glow | `0 0 20px rgba(13,204,242,0.20)` | CTA hover, emphasis |

## 7. Do's and Don'ts

### Do
- Use numbered steps (①②③) for every multi-step workflow
- Keep parameter controls horizontal (pill buttons in a row, not vertical dropdowns)
- Show exact cost on the submit button ("生成 3 张 · 约 9 积分")
- Use `rounded-xl` (12px) for all cards and sections
- Keep descriptions short — one line, `text-sm text-slate-400`
- Use SSE streaming for progress feedback in the button
- Make results immediately visible below the form (no page navigation)
- Use `max-w-5xl` for tool pages, two-column layout on desktop

### Don't
- Don't use pure white (`#ffffff`) for text — use `#f1f5f9`
- Don't use solid bright backgrounds for sections — always use `var(--vc-bg-surface)`
- Don't stack more than 3 steps vertically — if more, use tabs or collapse
- Don't use large font sizes for anything except the page title
- Don't put the generate/submit button inside a card — it should be full width below all steps
- Don't use modals for results — show them inline
- Don't use complex multi-level nesting — keep the visual hierarchy flat
- Don't use different accent colors across pages — `#0dccf2` is the only accent

## 8. Responsive Behavior

### Mobile (<640px)
- Single column layout
- Step sections stack vertically
- Image grid: 3 columns
- Style chips: 2 columns
- Generate button: full width, sticky at bottom if needed

### Tablet (640-1024px)
- Two-column layout begins for config + preview
- Image grid: 4 columns
- Style chips: 3 columns

### Desktop (>1024px)
- Full two-column layout
- Sidebar visible
- Image grid: 4-6 columns
- Results: 3-4 columns

## 9. Agent Prompt Guide

### Quick Color Reference
- Page background: `#0a1214`
- Card background: `#162529`
- Card border: `#24363a`
- Primary text: `#f1f5f9`
- Secondary text: `#94a3b8`
- Muted text: `#64748b`
- Accent: `#0dccf2`
- Accent hover: `#0bb8db`
- Accent subtle bg: `rgba(13, 204, 242, 0.10)`
- Success: `#34d399`
- Error: `#f87171`

### Page Template
```
<div className="mx-auto w-full max-w-5xl space-y-6 p-4 md:p-8">
  {/* Title */}
  <div>
    <h1 className="text-2xl font-bold text-white">页面标题</h1>
    <p className="mt-1 text-sm text-slate-400">页面描述</p>
  </div>

  {/* Two-column layout */}
  <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
    <div className="space-y-5">
      {/* Step 1 */}
      <div className="rounded-xl border border-[var(--vc-border)] bg-[var(--vc-bg-surface)] p-5">
        <h3 className="mb-3 text-sm font-semibold text-white">① 步骤一</h3>
        {/* Content */}
      </div>
      {/* Step 2 */}
      <div className="rounded-xl border border-[var(--vc-border)] bg-[var(--vc-bg-surface)] p-5">
        <h3 className="mb-3 text-sm font-semibold text-white">② 步骤二</h3>
        {/* Content */}
      </div>
      {/* Submit */}
      <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--vc-accent)] px-6 py-3.5 text-sm font-medium text-white">
        生成 · X 积分
      </button>
    </div>
    {/* Right preview */}
    <div className="space-y-4">
      {/* Preview content */}
    </div>
  </div>

  {/* Results */}
  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
    {/* Result cards */}
  </div>
</div>
```

### Style Chip Template
```
<button className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-all ${
  isSelected
    ? "border-[var(--vc-accent)] bg-[var(--vc-accent)]/10 text-[var(--vc-accent)]"
    : "border-[var(--vc-border)] text-slate-400 hover:border-white/20 hover:text-white"
}`}>
  {label}
</button>
```
