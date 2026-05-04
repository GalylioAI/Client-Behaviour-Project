# BehaviourAI Design System

Production design system for the multi-tenant behaviour analytics SaaS: live ecommerce events, funnels, referrals, site/API key management, data pipelines, exports, and future AI/ML insights.

## 1. Foundations

### Design Principles

- **Analytical clarity first:** dense dashboards must remain easy to scan.
- **Quiet SaaS interface:** neutral surfaces, restrained color, clear hierarchy.
- **Tenant-safe workflows:** make site, tenant, platform, and key state visible wherever data actions happen.
- **Operational confidence:** health, pipeline, and data freshness states should be obvious but not noisy.
- **AI as a helpful layer:** AI insights are recommendations and explanations, not decorative content.

## 2. Colors

### Primary Blue

Use primary blue for active navigation, primary actions, focus states, selected controls, charts, and AI command accents.

| Token | Hex | Usage |
| --- | --- | --- |
| `primary-50` | `#EFF6FF` | Active nav background, pale selected fills |
| `primary-100` | `#DBEAFE` | Hover fill, soft info backgrounds |
| `primary-200` | `#BFDBFE` | Focus ring outer tint |
| `primary-300` | `#93C5FD` | Disabled chart accents |
| `primary-400` | `#60A5FA` | Secondary chart line |
| `primary-500` | `#2F7CF6` | Main brand blue |
| `primary-600` | `#1769E8` | Primary button default |
| `primary-700` | `#0F56C9` | Primary button hover/active |
| `primary-800` | `#154899` | Pressed text/icon states |
| `primary-900` | `#102A56` | Dark brand text |

### Secondary Accents

Use secondary accents sparingly for charts, AI/ML cards, pipeline categories, and segmentation.

| Token | Hex | Usage |
| --- | --- | --- |
| `teal-50` | `#ECFDF5` | Success-tinted panels |
| `teal-500` | `#14B8A6` | Secondary chart/action accent |
| `teal-600` | `#0D9488` | Teal hover state |
| `indigo-50` | `#EEF2FF` | AI insight card background |
| `indigo-500` | `#6366F1` | AI/ML accent |
| `indigo-700` | `#4338CA` | AI active state |

### Neutrals

Neutral colors carry most of the product. Prefer contrast through spacing and typography before adding color.

| Token | Hex | Usage |
| --- | --- | --- |
| `neutral-0` | `#FFFFFF` | Cards, panels, controls |
| `neutral-50` | `#F8FAFC` | App background |
| `neutral-100` | `#F1F5F9` | Subtle section background |
| `neutral-200` | `#E2E8F0` | Borders, dividers |
| `neutral-300` | `#CBD5E1` | Strong borders, disabled outlines |
| `neutral-400` | `#94A3B8` | Placeholder text, muted icons |
| `neutral-500` | `#64748B` | Secondary text |
| `neutral-600` | `#475569` | Body-muted text |
| `neutral-700` | `#334155` | Body text |
| `neutral-800` | `#1E293B` | Headings |
| `neutral-900` | `#0F172A` | Highest emphasis text |

### Semantic Colors

| Token | Hex | Usage |
| --- | --- | --- |
| `success-50` | `#ECFDF3` | Healthy status background |
| `success-500` | `#22C55E` | Success icons, live state |
| `success-700` | `#15803D` | Success text |
| `warning-50` | `#FFFBEB` | Warning row/card background |
| `warning-500` | `#F59E0B` | Warning icons |
| `warning-700` | `#B45309` | Warning text |
| `error-50` | `#FEF2F2` | Error background |
| `error-500` | `#EF4444` | Destructive/action error |
| `error-700` | `#B91C1C` | Error text |
| `info-50` | `#EFF6FF` | Informational background |
| `info-500` | `#3B82F6` | Info icons |
| `info-700` | `#1D4ED8` | Info text |

### Backgrounds And Borders

