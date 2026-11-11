# HIG checklist for the Ohod grocery app (SwiftUI, iPhone only, iOS 17+, Xcode 26 / Liquid Glass, Arabic RTL)

Source: only the HIG text dumps in this folder. Numbers are quoted where the dump states them.
NOTE: The dumps lost all tables/images. So these are **not** in the source: the iOS Dynamic Type size table
(default/minimum pt sizes), the WCAG AA contrast ratio values, the @2x/@3x scale table, and tab bar icon sizes.
Do not cite numbers for them from this file; check the live HIG if needed.
Legend: ⚠️ = conflicts with (or is at risk in) our current design, with the reason.

## 1. Buttons & touch targets
- [ ] Every tappable thing has a hit region of **at least 44x44 pt** (buttons.txt). Applies to: card "+" add button,
      stepper − / + on product cards and cart rows, chips, banner dots, heart/close icons, map recenter button.
- ⚠️ 3-column product grid: the add button and the stepper inside each card must keep 44x44 pt hit areas
      (pad with `.contentShape` beyond the visible glyph). A small visible circle is fine; a small hit area is not.
- ⚠️ 4-column category tiles: each tile must be ≥44 pt in both directions, and the tiles need visible spacing.
- [ ] Spacing: about **12 pt** padding around elements with a bezel, about **24 pt** around elements without one
      (accessibility.txt). The − and + of a stepper must not be so close that people hit the wrong one.
- [ ] Every custom button has a **press state** (buttons.txt). Custom card buttons need a pressed look.
- [ ] Only **one or two prominent (filled/accent) buttons per view** (buttons.txt). Product detail: "أضف للسلة" is the
      prominent one; cart: "إتمام الطلب". ⚠️ Prominent "+" on every product card in a 3-column grid = many prominent
      buttons on screen; use a less prominent style for card buttons and keep the filled style for the main CTA.
- [ ] Use style, not size, to show the preferred choice between options (buttons.txt). Same-size buttons for a set
      (e.g. approve/reject on the substitution card), with the preferred one in a more prominent style.
- [ ] Label buttons with a verb ("Add to Cart" example in buttons.txt) → "أضف للسلة"، "أكّد الطلب"، "وافق على البديل".
- [ ] Use familiar icons for familiar actions (e.g. `square.and.arrow.up` for share).
- [ ] Destructive actions (remove from cart, cancel order, reject substitute) never get the primary role (buttons.txt).
- [ ] Actions that don't complete instantly show an activity indicator **inside the button**, optionally with a
      changed label: "Checkout" → "Checking out…" (buttons.txt). Use for "إتمام الطلب" → "جاري إرسال الطلب…".
- [ ] Avoid button label color similar to colorful content backgrounds (buttons.txt). ⚠️ Gradient header: buttons on
      it should use the default monochrome look, not the brand color.

## 2. Layout & safe areas
- [ ] Respect safe areas; never put controls under the Dynamic Island or the home indicator (layout.txt).
      Sticky add-to-cart bar and checkout bar sit above the bottom safe area.
- [ ] Put the most important items near the top and **leading** side (in Arabic = right) (layout.txt).
- [ ] Prefer standard system components so RTL flips automatically (layout.txt, right-to-left.txt).
- [ ] Group related items with space, container shapes or separators; use progressive disclosure (layout.txt).
- [ ] Differentiate controls from content with Liquid Glass + **scroll edge effect**, not a solid/semi-opaque color
      under controls (layout.txt). ⚠️ A solid gradient header that stays fixed above scrolling content goes
      against this; let the gradient be part of the scrolling content and let the system bars float on glass.
- [ ] Full-screen background content extends under toolbars and tab bars (layout.txt).
- [ ] Decide layout from size classes, not device/orientation (layout.txt). Even iPhone-only, handle
      Display Zoom, text-size changes, and RTL layout direction (all listed in layout.txt).
- [ ] Test the largest and smallest layouts, multiple text sizes and localizations (layout.txt).

