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

## 2026-11-24 - Consolidating Form Live Character Counters
**Learning:** Rendering duplicate character counters on a single text field (e.g. at the top of the field and inside the description footer) introduces visual redundancy and confusing duplicate screen reader updates. Consolidating into a single, beautifully positioned character counter with `aria-live="polite"` at the top-right of the text area improves both the visual aesthetic and accessible screen-reader experience.
**Action:** Always ensure exactly one screen-reader accessible `aria-live="polite"` character counter is declared per text field, and avoid repeating the counter state in descriptions.

## 2026-11-25 - Real-Time Match Validation for Secure Password Inputs
**Learning:** For registration, authentication, or password update forms, tracking the state of both the new password and confirm password fields in real-time allows displaying elegant, accessible visual match feedback (utilizing green/red states and `aria-live="polite"`) and conditionally disabling submit controls to prevent submission of mismatched passwords.
**Action:** Include a matching status indicator with `aria-live="polite"` adjacent to confirm password labels, and disable the form submission trigger upon any detected state mismatch.

## 2026-11-26 - Preventing Focus Loss on Conditional Inline Input Clear Controls
**Learning:** In interactive input fields (such as search/filtering inputs) that conditionally render inline 'Clear' buttons, clicking the button causes it to unmount immediately. This results in an immediate loss of keyboard focus, resetting the active keyboard focus element back to the document body. To maintain a smooth and accessible keyboard-navigation flow, binding a React `useRef` to the input element and invoking `.focus()` inside the click handler immediately after resetting the value ensures focus is smoothly returned to the input.
**Action:** Always bind a ref to text input components and manually focus them when unmounting conditional inline controls like 'Clear' or 'Reset' buttons.

## 2026-11-27 - High-Contrast Column Sort Cues and Focus-Retentive Empty States
**Learning:** Static sort-direction icons (like ArrowUpDown) do not provide clear visual distinction for active sorting states, leading to cognitive fatigue as users re-scan table data. Replacing them with distinct ArrowUp/ArrowDown icons on active sort directions instantly clarifies the interface. In addition, when tables return zero results due to active filtering, providing a focus-retentive "Clear filter" action inside the empty cell prevents dead-ends and ensures keyboard navigation flow is not disrupted.
**Action:** Render conditional high-contrast sort icons for active column headers, and accompany empty states with focus-retentive, inline clear-filter controls.

## 2026-11-28 - Real-Time Caps Lock Detection for Password Entry
**Learning:** Users frequently mistype passwords without realizing that Caps Lock is active, leading to login frustration. Providing real-time, highly visible, but screen-reader polite Caps Lock warnings adjacent to secure input fields (using standard React keyboard modifier state tracking and `aria-live="polite"`) significantly improves accessibility and prevents entry errors.
**Action:** Bind `onKeyDown` and `onKeyUp` listeners using `event.getModifierState("CapsLock")` to password input components, and render a helpful warnings container adjacent to fields when active.

## 2026-11-29 - Persistent Live Containers and Truncated Node Accessibility
**Learning:** Dynamic live message containers (e.g., Caps Lock indicators or password match reports) that conditionally mount/unmount tend to break screen reader tracking because assistive software may not watch dynamically injected root live regions. Keeping the `aria-live` containers persistently mounted in the DOM while conditionally outputting text solves this elegantly. Additionally, truncated links or names should include a native `title` attribute so hover and keyboard users can discover the un-truncated content.
**Action:** Always render `aria-live="polite"` wrapper elements persistently in JSX, and attach standard HTML `title` attributes on truncated links.

## 2026-11-30 - Disabling All Fields in Forms with Async Submission Patterns
**Learning:** In forms using asynchronous submission patterns, disabling only the submit button allows users to change input values, textareas, or select options mid-flight while the API call is in progress. This can lead to mismatching submitted data payloads or unexpected form state transitions. Disabling all interactive controls (inputs, textareas, selects) and ensuring the `disabled={formState.isSubmitting}` property is placed after the Hook Form `{...field}` spread prevents properties in the spread object from overriding the explicitly declared disabled state.
**Action:** Always disable all form inputs, textareas, and select components with `disabled={formState.isSubmitting}` placed after the `{...field}` spread on React-based forms.
