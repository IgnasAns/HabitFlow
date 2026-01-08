import { StyleSheet } from 'react-native';

/**
 * StyleSheet cache to prevent memory leaks from repeated StyleSheet.create() calls.
 * 
 * Problem: When getStyles() is called inside useMemo, it creates a NEW StyleSheet
 * object on each call, even if the colors are the same. Over time, navigating between
 * screens and toggling habits causes thousands of StyleSheet objects to accumulate.
 * 
 * Solution: Cache StyleSheets by a stringified key of their dependencies.
 */

type StyleCreator<T, D> = (deps: D) => T;

const styleCache = new Map<string, any>();

// Limit cache size to prevent unbounded growth
const MAX_CACHE_SIZE = 50;

/**
 * Create and cache a stylesheet based on dependencies.
 * Returns cached version if deps match, otherwise creates new and caches it.
 */
export function getCachedStyles<T, D extends object>(
    key: string,
    deps: D,
    creator: StyleCreator<T, D>
): T {
    // Create a cache key from the component name and stringified deps
    const depsKey = `${key}:${JSON.stringify(deps)}`;

    if (styleCache.has(depsKey)) {
        return styleCache.get(depsKey);
    }

    // Evict oldest entries if cache is full
    if (styleCache.size >= MAX_CACHE_SIZE) {
        const firstKey = styleCache.keys().next().value;
        if (firstKey) {
            styleCache.delete(firstKey);
        }
    }

    const styles = creator(deps);
    styleCache.set(depsKey, styles);
    return styles;
}

/**
 * Clear the style cache (useful for theme changes)
 */
export function clearStyleCache() {
    styleCache.clear();
}

/**
 * Get cache statistics for debugging
 */
export function getStyleCacheStats() {
    return {
        size: styleCache.size,
        maxSize: MAX_CACHE_SIZE,
    };
}
