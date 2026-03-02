import React, { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { StyleSheet, View, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as NavigationBar from 'expo-navigation-bar';
import { HabitProvider } from './src/context/HabitContext';
import { I18nProvider } from './src/context/I18nContext';
import { ThemeProvider } from './src/context/ThemeContext';
import AppNavigator from './src/navigation/AppNavigator';
import ThemedStatusBar from './src/components/ThemedStatusBar';
import { colors } from './src/theme';

import { initFeedbackSettings } from './src/utils/feedback';
import { registerForPushNotificationsAsync } from './src/utils/notifications';

// Set notification handler to allow notifications when app is in foreground
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
    } as any),
});

export default function App() {
    useEffect(() => {
        // Initialize settings
        initFeedbackSettings();
        registerForPushNotificationsAsync();

        // Make Android fully immersive - hide navigation bar completely
        if (Platform.OS === 'android') {
            // Use dark background color that matches the app
            NavigationBar.setBackgroundColorAsync('#080C14');
            NavigationBar.setButtonStyleAsync('light');
            // Set to sticky immersive - nav bar hidden but swipe from bottom to show
            NavigationBar.setBehaviorAsync('overlay-swipe');
            NavigationBar.setVisibilityAsync('hidden');
        }
    }, []);

    return (
        <GestureHandlerRootView style={styles.container}>
            <ThemeProvider>
                <I18nProvider>
                    <HabitProvider>
                        <View style={styles.container}>
                            <ThemedStatusBar />
                            <AppNavigator />
                        </View>
                    </HabitProvider>
                </I18nProvider>
            </ThemeProvider>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.bgDark,
    },
});
