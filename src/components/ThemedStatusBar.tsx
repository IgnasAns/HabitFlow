import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../context/ThemeContext';

/**
 * StatusBar component that automatically adapts its style based on the current theme.
 * - Dark theme: light (white) icons for visibility on dark backgrounds
 * - Light theme: dark (black) icons for visibility on light backgrounds
 */
export default function ThemedStatusBar() {
    const { theme } = useTheme();

    return (
        <StatusBar
            style={theme === 'dark' ? 'light' : 'dark'}
            hidden={false}
            translucent
            backgroundColor="transparent"
        />
    );
}
