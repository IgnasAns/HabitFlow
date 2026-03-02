/**
 * Widget Preview Screen for rapid testing
 * Access via Settings > Widget Preview
 * Allows testing widget designs with hot reload
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Pressable,
    Dimensions,
} from 'react-native';
import { WidgetPreview } from 'react-native-android-widget';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { WeeklyHabitWidget, MonthlyHabitWidget, GitHubHabitWidget } from '../widgets/HabitWidgets';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Test data for previewing widgets
const TEST_HABIT_DATA = {
    habitName: 'Exercise Daily',
    habitIcon: '💪',
    habitColorIndex: 1, // Emerald Green
    streak: 14,
    todayProgress: 1,
    dailyTarget: 1,
    isCompletedToday: true,
    widgetId: 0,
    gridData: generateTestGridData(100),
};

// Generate test grid data with realistic pattern
function generateTestGridData(days: number) {
    const data = [];
    const today = new Date();

    for (let i = days - 1; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);

        // Simulated completion pattern (more likely to complete on weekdays)
        const dayOfWeek = date.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const completionChance = isWeekend ? 0.4 : 0.75;
        const isCompleted = i === 0 ? true : Math.random() < completionChance;

        data.push({
            isCompleted,
            isMissed: !isCompleted && i > 0,
            progress: isCompleted ? 1 : 0,
            dailyTarget: 1,
            isToday: i === 0,
        });
    }
    return data;
}

// Widget size presets (in dp)
const WIDGET_SIZES = {
    small: { width: 180, height: 110, label: 'Small (2x1)' },
    medium: { width: 250, height: 180, label: 'Medium (3x2)' },
    large: { width: 320, height: 180, label: 'Large (4x2)' },
    wide: { width: 350, height: 110, label: 'Wide (4x1)' },
};

// Color options to test
const TEST_COLORS = [
    { index: 0, name: 'Cyan', color: '#06B6D4' },
    { index: 1, name: 'Emerald', color: '#10B981' },
    { index: 2, name: 'Amber', color: '#F59E0B' },
    { index: 3, name: 'Blue', color: '#3B82F6' },
    { index: 4, name: 'Pink', color: '#EC4899' },
    { index: 5, name: 'Orange', color: '#F97316' },
    { index: 6, name: 'Purple', color: '#8B5CF6' },
    { index: 7, name: 'Red', color: '#EF4444' },
];

export default function WidgetPreviewScreen({ navigation }: any) {
    const insets = useSafeAreaInsets();
    const [selectedWidget, setSelectedWidget] = useState<'weekly' | 'monthly' | 'github'>('weekly');
    const [selectedSize, setSelectedSize] = useState<keyof typeof WIDGET_SIZES>('medium');
    const [selectedColor, setSelectedColor] = useState(1);
    const [isCompleted, setIsCompleted] = useState(true);
    const [refreshKey, setRefreshKey] = useState(0);

    // Force refresh to regenerate preview
    const forceRefresh = () => setRefreshKey(k => k + 1);

    // Get current test data with selected options
    const getTestData = useCallback(() => ({
        ...TEST_HABIT_DATA,
        habitColorIndex: selectedColor,
        isCompletedToday: isCompleted,
        gridData: generateTestGridData(100),
    }), [selectedColor, isCompleted, refreshKey]);

    // Render function for WidgetPreview
    const renderWidget = useCallback(({ width, height }: { width: number; height: number }) => {
        const data = getTestData();

        switch (selectedWidget) {
            case 'weekly':
                return <WeeklyHabitWidget {...data} />;
            case 'monthly':
                return <MonthlyHabitWidget {...data} />;
            case 'github':
                return <GitHubHabitWidget {...data} />;
            default:
                return <WeeklyHabitWidget {...data} />;
        }
    }, [selectedWidget, getTestData]);

    // Handle click actions from widget
    const handleClick = useCallback((props: any) => {
        console.log('Widget click:', props);
        if (props.clickAction === 'TOGGLE_HABIT') {
            setIsCompleted(c => !c);
        }
    }, []);

    const currentSize = WIDGET_SIZES[selectedSize];

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </Pressable>
                <Text style={styles.title}>Widget Preview</Text>
                <Pressable onPress={forceRefresh} style={styles.refreshBtn}>
                    <Ionicons name="refresh" size={22} color="#06B6D4" />
                </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Widget Preview Area */}
                <View style={styles.previewSection}>
                    <Text style={styles.sectionTitle}>Live Preview</Text>
                    <Text style={styles.hint}>
                        Changes to HabitWidgets.tsx will hot reload here!
                    </Text>

                    <View style={styles.previewContainer}>
                        <WidgetPreview
                            key={`${selectedWidget}-${selectedSize}-${selectedColor}-${isCompleted}-${refreshKey}`}
                            renderWidget={renderWidget}
                            width={currentSize.width}
                            height={currentSize.height}
                            onClick={handleClick}
                            showBorder={true}
                            highlightClickableAreas={true}
                        />
                    </View>

                    <Text style={styles.sizeLabel}>
                        {currentSize.width} x {currentSize.height} dp
                    </Text>
                </View>

                {/* Widget Type Selector */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Widget Type</Text>
                    <View style={styles.optionRow}>
                        {(['weekly', 'monthly', 'github'] as const).map((type) => (
                            <Pressable
                                key={type}
                                style={[
                                    styles.optionBtn,
                                    selectedWidget === type && styles.optionBtnActive
                                ]}
                                onPress={() => setSelectedWidget(type)}
                            >
                                <Text style={[
                                    styles.optionText,
                                    selectedWidget === type && styles.optionTextActive
                                ]}>
                                    {type.charAt(0).toUpperCase() + type.slice(1)}
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                </View>

                {/* Size Selector */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Widget Size</Text>
                    <View style={styles.optionRow}>
                        {(Object.keys(WIDGET_SIZES) as Array<keyof typeof WIDGET_SIZES>).map((size) => (
                            <Pressable
                                key={size}
                                style={[
                                    styles.optionBtn,
                                    selectedSize === size && styles.optionBtnActive
                                ]}
                                onPress={() => setSelectedSize(size)}
                            >
                                <Text style={[
                                    styles.optionText,
                                    selectedSize === size && styles.optionTextActive
                                ]}>
                                    {WIDGET_SIZES[size].label}
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                </View>

                {/* Color Selector */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Habit Color</Text>
                    <View style={styles.colorRow}>
                        {TEST_COLORS.map((c) => (
                            <Pressable
                                key={c.index}
                                style={[
                                    styles.colorBtn,
                                    { backgroundColor: c.color },
                                    selectedColor === c.index && styles.colorBtnActive
                                ]}
                                onPress={() => setSelectedColor(c.index)}
                            >
                                {selectedColor === c.index && (
                                    <Ionicons name="checkmark" size={18} color="#fff" />
                                )}
                            </Pressable>
                        ))}
                    </View>
                </View>

                {/* Completion Toggle */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Today's Status</Text>
                    <View style={styles.optionRow}>
                        <Pressable
                            style={[
                                styles.optionBtn,
                                isCompleted && styles.optionBtnActive
                            ]}
                            onPress={() => setIsCompleted(true)}
                        >
                            <Text style={[
                                styles.optionText,
                                isCompleted && styles.optionTextActive
                            ]}>
                                ✓ Completed
                            </Text>
                        </Pressable>
                        <Pressable
                            style={[
                                styles.optionBtn,
                                !isCompleted && styles.optionBtnActive
                            ]}
                            onPress={() => setIsCompleted(false)}
                        >
                            <Text style={[
                                styles.optionText,
                                !isCompleted && styles.optionTextActive
                            ]}>
                                ○ Not Done
                            </Text>
                        </Pressable>
                    </View>
                </View>

                {/* Instructions */}
                <View style={[styles.section, styles.infoBox]}>
                    <Text style={styles.infoTitle}>💡 How to use</Text>
                    <Text style={styles.infoText}>
                        1. Edit src/widgets/HabitWidgets.tsx{'\n'}
                        2. Save the file{'\n'}
                        3. Preview updates instantly via hot reload{'\n'}
                        4. Click the checkmark area to test toggle{'\n'}
                        5. Red borders show clickable areas
                    </Text>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#080C14',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    backBtn: {
        padding: 8,
    },
    title: {
        flex: 1,
        fontSize: 20,
        fontWeight: '700',
        color: '#fff',
        marginLeft: 8,
    },
    refreshBtn: {
        padding: 8,
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 40,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#94A3B8',
        marginBottom: 12,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    previewSection: {
        marginBottom: 32,
        alignItems: 'center',
    },
    hint: {
        fontSize: 12,
        color: '#64748B',
        marginBottom: 16,
    },
    previewContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        backgroundColor: '#121926',
        borderRadius: 16,
        minWidth: SCREEN_WIDTH - 32,
    },
    sizeLabel: {
        marginTop: 8,
        fontSize: 12,
        color: '#64748B',
    },
    optionRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    optionBtn: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 10,
        backgroundColor: '#1E293B',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
    },
    optionBtnActive: {
        backgroundColor: '#06B6D4',
        borderColor: '#06B6D4',
    },
    optionText: {
        fontSize: 13,
        color: '#94A3B8',
        fontWeight: '500',
    },
    optionTextActive: {
        color: '#fff',
    },
    colorRow: {
        flexDirection: 'row',
        gap: 10,
    },
    colorBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: 'transparent',
    },
    colorBtnActive: {
        borderColor: '#fff',
    },
    infoBox: {
        backgroundColor: '#1E293B',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(6, 182, 212, 0.2)',
    },
    infoTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#06B6D4',
        marginBottom: 8,
    },
    infoText: {
        fontSize: 13,
        color: '#94A3B8',
        lineHeight: 22,
    },
});
