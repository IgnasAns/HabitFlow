import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as NavigationBar from 'expo-navigation-bar';
import { HabitProvider } from './src/context/HabitContext';
import AppNavigator from './src/navigation/AppNavigator';
import { colors } from './src/theme';

export default function App() {
    useEffect(() => {
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
            <HabitProvider>
                <View style={styles.container}>
                    <StatusBar style="light" hidden={false} translucent backgroundColor="transparent" />
                    <AppNavigator />
                </View>
            </HabitProvider>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.bgDark,
    },
});