| Token | Hex | Usage |
| --- | --- | --- |
| `bg-app` | `#F8FAFC` | Full app background |
| `bg-surface` | `#FFFFFF` | Cards, panels, modals |
| `bg-subtle` | `#F1F5F9` | Sidebars, table header, inactive fills |
| `bg-elevated` | `#FFFFFF` | Popovers, menus |
| `border-subtle` | `#E2E8F0` | Default card/control border |
| `border-strong` | `#CBD5E1` | Hover border, separators |
| `border-focus` | `#2F7CF6` | Focus and selected border |

## 3. Typography

### Font Family

- Primary font: `Inter`
- Fallback: `ui-sans-serif`, `system-ui`, `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `sans-serif`
- Numeric dashboards: use tabular numbers where available.

### Type Scale

| Style | Size | Line Height | Weight | Usage |
| --- | ---: | ---: | ---: | --- |
| `display` | `32px` | `40px` | `700` | Main dashboard title, hero metric title |
| `h1` | `28px` | `36px` | `700` | Page title |
| `h2` | `24px` | `32px` | `650` | Section title, modal title |
| `h3` | `20px` | `28px` | `650` | Card group title |
| `h4` | `16px` | `24px` | `650` | Card title, table title |
| `body-lg` | `16px` | `24px` | `400` | Important body copy |
| `body` | `14px` | `20px` | `400` | Default UI text |
| `body-medium` | `14px` | `20px` | `500` | Labels, table names |
| `small` | `13px` | `18px` | `400` | Secondary metadata |
| `caption` | `12px` | `16px` | `500` | Badges, captions, timestamps |
| `micro` | `11px` | `14px` | `600` | Tiny status labels, chart labels |

### Typography Rules

- Use `neutral-900` for primary headings.
- Use `neutral-700` for body text.
- Use `neutral-500` for metadata and secondary labels.
- Use sentence case for labels and actions.
- Do not use negative letter spacing.
- Prefer concise labels: `Live Events`, `AI Insights`, `API Keys`, `Pipelines`.

## 4. Spacing System

### Scale

| Token | Value | Usage |
| --- | ---: | --- |
| `space-1` | `4px` | Icon/text gap, compact internal gap |
| `space-2` | `8px` | Default small gap, control padding |
| `space-3` | `12px` | Form field spacing, badge padding |
| `space-4` | `16px` | Card padding small, list item gap |
| `space-5` | `20px` | Panel internal padding |
| `space-6` | `24px` | Page grid gap, card padding |
| `space-8` | `32px` | Section gap |
| `space-10` | `40px` | Large section spacing |
| `space-12` | `48px` | Major layout spacing |

### Layout Spacing Rules

- App shell gap: `16px`.
- Dashboard card gap: `16px` desktop, `12px` tablet/mobile.
- Card padding: `20px` default, `16px` compact.
- Form row gap: `16px`.
- Button icon gap: `8px`.
- Table row vertical padding: `12px`.

### Grid Rules

- Desktop content grid: 12 columns.
- Desktop gutter: `24px`.
- Tablet gutter: `16px`.
- Mobile gutter: `12px`.
- Dashboard cards should align to the 12-column grid.
- Avoid cards inside cards. Use dividers, table rows, or nested sections instead.

## 5. Radius, Shadows, Elevation

### Border Radius

| Token | Value | Usage |
| --- | ---: | --- |
| `radius-xs` | `4px` | Badges, tiny status chips |
| `radius-sm` | `6px` | Inputs, buttons, nav items |
| `radius-md` | `8px` | Cards, dropdowns, panels |
| `radius-lg` | `12px` | Modals, large command palettes |

Default component radius is `6px`. Default card radius is `8px`.

### Shadows

| Token | Value | Usage |
| --- | --- | --- |
| `shadow-xs` | `0 1px 2px rgba(15, 23, 42, 0.05)` | Buttons, small controls |
| `shadow-sm` | `0 2px 6px rgba(15, 23, 42, 0.06)` | Cards |
| `shadow-md` | `0 8px 24px rgba(15, 23, 42, 0.08)` | Dropdowns, popovers |
| `shadow-lg` | `0 16px 40px rgba(15, 23, 42, 0.12)` | Modals, command palette |

### Elevation Rules

- Base app: no shadow.
- Cards: border plus `shadow-xs` or `shadow-sm`.
- Popovers and menus: `shadow-md`.
- Modals: `shadow-lg`.
- Keep shadows soft; do not use heavy dark shadows.

## 6. Iconography

- Icon style: thin outline, rounded caps, 1.5px stroke.
- Preferred icon family: Lucide-style icons.
- Default icon size: `16px`.
- Sidebar icon size: `16px`.
- Topbar/action icon size: `18px`.
- Empty states or large feature icons: `24px`.
- Icon color should inherit text color unless representing a semantic state.

Core icons:

- Analytics/dashboard
- Live events/activity
- Funnel/filter
- Audience/users
- Products/package
- AI/sparkles/brain
- Reports/file/chart
- Sites/globe
- API keys/key
- Pipelines/workflow
- Settings/cog
- Database/server
- Bell/notifications
- Search

## 7. Components

### Buttons

#### Sizes

| Size | Height | Padding | Text |
| --- | ---: | --- | --- |
| `sm` | `32px` | `0 12px` | `13px / 18px` |
| `md` | `36px` | `0 14px` | `14px / 20px` |
| `lg` | `40px` | `0 16px` | `14px / 20px` |
| `icon-sm` | `32px` | square | `16px icon` |
| `icon-md` | `36px` | square | `18px icon` |

#### Variants

| Variant | Default | Hover | Active | Disabled |
| --- | --- | --- | --- | --- |
| Primary | `primary-600` bg, white text | `primary-700` bg | `primary-800` bg | `neutral-100` bg, `neutral-400` text |
| Secondary | white bg, `border-subtle`, `neutral-800` text | `neutral-50` bg, `border-strong` | `neutral-100` bg | `neutral-100` bg, `neutral-400` text |
| Ghost | transparent bg, `neutral-600` text | `neutral-100` bg, `neutral-900` text | `neutral-200` bg | transparent, `neutral-400` text |
| Destructive | `error-500` bg, white text | `error-700` bg | `#991B1B` bg | `neutral-100` bg, `neutral-400` text |
| Subtle | `neutral-100` bg, `neutral-700` text | `neutral-200` bg | `neutral-300` bg | `neutral-100` bg, `neutral-400` text |