## 3. Typography / Dynamic Type
- [ ] Use the system text styles (body, headline, caption...) so text scales with Dynamic Type (typography.txt).
      SF Arabic is part of the San Francisco family; don't embed system fonts in the app.
- [ ] Allow enlarging text to **at least 200 percent** (accessibility.txt).
- [ ] Avoid Ultralight, Thin, Light weights; prefer Regular, Medium, Semibold, Bold (typography.txt).
- [ ] Follow platform default and minimum sizes (typography.txt). (Table not in dump.) ⚠️ Tiny price/unit text and
      "old price" strikethrough on 3-column cards is the main risk; don't hard-code small fixed sizes.
- [ ] Layout must adapt to **all** sizes incl. Larger Accessibility Text Sizes (Settings > Accessibility > Display &
      Text Size > Larger Text) (typography.txt).
- [ ] At large sizes **reduce the number of columns** (typography.txt). ⚠️ 3-column grid and 4-column category tiles
      must drop to 2 (or 1) columns at accessibility sizes.
- [ ] Stack horizontally adjacent items vertically when text grows; let rows grow in height (layout.txt).
- [ ] Minimize truncation; aim to show as much at the largest accessibility size as at the largest standard size;
      don't truncate in scrollable regions unless a detail view shows the rest (typography.txt). Product names on
      cards: allow 2+ lines.
- [ ] Meaningful icons grow with text (use SF Symbols) (typography.txt).
- [ ] Keep hierarchy the same at any size; primary elements stay near the top (typography.txt).
- [ ] 3+ lines of text: avoid tight leading (typography.txt).
- [ ] Minimize typefaces. Custom fonts must support Dynamic Type and Bold Text themselves (typography.txt).
- [ ] Next to all-caps Latin text, Arabic often needs **about 2 points** larger (right-to-left.txt).

## 4. Loading & feedback
- [ ] Show something immediately: placeholders/skeleton cards instead of a blank screen (loading.txt).
- [ ] Let people keep browsing while content loads (loading.txt).
- [ ] Use determinate progress when duration is known, indeterminate when not (loading.txt).
- [ ] Put status near what it describes (feedback.txt): e.g. cart badge/footer, order status on the order screen.
- [ ] Use alerts only for critical, actionable info (feedback.txt). Errors → alert, not a notification
      (notifications.txt).
- [ ] Warn only before unexpected, irreversible data loss; don't warn when loss is the expected result
      (feedback.txt). Removing one cart item = expected → no alert; clearing whole cart / cancelling order = confirm.
- [ ] Confirm significant completions (e.g. order placed) (feedback.txt).
- [ ] When something can't be done, say why (feedback.txt): out of zone, below minimum order, store closed,
      out of stock.
- [ ] Feedback through more than one channel: color + text + sound/haptics (feedback.txt, accessibility.txt).
- [ ] Avoid time-boxed UI that auto-dismisses; prefer explicit dismissal (accessibility.txt). ⚠️ Auto-dismissing
      "added to cart" toasts and auto-expiring substitution offers need an explicit path too.

## 5. Gestures
- [ ] Standard gestures behave as expected: tap = activate, swipe = scroll; don't reuse them for app-specific
      actions (gestures.txt).
- [ ] Custom gestures only when needed; must be discoverable and **never the only way** to do something
      (gestures.txt). Swipe-to-delete in cart must also have a button/stepper to 0.
- [ ] Keep the Back button even if edge-swipe back exists (gestures.txt).
- [ ] Every gesture has an onscreen alternative (accessibility.txt): swipe-to-dismiss sheet also has a button.
- [ ] Show clearly when a control is unavailable (gestures.txt): disabled "+" at max/stock limit must look
      distinct.
- [ ] Respond immediately with feedback during gestures (gestures.txt).

## 6. Liquid Glass / materials
- [ ] Liquid Glass is for the **controls/navigation layer** floating above content (tab bar, toolbars) (materials.txt).
- ⚠️ **Don't use Liquid Glass in the content layer** (materials.txt): no glass on product cards, banners, category
      tiles, address card, progress card. Use standard materials (ultra-thin, thin, regular, thick) there.
