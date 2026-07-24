## 2026-07-13 - Custom Avatar Accessibility and Form Loading UX
**Learning:** Screen readers may ignore `aria-label` when it is declared on a generic structural `div` element without a semantic role. For background-image elements used as custom images/avatars, `role="img"` must be explicitly defined to guarantee screen reader announcements. Additionally, forms in our template components should include realistic asynchronous loading feedback and button disabling on submit to reflect industry-standard UX patterns.
**Action:** Always include `role="img"` on custom `div`-based images, and leverage `formState.isSubmitting` to disable buttons and update label text in form pattern examples.

## 2026-10-24 - Dynamic Accessible Table Header Sorting Descriptors
**Learning:** Table header buttons that toggle sorting are often announced by screen readers without their active sorting state or indicating the next sort action. Combining the column name with a dynamic, localized string indicating both current sort direction and click action (e.g., "Sorted ascending. Click to sort descending.") greatly improves table usability. Purely visual indicator icons within these buttons must be hidden with `aria-hidden="true"` to prevent duplicate announcements.
**Action:** Use conditional sorting state helper strings in standard data table column definitions to provide verbose, dynamic `aria-label` tags on sort triggers, and ensure any accompanying icons are explicitly hidden.

## 2026-11-05 - Visual Loading Feedback and Explicit Mandatory Indicators
**Learning:** Adding animated icons (such as SVG/icon-based `Loader2` spinners) during asynchronous form submission provides clear interactive visual feedback to users. To avoid screen reader redundancy and noise, these decorative spinner icons must be hidden with `aria-hidden="true"` since the text content (e.g., "Updating...") is already descriptive. Additionally, visually distinguishing mandatory fields with clear `*` indicators nested inside `<span class="text-destructive" aria-hidden="true">*</span>` ensures a self-evident form layout while keeping screen announcements clean.
**Action:** Always accompany disabled loading button states with a hidden-from-SR spinner icon and use CSS-styled indicators on mandatory field labels.

## 2026-11-20 - Remotion Image Slide Accessibility
**Learning:** In video rendering and presentation frameworks like Remotion, individual images (such as screenshots loaded via `<Img>`) that act as content slides must have descriptive `alt` text. Simply rendering them with zero descriptive fields leaves screen readers without context during slideshow previews. Binding the slide's `title` as the image `alt` property guarantees that assistive technologies can read out the current visual slide's context.
**Action:** Always provide the `alt` property matching the corresponding slide title for image slide components within video presentation templates.

## 2026-11-21 - Locking Down Tabbed Form Submissions
**Learning:** In multi-tabbed interactive form patterns (such as authentication layouts), users can switch tabs or edit sibling fields while one form is in the middle of submission unless all interactive elements are explicitly disabled. Disabling `TabsTrigger` buttons, password visibility toggles, standard inputs, and help links via the active submission state (`isLoading` or `isSubmitting`) prevents interrupted states and double submissions.
**Action:** Always disable all form fields, toggle buttons, tab list triggers, and other action buttons during active submission states to guarantee a cohesive and secure user experience.

## 2026-11-22 - Password Manager Integration and Browser Autofill Accessibility
**Learning:** Modern login and registration forms often lack standard `autoComplete` attributes, preventing browser autofill tools and password managers from correctly identifying input purposes. Explicitly annotating input elements with semantic autocomplete values (such as `email`, `current-password`, `new-password`, and `name`) satisfies WCAG 1.3.5 (Identify Input Purpose) and significantly enhances mobile and desktop keyboard entry UX.
**Action:** Always include explicit, semantic `autoComplete` attributes on authentication and user registration form fields to support seamless auto-filling and password manager synchronization.

## 2026-11-23 - Interactive Inline Link Focus Indicators
**Learning:** In dark-themed dashboard components, interactive inline links (such as usernames and repository names) frequently lack visual focus indicators. While `hover:underline` is commonly used for mouse users, keyboard-only navigators are left without clear visual feedback. Coupling `focus-visible:ring-1` with outline prevention and visible underlines on focus ensures WCAG 2.1 compliance without compromising the dark, high-fidelity design aesthetics.
**Action:** Always provide custom `focus-visible:underline`, focus-visible rings, and custom roundings on all inline interactive links to ensure high keyboard-navigation visibility.