#### Button Rules

- Radius: `6px`.
- Font weight: `600`.
- Loading state: show spinner left of label or centered for icon-only.
- Destructive buttons require confirmation for irreversible actions.
- Do not use primary buttons more than once in a dense panel.

### Inputs

Applies to text input, search, select trigger, textarea, and date field.

| State | Treatment |
| --- | --- |
| Default | White bg, `border-subtle`, `neutral-900` text |
| Hover | `border-strong` |
| Focus | `border-focus`, `0 0 0 3px primary-100` ring |
| Error | `error-500` border, `error-50` helper row |
| Filled | White bg, `neutral-900` text |
| Disabled | `neutral-100` bg, `neutral-400` text, no pointer |

Sizes:

- Small: `32px` height.
- Medium: `36px` height.
- Large: `40px` height.
- Textarea minimum height: `88px`.
- Search bars use leading search icon and optional keyboard hint.

### Dropdowns And Menus

- Menu surface: `bg-elevated`, `border-subtle`, `shadow-md`, `radius-md`.
- Menu item height: `36px`.
- Menu item padding: `8px 10px`.
- Hover item: `neutral-100`.
- Active/selected item: `primary-50` bg, `primary-700` text.
- Destructive item: `error-700` text, `error-50` hover.

### Toggles, Checkboxes, Radios

#### Toggle

- Off: `neutral-300` track, white thumb.
- On: `primary-600` or `success-500` track, white thumb.
- Disabled: `neutral-200` track, `neutral-400` thumb.
- Focus ring: `primary-100`.

#### Checkbox

- Size: `16px`.
- Radius: `4px`.
- Checked: `primary-600` fill, white check.
- Indeterminate: `primary-600` fill, white dash.
- Disabled: `neutral-200` fill, `neutral-400` mark.

#### Radio