- [ ] Use glass effects **sparingly** on custom controls; only the most important ones (materials.txt).
      Candidates: the sticky add-to-cart bar / checkout bar (functional layer). Not every chip.
- [ ] Regular glass variant by default; **clear** variant only over visually rich media (materials.txt). If clear
      glass sits over a bright banner/photo, add a dark dimming layer of **35% opacity** (materials.txt).
- [ ] Transient controls (e.g. a slider/toggle being dragged) may take on glass while active (materials.txt).
- [ ] Use vibrant label/fill colors on materials; avoid quaternary labels on thin/ultra-thin materials (materials.txt).
- [ ] Choose material by meaning, not by the color it gives (materials.txt).
- [ ] Color on glass: sparingly; for primary action put color on the **background**, not the text; don't tint
      multiple controls' backgrounds (color.txt).
- [ ] Standard toolbar components have corner radii concentric with the bar; custom ones must be too (toolbars.txt).
- [ ] Use the **automatic** scroll edge effect style; one per view; only when content scrolls behind floating
      controls (scroll-views.txt).

## 7. Search
- [ ] Search is important here → primary position (searching.txt). Home search field is right; iOS also allows a
      dedicated search tab at the trailing end of the tab bar (tab-bars.txt; trailing = left in RTL).
- [ ] One clear place to search everything (searching.txt).
- [ ] Show the search scope in the placeholder or title (searching.txt): "ابحث في المتجر" vs
      "ابحث في الخضار" inside a category.
- [ ] Show recent searches before typing and suggestions while typing (searching.txt).
- [ ] Privacy: provide a way to clear search history (searching.txt).
- [ ] Consider indexing products in Spotlight (searching.txt) — optional.

## 8. Maps (address sheet + order tracking)
- [ ] Make the map interactive: zoom/pan; don't cover it with noninteractive elements (maps.txt).
- [ ] Use the **muted** emphasis style when lots of custom info (zone polygon, driver, store) must stand out;
      default style otherwise (maps.txt).
- [ ] Delivery zone = an **overlay**: "above roads" level (default) keeps streets visible below it (maps.txt).
- [ ] Clearly style selected elements (outline + color variation) (maps.txt): selected address pin.
- [ ] Annotations match the app style; tint can be changed; icon string **2–3 characters** max (maps.txt).
- [ ] Contrast between custom controls and the map: thin stroke or light shadow (maps.txt).
- [ ] Keep the Apple logo and legal link visible: **7 pt** padding on the sides, **10 pt** above/below; place them
      **10 pt above the lowest resting position** of a bottom card (maps.txt). ⚠️ Our bottom ETA/steps card on the
      order screen and the fields panel in the address sheet must not cover them permanently.
- [ ] Logo/link not shown on maps smaller than **200x100** pixels (maps.txt) — small map previews are fine.
- [ ] Cluster overlapping points (maps.txt) — only relevant if several pins overlap.

## 9. Notifications (order status push)
- [ ] Get consent first; ask when the user first needs it (e.g. right after placing an order), not at launch
      (notifications.txt, onboarding.txt).
- [ ] Concise, informative; complete sentences, no truncation by us (notifications.txt).
- [ ] **One notification per event**; no repeats for the same thing (notifications.txt).
- [ ] Don't tell users to do tasks in the app; offer actions instead (notifications.txt).
- [ ] Up to **four** action buttons; short labels; prefer nondestructive; no action that only opens the app
      (notifications.txt). Substitution: "وافق" / "ارفض" (reject is destructive → give context).
