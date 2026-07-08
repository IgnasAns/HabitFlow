// Get the last "visual" character of a string, handling emojis with
// variation selectors / ZWJ sequences (so e.g. "❤️" stays intact).
// ️ = emoji presentation (VS16), ︎ = text presentation (VS15).
const VARIATION_SELECTORS = ['️', '︎'];

export const getLastGrapheme = (text: string): string => {
    if (!text) return '';

    // Use Intl.Segmenter if available (modern Hermes)
    const IntlAny = Intl as unknown as { Segmenter?: any };
    if (typeof Intl !== 'undefined' && IntlAny.Segmenter) {
        try {
            const segmenter = new IntlAny.Segmenter('en', { granularity: 'grapheme' });
            const segments = Array.from(segmenter.segment(text)) as { segment: string }[];
            if (segments.length > 0) {
                return segments[segments.length - 1].segment;
            }
        } catch (e) { /* fall through to manual splitting */ }
    }

    // Fallback: smart splitting for complex symbols like VS16 (❤️)
    const chars = Array.from(text);
    if (chars.length === 0) return '';
    const last = chars[chars.length - 1];
    if (VARIATION_SELECTORS.includes(last) && chars.length >= 2) {
        return chars[chars.length - 2] + last;
    }
    return last;
};