- Size: `16px`.
- Selected: `primary-600` ring/dot.
- Disabled: `neutral-300` ring, muted dot.

### Tabs

- Height: `36px`.
- Default: `neutral-500` text.
- Hover: `neutral-900` text.
- Active: `primary-700` text with `2px` bottom indicator.
- Use tabs for peer views: `Overview`, `Events`, `Funnels`, `Cohorts`, `Reports`.

### Pills And Badges

Pills are interactive filters. Badges are read-only status labels.

| Type | Treatment |
| --- | --- |
| Neutral | `neutral-100` bg, `neutral-700` text |
| Blue | `primary-50` bg, `primary-700` text |
| Success | `success-50` bg, `success-700` text |
| Warning | `warning-50` bg, `warning-700` text |
| Error | `error-50` bg, `error-700` text |
| AI | `indigo-50` bg, `indigo-700` text |

Badge height: `22px`. Pill height: `28px`.

### Cards And Panels

- Background: `bg-surface`.
- Border: `1px solid border-subtle`.
- Radius: `8px`.
- Padding: `20px`.
- Header row: title left, actions right.
- Metric cards use large number plus compact trend chip.
- Avoid decorative imagery in operational screens.

### Tables And Event Lists

- Header text: `caption`, `neutral-500`, uppercase only if very compact.
- Row height: `48px` default.
- Row hover: `neutral-50`.
- Selected row: `primary-50`.
- Use tabular numbers for metrics.
- Event stream rows should show event icon, event name, page/order, timestamp, country/source.

### Tooltips

- Background: `neutral-900`.
- Text: white.
- Radius: `6px`.
- Padding: `6px 8px`.
- Font: `12px / 16px`.
- Delay: `400ms`.
- Tooltips explain icon buttons, status labels, and chart anomalies.

### File Upload

- Border: dashed `border-strong`.
- Hover: `primary-200` border, `primary-50` bg.
- Drag active: `primary-500` border, `primary-50` bg.
- Include supported formats and size limit below the dropzone.

### Status Indicators

Use a dot plus label where space allows.

| Status | Color | Usage |
| --- | --- | --- |
| Live | `success-500` | Site is actively sending events |
| Processing | `primary-500` | Pipeline/model running |
| Warning | `warning-500` | Degraded service, stale data |
| Error | `error-500` | Failed job, rejected auth |
| Offline | `neutral-400` | No recent events |

## 8. Layout System

### App Shell

Default desktop shell:

- Left sidebar: `240px`.
- Collapsed sidebar: `72px`.
- Topbar: `64px`.
- Main content: fluid, 12-column grid.
- Right panel: `360px`.
- Collapsed right panel: `56px`.
- Shell background: `bg-app`.
- Panels/cards: `bg-surface`.

### Sidebar

Required navigation:

- Dashboard
- Live Events
- Funnels
- Audience
- Products
- AI Insights
- Reports
- Sites
- API Keys
- Pipelines
- Settings

Sidebar rules:

- Active nav item: `primary-50` bg, `primary-700` text/icon.
- Hover item: `neutral-100` bg.
- Use icons and labels in expanded mode.
- Collapsed mode shows icon-only with tooltip.
- Tenant/site switcher should be visible near the top.

### Topbar

Topbar contains:

- Current site selector.
- Environment/status chip.
- Date range selector.
- Global search.
- Notifications.
- Help/status.
- User avatar menu.

Topbar rules:

- Height: `64px`.
- Border bottom: `border-subtle`.
- Search max width: `360px`.
- Keep primary action on the right when needed.

### Content Area

Dashboard composition:

- First row: key metrics and realtime state.
- Second row: funnel, event stream, referrals/traffic.
- Third row: product engagement, AI anomalies, pipeline/model health.
- Use `16px` gaps and align cards to grid.
- Dense data screens may use tables with sticky headers.

### Right Panel

Right panel is for operational context:

- Tenant/site status.
- API key status.
- Infrastructure health.
- Latest Airflow run.
- Exports.
- AI recommendations.

Right panel should be collapsible and not required for core page completion.

### Responsive Breakpoints

