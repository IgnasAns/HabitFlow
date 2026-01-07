import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors as defaultColors, spacing, borderRadius } from '../theme'; // Keep imports for spacing
import { useTheme } from '../context/ThemeContext';

// Screens
import HomeScreen from '../screens/HomeScreen';
import AddHabitScreen from '../screens/AddHabitScreen';
import EditHabitScreen from '../screens/EditHabitScreen';
import StatsScreen from '../screens/StatsScreen';
import WidgetHub from '../components/WidgetHub';
import ShareScreen from '../screens/ShareScreen';
import HabitDetailScreen from '../screens/HabitDetailScreen';

// Navigation types
export type RootStackParamList = {
    Home: undefined;
    AddHabit: undefined;
    EditHabit: { habitId: string };
    Stats: undefined;
    WidgetHub: undefined;
    Share: undefined;
    HabitDetail: { habitId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// Custom theme
// Custom theme moved inside component

// Root Navigator - No more bottom tabs
export default function AppNavigator() {
    const { colors } = useTheme();

    const navTheme = {
        ...DefaultTheme,
        colors: {
            ...DefaultTheme.colors,
            background: colors.bgDark,
            card: colors.bgCard,
            text: colors.textPrimary,
            border: colors.glassBorder,
            primary: colors.primaryStart,
        },
    };

    return (
        <NavigationContainer theme={navTheme}>
            <Stack.Navigator
                screenOptions={{
                    headerStyle: {
                        backgroundColor: colors.bgDark,
                    },
                    headerTintColor: colors.textPrimary,
                    headerTitleStyle: {
                        fontWeight: '600',
                    },
                    headerShadowVisible: false,
                    contentStyle: {
                        backgroundColor: colors.bgDark,
                    },
                }}
            >
                <Stack.Screen
                    name="Home"
                    component={HomeScreen}
                    options={{ headerShown: false }}
                />
                <Stack.Screen
                    name="AddHabit"
                    component={AddHabitScreen}
                    options={{
                        headerShown: false,
                        presentation: 'modal',
                        animation: 'fade_from_bottom',
                    }}
                />
                <Stack.Screen
                    name="EditHabit"
                    component={EditHabitScreen}
                    options={{
                        headerShown: false,
                        presentation: 'modal',
                        animation: 'fade_from_bottom',
                    }}
                />
                <Stack.Screen
                    name="Stats"
                    component={StatsScreen}
                    options={{
                        headerShown: false,
                        presentation: 'modal',
                        animation: 'fade_from_bottom',
                    }}
                />
                <Stack.Screen
                    name="WidgetHub"
                    component={WidgetHub}
                    options={{
                        headerShown: false,
                        presentation: 'modal',
                        animation: 'fade_from_bottom',
                    }}
                />
                <Stack.Screen
                    name="Share"
                    component={ShareScreen}
                    options={{
                        headerShown: false,
                        presentation: 'modal',
                        animation: 'fade_from_bottom',
                    }}
                />
                <Stack.Screen
                    name="HabitDetail"
                    component={HabitDetailScreen}
                    options={{
                        headerShown: true,
                        presentation: 'modal',
                        animation: 'slide_from_bottom',
                        title: '',
                        headerTransparent: true,
                    }}
                />
            </Stack.Navigator>
        </NavigationContainer>
    );
}

