import React, { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { StyleSheet, View, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as NavigationBar from 'expo-navigation-bar';
import { HabitProvider } from './src/context/HabitContext';
import { I18nProvider } from './src/context/I18nContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import AppNavigator from './src/navigation/AppNavigator';
import ThemedStatusBar from './src/components/ThemedStatusBar';
import { colors } from './src/theme';

import { initFeedbackSettings } from './src/utils/feedback';
import { registerForPushNotificationsAsync } from './src/utils/notifications';

// Set notification handler to allow notifications when app is in foreground
Notifications.setNotificationHandler({
    handleNotification: async (): Promise<Notifications.NotificationBehavior> => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
    }),
});

/**
 * Root view rendered inside the providers so it can read the active theme.
 * Owns the themed background and keeps the Android navigation bar in sync
 * with the current theme (instead of a hardcoded colour).
 */
function ThemedRoot() {
    const { colors: themeColors, theme } = useTheme();

    useEffect(() => {
        // With edge-to-edge (default on Expo SDK 54), the system bars are
        // transparent and `setBackgroundColorAsync`/`setBehaviorAsync` are
        // unsupported no-ops that warn. We only adjust the nav button colour
        // so the icons stay legible against the app background.
        if (Platform.OS === 'android') {
            NavigationBar.setButtonStyleAsync(theme === 'dark' ? 'light' : 'dark');
            // Keep the immersive hidden nav bar (this call is supported under
            // edge-to-edge; only setBackgroundColorAsync/setBehaviorAsync warn).
            NavigationBar.setVisibilityAsync('hidden');
        }
    }, [theme]);

    return (
        <View style={[styles.container, { backgroundColor: themeColors.bgDark }]}>
            <ThemedStatusBar />
            <AppNavigator />
        </View>
    );
}

export default function App() {
    useEffect(() => {
        // Initialize settings that don't depend on theme
        initFeedbackSettings();
        registerForPushNotificationsAsync();
    }, []);

    return (
        <GestureHandlerRootView style={styles.container}>
            <ThemeProvider>
                <I18nProvider>
                    <HabitProvider>
                        <ThemedRoot />
                    </HabitProvider>
                </I18nProvider>
            </ThemeProvider>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        // Fallback background painted before the theme provider mounts.
        backgroundColor: colors.bgDark,
    },
});