| Breakpoint | Width | Behavior |
| --- | ---: | --- |
| Mobile | `< 768px` | Sidebar becomes drawer, right panel hidden below content |
| Tablet | `768px - 1279px` | Sidebar collapses to icons, 6-column grid |
| Desktop | `>= 1280px` | Full shell, 12-column grid |
| Wide | `>= 1536px` | Optional right panel, wider charts |

### Layout Variants

- **Full layout:** sidebar + topbar + content + right panel.
- **No sidebar:** login, onboarding, install wizard.
- **Compact mode:** collapsed sidebar and right panel for operations dashboards.
- **Focus mode:** one full-width table/chart with filters pinned above.

## 9. Interaction Rules

### Hover

- Controls: slightly darker background or stronger border.
- Cards: no hover unless clickable.
- Clickable cards: raise to `shadow-sm` and use `border-strong`.
- Table rows: `neutral-50` background.
- Nav items: `neutral-100` background.

### Focus

- All interactive elements must have visible focus.
- Focus ring: `0 0 0 3px primary-100`.
- Focus border: `primary-500`.
- Do not remove browser focus without replacing it.

### Active And Selected

- Active nav: primary-tinted background plus blue text/icon.
- Active tab: blue text and bottom indicator.
- Selected table row: primary tint and strong border/left accent if needed.
- Selected filters: blue pill background.

### Disabled

- Disabled elements use `neutral-100` background and `neutral-400` text/icon.
- Disabled controls do not show hover states.
- Disabled action should include tooltip or helper text if the reason is not obvious.

### Animations

Use subtle, fast animation only.

| Motion | Duration | Easing |
| --- | ---: | --- |
| Hover/focus color | `120ms` | ease-out |
| Dropdown/popover open | `160ms` | ease-out |
| Sidebar collapse | `200ms` | ease-in-out |
| Toast enter/exit | `180ms` | ease-out |
| Chart update | `250ms` | ease-out |

Rules:

- Avoid bouncy motion.
- Respect reduced motion preferences.
- Loading states should use skeletons for panels and spinners for buttons.
- Realtime event streams should animate gently; do not shift large layout blocks.

## 10. Product-Specific Patterns

### Tenant And Site Management

- Always show `site_id`, platform, domain, and live/offline status on site detail pages.
- API keys should show prefix only, never full secret after creation.
- Public write keys can be shown and copied.
- Server secret keys should be hidden behind an advanced/developer section.
- Key rotation states: `Active`, `Pending`, `Revoked`, `Expired`.

### AI/ML Insights

- AI cards use `indigo-50` accents and a clear confidence label.
- Every AI recommendation needs:
  - Title.
  - Short explanation.
  - Confidence or impact level.
  - Source metric.
  - Action button.
- Model status states:
  - `Not configured`
  - `Collecting data`
  - `Training`
  - `Ready`
  - `Needs review`
  - `Failed`

### Pipeline And Data Health

- Show freshness: `Last event`, `Last Layer 2 run`, `Latest export`.
- Health statuses use semantic colors, not chart colors.
- Failed pipelines should include direct action: `View logs`, `Retry`, `Open run`.

### Dashboard Cards

Core cards:

- Real-time Event Stream.
- Conversion Funnel.
- Traffic And Referrals.
- Product Engagement.
- Session Quality Score.
- AI Anomaly Alert.
- Pipeline Health.
- Model Readiness.
- API Key Status.
- Export Status.

## 11. Accessibility

- Minimum body text contrast: 4.5:1.
- Do not rely on color alone for status; include icon/dot plus text.
- Hit target minimum: `32px`, preferred `36px+`.
- Forms require labels, not placeholder-only labels.
- Error messages should explain what happened and how to fix it.
- Keyboard navigation must work for menus, tabs, filters, and command palette.

## 12. Content Voice

- Clear, direct, operational.
- Prefer: `Events received`, `Pipeline healthy`, `Key revoked`, `Export ready`.
- Avoid vague AI language like `magic`, `boost`, or `smartify`.
- Good AI copy example: `Cart drop-off is 32% higher than usual after shipping selection.`