- [ ] Short title, no ending punctuation, don't put the app name/icon in it (system shows icon) (notifications.txt).
- [ ] Provide generic text for hidden previews ("Shipment"-style → "تحديث طلبك") (notifications.txt).
- [ ] No sensitive info (address, phone, totals) in notification text (notifications.txt).
- [ ] App in foreground: don't show a banner; update the current view quietly (notifications.txt).
- [ ] Badge only = unread notification count; keep it updated; never fake a badge in custom UI
      (notifications.txt). ⚠️ A cart-count red badge on a custom icon could mimic a notification badge; tab bar
      badges are allowed only for critical info (tab-bars.txt).
- [ ] Sound optional, short; never the only carrier of important info (notifications.txt).

## 10. Accessibility
- [ ] VoiceOver labels on every control (card add/stepper: "أضف حليب المراعي ١ لتر", value "٢").
- [ ] Color contrast meets WCAG AA (values not in dump); check light **and** dark; provide higher contrast when
      Increase Contrast is on (accessibility.txt).
- [ ] Don't convey info with color alone (accessibility.txt, color.txt): out-of-stock, discount, progress steps,
      in/out of zone need text or icons too.
- [ ] Reduce Motion: cut auto/repeating animation, zoom/scale, replace slides with fades (accessibility.txt).
      ⚠️ Auto-advancing banner carousel = repetitive automatic motion; stop or slow it with Reduce Motion
      (and it is also time-boxed content).
- [ ] Support Voice Control, Switch Control, Full Keyboard Access via proper labels (accessibility.txt).
- [ ] Simple gestures for frequent actions; no multi-finger gestures (accessibility.txt).
- [ ] Consider Assistive Access: core flows only, one interaction per screen, confirm hard-to-undo actions twice
      (accessibility.txt). Fits our elderly users.

## 11. Color / dark mode
- [ ] Every custom color has light, dark, and increased-contrast variants — even if we ship one appearance, for
      Liquid Glass adaptivity (color.txt).
- [ ] Don't hard-code system color values; don't redefine semantic system colors (color.txt).
- [ ] One color = one meaning (color.txt): brand color for interactive ≠ color for plain text or for "discount".
- [ ] Backgrounds: system set (primary/secondary/tertiary); grouped set for grouped lists (account page)
      (color.txt).
- [ ] Colorful backgrounds → monochrome toolbars/tab bars (color.txt, toolbars.txt, tab-bars.txt).
      ⚠️ Gradient header + brand-tinted controls on it conflicts.
- [ ] Resting state (top of scroll) must be legible under bars even if colorful content scrolls beneath (color.txt).
- [ ] Test in sunlight and dim light (color.txt) — drivers' customers at the door.
- [ ] Images: embed color profiles; sRGB is safe; P3 optional (color.txt, images.txt).

## 12. Launch & onboarding
- [ ] Launch instantly; launch screen nearly identical to the first screen (home) (launching.txt).
- [ ] Launch screen: **no text**, no logo/ads unless fixed part of first screen (launching.txt). ⚠️ A branded splash
      as launch screen is not allowed; match current appearance (light/dark).
- [ ] Restore previous state (cart, scroll, open order) on relaunch (launching.txt).
- [ ] Onboarding is optional, short, interactive; prefer contextual tips (onboarding.txt).
- [ ] Postpone setup: no address/phone required before browsing (onboarding.txt) — ask in cart/checkout.
- [ ] Ask permissions (location, notifications) when the feature is first used (onboarding.txt).
- [ ] No licensing text in onboarding; ratings prompt only after engagement (onboarding.txt).

## 13. Toolbars / nav bars / tab bar
- [ ] Use the standard **tab bar** for top-level sections (home, categories, cart, account) (tab-bars.txt). On iOS it
      floats on Liquid Glass. ⚠️ A custom tab bar loses glass, RTL, Dynamic Type, accessibility behavior; use
      `TabView`. Tab bar is for navigation, not actions (no "checkout" tab button).
- [ ] Keep the tab bar visible across sections (except under modals); don't hide/disable tabs; short single-word
      labels; filled SF Symbols (tab-bars.txt).
- [ ] Use standard Back/Close buttons with standard symbols, no "رجوع" text label (toolbars.txt). Back must point
      right in RTL (right-to-left.txt) — automatic with system nav.
