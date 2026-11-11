# WWDC rules for the Ohod native SwiftUI grocery app (Arabic RTL, iOS 17+, Xcode 26)

Sources (read in full): WWDC18-803 Designing Fluid Interfaces · WWDC22-10107 Get it right (to left) ·
WWDC25-219 Meet Liquid Glass · WWDC25-356 Get to know the new design system ·
WWDC25-306 Optimize SwiftUI performance with Instruments · WWDC23-10156 Explore SwiftUI animation ·
WWDC24-10145 Enhance your UI animations and transitions.
Quotes are from the transcripts. Anything marked **[derived]** is my inference for this app, not something the sessions say.
📌 = one of the 20 highest-impact rules.

---

## 1) Fluid interaction principles (WWDC18-803)

📌 1.1 **Zero latency on every touch.** "Look for delays everywhere. It's not just swipes. It's taps, it's presses... Everything needs to respond instantly." Add-to-cart, stepper +/−, chips, tab switches: update UI state synchronously on tap; do the network sync afterwards. Never put a spinner between the tap and the visible count change.
1.2 **Highlight on touch-down, commit on touch-up.** "The button should highlight immediately when I touch down on it... But, we shouldn't confirm the tap until my touch goes up." Use `Button` + a custom `ButtonStyle` that reads `configuration.isPressed`; never `onTapGesture` for the add/stepper buttons (no press state, no cancel).
1.3 **Let people cancel a tap by dragging off.** "If I drag my finger outside the tap area, and lift it, I can cancel the tap." `Button` gives this free. Add an "extra margin around the tap area" — use `.contentShape` with padding so small +/− glyphs on 3-column cards have ≥44pt hit targets **[derived: 44pt is HIG, not in these talks]**.
📌 1.4 **Everything interruptible and redirectable.** "Allow for constant redirection and interruption." A product-detail zoom that is mid-open must accept a swipe back; a sheet mid-dismiss must accept a grab; a cart-badge bounce must retarget if tapped again. Use springs (they retarget, see 2.2) and never disable interaction "until the animation finishes".
1.5 **Detect intent from motion, not timers.** iPhone X multitasking detects pause via "acceleration... instead of waiting for some timer". Rule: no `asyncAfter` debounces that gate visual feedback.
📌 1.6 **Spatial consistency: symmetric paths.** "If something disappears one way, we expect it to emerge from where it came." Product detail must zoom back *into the same grid card* it came from; address sheet goes back down; pushed screens leave toward the edge they came from (trailing-edge in RTL = left side) — let `NavigationStack` do it.
1.7 **Hint in the direction of the gesture.** Elements should "grow from the initial state to the final state". A pressed product card should scale slightly toward its expanded form before the zoom; the cart button may "lift" toward the sheet.
1.8 **Lightweight input, amplified output.** "Take a small input and make a big output." Flicks on the banner carousel and grid must carry momentum (native `ScrollView` paging/`scrollTargetBehavior` does this — don't replace with custom drag code).
1.9 **Rubber-band boundaries, never hard walls.** "Softly indicating boundaries... It would feel super harsh... you actually wouldn't know the difference between a frozen phone" and the edge. Keep system bounce on all ScrollViews (don't set `.scrollBounceBehavior(.basedOnSize)` on the home feed); a custom draggable (e.g. order-tracking bottom panel) must resist past its limits with diminishing offset, then spring back.
1.10 **Smooth hand-offs between trackers.** "They both smoothly hand off in smooth curves." When the tracking panel reaches full height and inner content starts scrolling, there must be no jump.
1.11 **It's what's in the frames, not just frame rate.** "Too much visual change between the adjacent frames" causes strobing; "at a nice 60 frames per second... it just feels off" is still possible. Avoid very fast large translations (e.g. a fly-to-cart image crossing the whole screen in 0.15s).
📌 1.12 **Default to no overshoot; bounce only when the gesture had momentum.** "Start with 100% damping, or no overshoot." Music: tap to open = 100% damping; swipe to dismiss = "80% damping to have a little bit of bounce". For us: tap-opened sheets/details → `.smooth`; flick-dismissed sheet / flung tracking panel → small bounce (`.snappy` / bounce ≈ 0.2 **[derived from 80% damping]**).
1.13 **Bounce can teach.** The flashlight button bounces to hint "press a little more firmly". Use a small bounce on the cart badge to say "added", nowhere decorative.
1.14 **Describe springs by response + damping, not duration.** "We actually like to avoid using duration when we're describing elastic behaviors." Mass/stiffness are "overwhelming or unwieldy".
📌 1.15 **On release: project momentum to choose the endpoint.** "Instead of finding the nearest endpoint... we can calculate its projected position." For the tracking bottom panel (detents) and any swipe-to-delete in cart: endpoint = position + projected travel from velocity using `UIScrollView.DecelerationRate.normal`; never "nearest by position only". SwiftUI `DragGesture.Value.predictedEndLocation` gives this projection **[derived]**.
1.16 **One-to-one tracking; keep the grab offset.** "Touch and content should move together... never use the center of the image as the dragging point." Use the gesture's translation, not location minus center.
1.17 **Hysteresis ≈ "10 points in iOS"** before a drag starts; decide axis there. Custom drags inside the vertical feed: `DragGesture(minimumDistance: 10)` and only claim horizontal movement.
1.18 **Continuous feedback, never end-only gestures.** "Avoid methods that are only detected at the end of the gesture, like UISwipeGestureRecognizer."
1.19 **Detect competing gestures in parallel; avoid double-tap.** Double-tap delays every single tap "by about half a second". **No double-tap-to-add on product cards.**
1.20 **Consistent character.** "Treat behaviors as a family of behaviors." Pick one spring family for the whole app (see 2.3) so grid, cart, sheets feel the same.
1.21 **Teach with affordances:** clip content at edges to show more ("clip the content off the bottom"), page indicators on the banner carousel, grabber on sheets.
1.22 Build interactive prototypes: "The interactive demo we think is really worth a million static designs."

## 2) SwiftUI animation API rules (WWDC23-10156, WWDC24-10145)

2.1 **Use springs by default.** "We highly recommend using spring animations because they give your UI an organic feel by preserving velocity and naturally coming to rest." Bare `withAnimation` is already `.smooth` "in iOS 17".
📌 2.2 **Why springs: they merge and retarget.** Springs "override shouldMerge to return true... preserve velocity and retarget to the new value"; timing curves run additively. → Rapid stepper taps / repeated add taps must use springs, never `.easeInOut`.
2.3 **App spring palette (only these three presets):** "Smooth, which has no bounce, snappy, which has a small amount of bounce, and bouncy, which has a larger amount of bounce." Map: `.smooth` = layout/expand/sheets/insert-remove; `.snappy` = stepper count, chip selection, card press; `.bouncy` = only the cart badge "added" pulse. Springs are specified by "perceived duration... and how bouncy" — tune `.snappy(duration:extraBounce:)` rather than mass/stiffness. (The talks give no numeric preset values; don't invent them.)
2.4 Higher-order modifiers (`delay`, `speed`, `repeatCount`) only where needed; no `repeatForever` on grid cards (cost + distraction).
2.5 **Scope animations with `.animation(_:value:)`, never the value-less form or a blanket `.transaction` override.** Indiscriminate overriding "can lead to accidental animations". For container views (product card that hosts an async image, cart row), use the iOS 17 body-closure form `.animation(.snappy) { $0.scaleEffect(...) }` which "narrowly scopes the animation to the animatable attributes specified" — prevents the remote image fade-in or price text from inheriting the spring.
2.6 Different parts, different animations: insert separate `.animation(_:value:)` modifiers (e.g. bouncy scale on badge, smooth shadow) — order matters (applies to modifiers above it).
2.7 **Custom TransactionKey to distinguish interactive vs programmatic changes** (e.g. `cartChangedByUser`): lively spring when user tapped, subdued (or none) when the cart syncs from the server. Use the scoped `.transaction(value:)` / body-closure variants. "withAnimation is just a thin wrapper around withTransaction."
2.8 Server-driven updates (stock refresh, price change, order status poll) → `withTransaction(\.disablesAnimations, true)` or a subdued spring **[derived]**; don't animate the whole grid on a data reload.
2.9 **Prefer built-in animatable effects (`scaleEffect`, `offset`, `opacity`) over custom `Animatable`.** Built-ins animate "off the main thread and without calling into any of your view code"; a custom Animatable "will run body for every frame". Only use custom Animatable for things like a progress arc along a path (order-tracking ring) and keep that body tiny.
📌 2.10 **Zoom transition grid → product detail (iOS 18+ only, gate it).** `.navigationTransition(.zoom(sourceID: product.id, in: ns))` on the destination + `.matchedTransitionSource(id: product.id, in: ns)` on the card. "Specify the same identifier and namespace." Use the stable product ID (cells are reused — "capture a stable identifier... rather than capture a view directly"). On iOS 17 fall back to the default push: `if #available(iOS 18, *)` **[derived: app targets 17]**. Use it "in places where you have a large cell to zoom from" — product cards and banners yes; tiny category chips no.
2.11 Zoom works for `sheet`/`fullScreenCover` too — usable for banner → promo page.
📌 2.12 **Expect transitions to start at any time.** Zoom is "continuously interactive, allowing you to grab and drag it around, from the beginning or during the transition." "Don't try to 'handle' being in a transition differently"; "keep temporary transition state to a minimum"; reset in `onAppear/onDisappear` (UIKit: viewDidAppear/Disappear, "guaranteed to be called"). An interrupted push "is always converted into a pop". Never block the add-to-cart button on the detail page during the transition.
2.13 **Gesture-driven: `.interactiveSpring` during drag, normal spring on end.** "Each of these events creates a new .interactiveSpring animation, each new animation retargeting the last one. Then, when the gesture ends, a final non-interactive spring... uses the velocity" — no manual initial-velocity math. Apply to tracking panel and any swipeable cart row.
2.14 **Bridging UIKit/MapKit views:** in `UIViewRepresentable.updateUIView` use `context.animate { ... }` so map overlays/pins move "perfectly in sync" with the SwiftUI transaction; it runs inline when not animated. iOS 18: `UIView.animate(<SwiftUI Animation>)` animates presentation values directly (no CAAnimation).
2.15 Avoid: timing-curve animations for interactive state; `.animation(_:)` without value; `withAnimation` around network callbacks; custom Animatable on the 3-column grid; long fixed-duration animations that block input.

## 3) Liquid Glass / new design system (WWDC25-219, WWDC25-356)

📌 3.1 **Glass = navigation layer only, never content.** Glass "is best reserved for the navigation layer that floats above the content". Product cards, category tiles, cart rows, banners, the gradient header, product detail body = **content layer, no glass**. "Making it Liquid Glass would make it compete... and muddy the hierarchy."
📌 3.2 **Never glass on glass.** "Always avoid glass on glass." Badges/counts on a glass button use "fills, transparency, and vibrancy", not another `.glassEffect`.
3.3 **Regular variant everywhere; Clear only if all 3 hold:** "over media-rich content", content "won't be negatively affected by introducing a dimming layer", content on top "is bold and bright". Candidate: a back/close button floating over the product hero image on detail. Never mix Regular and Clear.
📌 3.4 **Remove custom bar backgrounds/borders.** "If you've customized your bars, now's the time to clean them up... making customizations like these unnecessary." Do not paint the brand gradient into `UINavigationBar`/`toolbarBackground`; let the gradient header be scrolling content and let glass bars float above it.
📌 3.5 **Tint sparingly — one primary action per screen.** "Avoid tinting all your elements. When every element is tinted, nothing stands out." Example given: "this View Bag button is a great example... the red makes it stand out as the primary action in this food delivery app." → Tint only "إتمام الطلب"/checkout and "أضف للسلة" on detail. Use built-in glass tinting (`.glassEffect(.regular.tint(...))` / `.buttonStyle(.glassProminent)`) not a solid fill ("completely opaque and breaks the visual character"). Brand color goes in the content layer.
📌 3.6 **Checkout bar belongs to the cart screen, not the tab bar accessory.** "Avoid placing screen-specific actions here—a checkout button, for example, belongs with the content it supports." Tab-bar accessory (`tabViewBottomAccessory`) only for persistent things — e.g. an active-order tracking mini bar across tabs **[derived]**.
3.7 **Tab bar:** keep it standard (Home, Categories, Cart, Account) + the dedicated **Search tab** ("iOS now includes a dedicated Search tab at the bottom") via `Tab(role: .search)`. No custom tab bar; it must morph and adapt light/dark itself.
3.8 **Toolbars:** group items "by function and frequency"; "not group symbols with text"; text buttons get their own container; primary "Done" separate and tinted. Crowded bar → move secondaries into a More menu.
3.9 **Scroll edge effects, not hard dividers or gradients.** They "replace hard dividers with subtle blur"; "not decorative... shouldn't be used where there aren't any floating UI elements." Use **soft** (default on iOS); **hard** only for a pinned accessory like sticky chip row/column header. "Apply one scroll edge effect per view"; "avoid mixing or stacking". Remove our own top/bottom fade overlays under bars.
3.10 Glass legibility is automatic over scrolling content (shadow/tint/dynamic range adapt, small bars flip light↔dark). Don't add our own shadows/strokes to glass.
3.11 **No content/glass intersections at rest.** "In steady states, such as when an app first launches, avoid intersections between content and Liquid Glass. Instead, reposition or scale the content." → Home: inset the search field/first banner so the top toolbar doesn't overlap them before scrolling; add bottom content margin so the last grid row and the cart checkout bar clear the tab bar.
3.12 **Concentric corners.** Three shape types: fixed, capsule ("half the height"), concentric ("subtracting padding from the parent's"). Product image inside a card, cart row thumbnail, banner inside its container → `ConcentricRectangle` / `.containerShape` so inner radius = outer − padding; watch for corners "too pinched— or flared". Components used both nested and standalone: "concentric shape with a fallback radius".
3.13 **Buttons near screen edges on iPhone:** "use a capsule with extra margin" (sticky checkout button = capsule, inset from screen edges and home indicator).
3.14 **Sheets:** modal interruption (address picker) = glass + dimming; parallel tasks (e.g. map sheet in tracking) = no dimming; system handles sheets growing/turning more opaque at larger detents. Use system `.sheet` + `.presentationDetents`; don't fake sheets with custom overlays.
3.15 **Menus/action sheets spring from their source** ("springs from the action itself") — attach `confirmationDialog`/`Menu` to the button that triggers them (e.g. "تغيير العنوان").
3.16 Custom glass controls: "apply the material directly to the control, not its inner views"; group neighbours with `GlassEffectContainer` so they morph together **[API name derived]**.
3.17 Background extension: hero/banner imagery can extend under bars (`backgroundExtensionEffect`), with text/controls layered above it.
3.18 Prefer symbols in bars and menus; when meaning is ambiguous "a text label is always the better choice". Use one symbol per related group, not variants.
3.19 System colors were retuned for glass; use semantic colors. Typography is "bolder and left-aligned" in alerts/onboarding — in Arabic that means leading (right) alignment.
3.20 Accessibility comes free (Reduce Transparency, Increase Contrast, Reduce Motion "disables any elastic properties") only if we use the real material — another reason not to fake glass with `.ultraThinMaterial` + borders.

## 4) RTL / Arabic specifics (WWDC22-10107)

📌 4.1 **Use leading/trailing everywhere, never left/right**, except absolute directions. "Left and right are always left and right... the other terms reverse." `HStack`, `.padding(.leading)`, `alignment: .leading` flip automatically; native nav, collection/scroll views and paging "handle scrolling correctly in right to left".
4.2 **Navigation direction is free:** push "slides in from the trailing edge"; back swipe and back chevron mirror automatically. Never hard-code a slide-from-right transition; never override `layoutDirection` on the NavigationStack.
4.3 **Carousels and horizontal shelves:** native horizontal `ScrollView`/`TabView(.page)` reverse "the paging direction and the meanings of the swipe gestures automatically" — first banner sits at the right; do not reverse arrays manually.
📌 4.4 **SF Symbols: forward/backward flip, left/right don't.** "The 'forward' and 'backward' ones flip, and the 'left' and 'right' ones don't." Use `chevron.forward` for disclosure, `arrow.backward` for back-like actions; `cart`, `bag`, `plus`, `minus` are symmetric. Help/question icons: SF Symbols gives the reversed Arabic question mark automatically.
4.5 Custom images (e.g. a delivery scooter illustration pointing "forward"): set Direction = Mirrors in the asset catalog; use "Both" when shading must not flip; "Fixed" for logos/product photos (**never mirror product photos/brand packaging** **[derived]**).
4.6 **Opt out only for absolute/spatial things:** `.environment(\.layoutDirection, .leftToRight)` on the specific subtree (e.g. text-alignment segmented controls, a phone-number field, map compass/scale). It's inherited by children, so apply as narrowly as possible. Steppers, sliders, segmented controls otherwise reverse automatically — keep the system order for +/−.
4.7 **Labels with icons:** `Label` puts the icon "before the label in the user's reading direction"; for icon-after-text write a custom `LabelStyle` with an `HStack` (still auto-reverses).
📌 4.8 **Numerals: Saudi Arabia uses Arabic-Indic digits by default, users can switch.** "Some, such as Saudi Arabia, using native digits and others, such as the United Arab Emirates, using Latin digits." Always format via `String(localized:)`, `Text` interpolation, or `.formatted()`; never `String(n)`, `"\(n)"` into non-localized strings, or `String(format:)` — those "always use Latin digits". Prices: `price.formatted(.currency(code: "SAR"))` — never append "ر.س" or "%" yourself ("the minus sign and the percent sign are on different sides of the number"; Arabic digits use "a completely different percent symbol").
4.9 Static strings with numbers ("توصيل خلال 30 دقيقة") → keep one Arabic localization and interpolate the number at runtime so digits follow the user's preference.
4.10 **Bidi text:** product names mix Arabic + Latin brands/sizes ("حليب المراعي 1L"); `String(localized:)` wraps interpolations in isolation marks — build composite strings through it, not concatenation.
4.11 **Multi-line alignment:** `.multilineTextAlignment(.leading)` on product names/descriptions; frame alignment ≠ line alignment ("its bounding box is right-aligned, not the individual lines").
4.12 Natural writing direction/alignment is default for text fields — don't force `.trailing`/`.right` on Arabic input; force LTR only for phone/OTP-like fields.
4.13 **Fonts/line height: the transcripts do not cover these.** **[derived]** Use the system font with Dynamic Type text styles (Arabic glyphs come from the system fallback); avoid fixed `frame(height:)` on text and avoid `lineLimit(1)` for Arabic product names (Arabic needs taller ascenders/descenders and diacritics); prefer `lineLimit(2)` + `minimumScaleFactor` sparingly.
4.14 **Test with the "Right-to-Left Pseudolanguage"** (Scheme → Options → App Language) plus a real Arabic run with Region = Saudi Arabia to see Arabic-Indic digits.

## 5) Performance (WWDC25-306, plus animation-cost notes from WWDC23-10156)

5.1 **Symptoms:** "Animations may pause or jump, or scrolling may be delayed." A **hitch** = "a frame that stays visible on screen for too long, delaying future frames"; work must "complete before each frame deadline". (Neither 8 ms nor 16 ms is stated in these talks; **[derived]** budget = 1/refresh-rate: ~16.7 ms at 60 Hz, ~8.3 ms at 120 Hz ProMotion, and UI update must fit well inside that.)
📌 5.2 **Keep view bodies fast — no formatters or computation in `body`.** The demo's hitch came from creating a `NumberFormatter` and `MeasurementFormatter` per body run: "because view bodies run on the main thread, my app has to wait." For us: price strings, "٣ × ٤٫٥٠ ر.س" totals, discount %, ETA text, distance → precompute in the model/view model (or use static cached `FormatStyle`s), cache per product, recompute only when input changes.
5.3 **Unnecessary updates add up even when each is fast.** "A large number of relatively fast updates that all have to happen during this frame" also causes a hitch.
📌 5.4 **Observation granularity: no card may read the whole cart.** The favorites bug: each row called `isFavorite(landmark)` which read the whole array, so "every item view's body runs" on any change. Our equivalent: card stepper reading `cart.items[product.id]` from one `@Observable` cart dictionary → every visible card re-renders on each tap. Fix as in the session: a per-product `@Observable` line model (`CartLine` with `qty`) stored in the cart, and each card reads only its own line ("each view only depends directly on its own... view model"). Same for favorites and stock flags.
5.5 Pass cards plain values (`let product: ProductDTO`, `let line: CartLine`) not the whole store; keep card views small so SwiftUI can skip bodies.
📌 5.6 **Never put fast-changing values in the Environment.** Every environment reader pays a check: "avoid storing values that update really often, such as geometry values or timers, in the environment." → Scroll offset (for the collapsing gradient header), driver GPS location, ETA countdown ticks: keep in a dedicated `@Observable` read only by the header/map views.
5.7 **Representables are profiled separately** ("Long Representable Updates"). Keep `updateUIView` of the MapKit wrapper cheap: diff annotations, don't rebuild overlays on each driver-location tick.
5.8 Custom `Animatable` runs body every frame (2.9) — none on grid cells. Built-in effects animate off-main-thread.
📌 5.9 **Image work off the main thread [derived from "view bodies run on the main thread"; images not covered in the talk].** ~7,700 remote images: decode/downscale to the cell's pixel size off-main (e.g. `UIImage.byPreparingThumbnail(ofSize:)` / `preparingForDisplay()` in a Task), cache decoded thumbnails in memory+disk keyed by URL+size, request only for visible cells (`LazyVGrid`), cancel on disappear. Never decode full-size images inside `body` or `AsyncImage` without a sized cache for a 3-column grid.
5.10 Use `LazyVGrid`/`LazyVStack` with stable `id: \.id` (product id); avoid `id: \.self` on structs and avoid `AnyView` in cells **[derived]**.
5.11 **How to profile:** "press Command-I" (Release build) → SwiftUI template (SwiftUI instrument, Time Profiler, Hangs, Hitches). Check "Long View Body Updates" lane first; investigate red before orange; select update → "Set Inspection Range and Zoom" → Time Profiler. Use the **Cause & Effect Graph** to ask "what marked my view body as outdated?" — breakpoint backtraces don't explain SwiftUI updates.
5.12 Long updates during first frame after launch are normal ("this won't result in a hitch"); focus on ones during scroll and taps.
5.13 Concrete test passes to run each release: (a) fast-scroll home grid 3 shelves; (b) tap + on one card 10× quickly — expect exactly one card body update per tap; (c) open/close zoom detail 5× mid-transition; (d) tracking screen 60 s with live driver location — no long representable updates.
5.14 "Use Instruments early and often." Takeaway quote: "Ensure your view bodies update quickly and only when needed."

## 6) Per-screen application checklist (applies the rules above)

**Home (gradient header + search + banners + chips + 3-col grid)**
- Gradient header is scrolling content, not a bar background (3.4); bars float as glass above it (3.1).
- Inset search field and first banner so nothing intersects the glass toolbar at rest (3.11).
- Collapsing header driven by scroll geometry kept out of the Environment (5.6); use `onScrollGeometryChange` (iOS 18) or a local observable, read only by the header **[derived]**.
- Banner carousel: native paging, page indicator, reverses in RTL automatically (1.21, 4.3).
- Chips: `.snappy` selection change, scoped `.animation(_:value:)` (2.3, 2.5); sticky chip row may use the hard scroll-edge style (3.9).
- Grid: `LazyVGrid`, stable product IDs, per-card line model, precomputed price strings, sized thumbnails (5.2, 5.4, 5.9, 5.10).
- Card add button: touch-down highlight, ≥44pt hit area, no double-tap, instant count change (1.1-1.3, 1.19).
- Card image inside card: concentric corners (3.12).

**Categories (4-col tiles) / category grid**
- Tiles are content (no glass); concentric or fixed radius consistently (3.1, 3.12).
- Category grid reuses the home card view and its rules unchanged (1.20).

**Product detail (zoom from card)**
- `matchedTransitionSource` on card + `.navigationTransition(.zoom)` on detail, iOS 18 gated (2.10).
- Must survive swipe-back mid-zoom and pop-during-push; no transition-state flags (2.12).
- Floating close/back over hero image: Regular glass (Clear only if 3.3 holds).
- One tinted primary action: "أضف للسلة" (3.5). Pack options (حبة/شدّة/كرتون) as a segmented control that keeps system RTL order (4.6).

**Cart (steppers + sticky checkout bar)**
- Checkout bar is a capsule, inset from edges, part of the cart screen, tinted glass prominent (3.5, 3.6, 3.13).
- Steppers: springs only, rapid taps retarget (2.2); row removal with `.smooth` (2.3).
- Swipe-to-delete (if custom): `.interactiveSpring` while dragging, projected endpoint on release (1.15, 2.13).
- Totals/VAT/discount strings via `.formatted(.currency(code: "SAR"))`, Arabic-Indic digits (4.8).
- Server re-pricing updates animate subdued or not at all (2.7, 2.8).

**Address sheet (MapKit)**
- System `.sheet` with detents; modal = dimmed (3.14); confirm button is the single tinted action.
- Map pin drag: one-to-one tracking, keep grab offset (1.16); map compass/scale may stay LTR (4.6).
- `updateUIView` cheap, `context.animate` for pin moves if UIKit map is used (2.14, 5.7).

**Order tracking (map + progress)**
- Bottom panel: rubber-band past limits, momentum-projected detent on release, small bounce only after a flick (1.9, 1.12, 1.15).
- Driver location ticks stored in one observable read only by the map; diff annotations (5.6, 5.7).
- Progress steps follow reading direction (start at right); progress ring may use a custom Animatable, kept tiny (2.9).
- Active-order mini bar may live in the tab-bar bottom accessory because it is persistent across tabs (3.6).

**Account**
- Standard `List`/`Form`; `chevron.forward` disclosures (4.4); no custom row backgrounds that fight the grouped capsule shapes (3.12).
- Phone number field: LTR layout direction only on that field (4.6, 4.12).

---

### Top 10 (the short version)
1. Instant response on every tap; springs that are interruptible/retargetable (1.1, 1.4, 2.2).
2. Card stepper/favorite reads only its own `@Observable` line model — never the whole cart (5.4).
3. No formatters/computation in `body`; precompute prices/ETAs (5.2).
4. Liquid Glass only on bars/floating controls; content stays solid; no glass-on-glass (3.1, 3.2).
5. Remove custom bar backgrounds; tint only the one primary action (checkout) (3.4, 3.5).
6. Checkout bar lives in the cart screen, not the tab-bar accessory; dedicated Search tab (3.6, 3.7).
7. Zoom transition grid→detail with stable product ID, iOS 18 gated, ready to be interrupted (2.10, 2.12).
8. leading/trailing + forward/backward symbols; opt out of RTL only for absolute directions (4.1, 4.4, 4.6).
9. Arabic-Indic digits via `String(localized:)`/`.formatted()`; currency via formatter (4.8).
10. 100% damping by default, bounce only after momentum; project momentum on release (1.12, 1.15).
