/**
 * The product has no name yet, so the interface shows none.
 *
 * There is deliberately nothing here to render as a wordmark. The only words the app still needs
 * are for the browser tab, which cannot be empty, and those are a description rather than a name
 * — inventing a placeholder would just put an invented name on screen, which is the thing being
 * avoided.
 *
 * When a name is chosen, it goes in two places: this constant, and the header wordmark in
 * `components/AppLayout.tsx`, which is currently just the mark.
 */
export const APP_TITLE = 'Maths practice'