- [ ] Titles under **15 characters**, not the app name (toolbars.txt). Use a large title that collapses on scroll
      (toolbars.txt).
- [ ] Few toolbar items, max **three** groups; prefer symbols without borders; one `.prominent` primary action on
      the trailing side (toolbars.txt).
- [ ] Avoid custom toolbar backgrounds/tints (toolbars.txt). ⚠️ Gradient nav bar.
- [ ] Sheets (address): Cancel on the leading edge, Done on trailing; Done always paired with Cancel/Back; one sheet
      at a time; grabber + medium/large detents; swipe-to-dismiss with confirmation if unsaved edits (sheets.txt).

## 14. Lists, collections, scroll views
- [ ] Text-heavy content → lists (cart lines, account page, order history); image-heavy → grid/collection
      (lists-and-tables.txt, collections.txt).
- [ ] Use standard row/grid layouts, not custom ones (collections.txt).
- [ ] Animate insert/delete (adding/removing cart items) (collections.txt).
- [ ] Don't change the grid layout while people interact unless they asked (collections.txt) — e.g. don't reflow
      when a stepper appears on a card.
- [ ] Info button only for more info; disclosure indicator for drill-in (lists-and-tables.txt).
- [ ] Never nest scroll views of the **same orientation**; horizontal chips/carousel inside vertical scroll is fine
      (scroll-views.txt).
- [ ] Show that content scrolls: partial item at the edge of carousels/chips (scroll-views.txt).
- [ ] Paged banner carousel: show a page control and hide the same-axis scroll indicator (scroll-views.txt).
- [ ] Auto-scroll only as much as needed (e.g. to the focused field above the keyboard) (scroll-views.txt).

## 15. Text fields & keyboards (address sheet, search)
- [ ] Separate label as well as placeholder (placeholder disappears) (text-fields.txt).
- [ ] Right keyboard type: phone pad for the phone number (text-fields.txt).
- [ ] Validate at the right time; phone digits-only validation; number formatter respects locale
      (text-fields.txt). Arabic-Indic digits must be accepted.
- [ ] Clear button at the trailing end; leading image shows the field's purpose (text-fields.txt).
- [ ] Field size matches expected text; stack fields vertically with consistent widths (text-fields.txt).
- [ ] Logical next-field order (text-fields.txt).
- [ ] Phone numbers keep digit order in RTL (right-to-left.txt).

## 16. Segmented controls & steppers
- [ ] Segmented control for closely related subviews/choices; max about **five segments on iPhone**; equal widths;
      text or icons, not both; noun labels (segmented-controls.txt). Pack options (حبة/شدّة/كرتون) fit (≤5 packs).
- [ ] Don't use a segmented control to switch between separate app sections (use the tab bar).
- ⚠️ Subcategory chips: if there can be more than ~5, use scrollable chips, not a segmented control.
- [ ] Stepper value must be obvious next to it (stepper shows no value itself) (steppers.txt).
- [ ] Large quantity changes: pair the stepper with a text field (steppers.txt) — optional for bulk items.
- ⚠️ Our compact custom card stepper must still meet 44x44 pt targets per segment and expose
      `accessibilityAdjustableAction` (VoiceOver increment/decrement).

## 17. Images & RTL
- [ ] Provide @2x/@3x for bitmaps (iPhone); test on real devices for pixelation/stretching (images.txt).
- [ ] Include a color profile in each image (images.txt).
- [ ] Don't flip product photos, logos, or the checkmark; flip directional icons (back, next, progress)
      (right-to-left.txt).
- [ ] Flip progress controls (free-delivery bar, order steps) and reverse numeral order with them; never reverse the
      digits inside one number (right-to-left.txt).
- [ ] List text alignment consistent in RTL; paragraphs aligned by their own language (right-to-left.txt).
- [ ] Cart icon with badge: consider badge placement balance in RTL (right-to-left.txt).
