import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TextInput,
    Pressable,
    KeyboardAvoidingView,
    Platform,
    Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
    FadeInDown,
    useAnimatedStyle,
    withSpring,
    useSharedValue,
    SharedValue,
    Layout,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useHabits } from '../context/HabitContext';
import { colors, spacing, borderRadius, typography, habitIcons } from '../theme';
import StreakBadge from '../components/StreakBadge';
import ConfirmationModal from '../components/ConfirmationModal';
import HabitCircleCalendar from '../components/HabitCircleCalendar';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

interface EditHabitScreenProps {
    navigation: NativeStackNavigationProp<any>;
    route: RouteProp<{ EditHabit: { habitId: string } }, 'EditHabit'>;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function EditHabitScreen({ navigation, route }: EditHabitScreenProps) {
    const { habits, updateHabit, deleteHabit } = useHabits();
    const { habitId } = route.params;

    const habit = habits.find(h => h.id === habitId);

    const [name, setName] = useState(habit?.name || '');
    const [description, setDescription] = useState(habit?.description || '');
    const [selectedIcon, setSelectedIcon] = useState(habit?.icon || '💪');
    const [selectedColor, setSelectedColor] = useState(habit?.colorIndex || 0);
    const [dailyTarget, setDailyTarget] = useState(habit?.dailyTarget?.toString() || '1');
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [completions, setCompletions] = useState(habit?.completions || {});

    const buttonScale = useSharedValue(1);
    const deleteScale = useSharedValue(1);

    useEffect(() => {
        if (!habit) {
            navigation.goBack();
        }
    }, [habit]);

    if (!habit) return null;

    const handleSave = async () => {
        if (!name.trim()) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            return;
        }

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        await updateHabit(habitId, {
            name: name.trim(),
            description: description.trim(),
            icon: selectedIcon,
            colorIndex: selectedColor,
            dailyTarget: parseInt(dailyTarget) || 1,
            completions: completions,
        });

        navigation.goBack();
    };

    const handleDelete = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setShowDeleteModal(true);
    };

    const handlePressIn = (scale: SharedValue<number>) => {
        scale.value = withSpring(0.95, { damping: 15, stiffness: 300 });
    };

    const handlePressOut = (scale: SharedValue<number>) => {
        scale.value = withSpring(1, { damping: 15, stiffness: 300 });
    };

    const buttonStyle = useAnimatedStyle(() => ({
        transform: [{ scale: buttonScale.value }],
    }));

    const deleteButtonStyle = useAnimatedStyle(() => ({
        transform: [{ scale: deleteScale.value }],
    }));

    // For picker micro-interactions
    const ChoiceButton = ({ onPress, active, children, style }: any) => {
        const scale = useSharedValue(1);
        const choiceStyle = useAnimatedStyle(() => ({
            transform: [{ scale: scale.value }],
        }));

        const handleIn = () => {
            // Snappier spring
            scale.value = withSpring(0.92, { stiffness: 400, damping: 10 });
        };
        const handleOut = () => {
            scale.value = withSpring(1, { stiffness: 400, damping: 10 });
        };

        return (
            <AnimatedPressable
                onPress={onPress}
                onPressIn={handleIn}
                onPressOut={handleOut}
                style={[style, choiceStyle, active && styles.activeChoice]}
            >
                {children}
            </AnimatedPressable>
        );
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="always"
            >
                {/* Drag Handle */}
                <View style={styles.dragHandleContainer}>
                    <View style={styles.dragHandle} />
                </View>

                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>Edit Habit</Text>
                    <View style={styles.statsRow}>
                        <StreakBadge streak={habit.streak} size="medium" />
                        <Text style={styles.statsText}>
                            {Object.keys(habit.completions).filter(k => habit.completions[k] >= habit.dailyTarget).length} completions
                        </Text>
                    </View>
                </View>

                {/* Circle Calendar */}
                <View style={{ marginBottom: spacing.lg }}>
                    <HabitCircleCalendar
                        completions={habit.completions}
                        dailyTarget={habit.dailyTarget}
                        gradientColors={colors.habitColors[selectedColor] || colors.primary}
                    />
                </View>

                {/* Name Input */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Habit Name</Text>
                    <View style={styles.inputContainer}>
                        <Text style={styles.inputIcon}>{selectedIcon}</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g., Morning Meditation"
                            placeholderTextColor={colors.textMuted}
                            value={name}
                            onChangeText={setName}
                            maxLength={50}
                        />
                    </View>
                </View>

                {/* Description Input */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Description (Optional)</Text>
                    <View style={styles.inputContainer}>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g., Clear the mind and stay focused"
                            placeholderTextColor={colors.textMuted}
                            value={description}
                            onChangeText={setDescription}
                            maxLength={100}
                        />
                    </View>
                </View>

                {/* Icon Picker */}
                <Animated.View
                    entering={FadeInDown.delay(400)}
                    style={styles.section}
                >
                    <Text style={styles.sectionTitle}>Choose an Icon</Text>
                    <View style={styles.iconGrid}>
                        {habitIcons.map((icon, index) => (
                            <ChoiceButton
                                key={index}
                                active={selectedIcon === icon}
                                style={styles.iconButton}
                                onPress={() => {
                                    Haptics.selectionAsync();
                                    setSelectedIcon(icon);
                                }}
                            >
                                <Text style={styles.iconText}>{icon}</Text>
                            </ChoiceButton>
                        ))}
                    </View>
                </Animated.View>

                {/* Color Picker */}
                <Animated.View
                    entering={FadeInDown.delay(500)}
                    style={styles.section}
                >
                    <Text style={styles.sectionTitle}>Choose a Color</Text>
                    <View style={styles.colorGrid}>
                        {colors.habitColors.map((gradient, index) => (
                            <ChoiceButton
                                key={index}
                                active={selectedColor === index}
                                style={[styles.colorButton, selectedColor === index && styles.colorButtonActive]}
                                onPress={() => {
                                    Haptics.selectionAsync();
                                    setSelectedColor(index);
                                }}
                            >
                                <LinearGradient
                                    colors={[...gradient]}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.colorGradient}
                                />
                            </ChoiceButton>
                        ))}
                    </View>
                </Animated.View>

                {/* Danger Zone */}
                <Animated.View
                    entering={FadeInDown.delay(600)}
                    style={styles.section}
                >
                    <Text style={[styles.sectionTitle, { color: colors.dangerStart }]}>
                        Danger Zone
                    </Text>
                    <AnimatedPressable
                        style={[styles.deleteButton, deleteButtonStyle]}
                        onPress={handleDelete}
                        onPressIn={() => handlePressIn(deleteScale)}
                        onPressOut={() => handlePressOut(deleteScale)}
                    >
                        <Text style={styles.deleteButtonText}>Delete Habit</Text>
                    </AnimatedPressable>
                </Animated.View>

                {/* Bottom spacing */}
                {/* Bottom spacing */}
                <View style={{ height: 120 }} />
            </ScrollView>

            {/* Save Button */}
            <View style={styles.buttonContainer}>
                <AnimatedPressable
                    style={[styles.saveButton, buttonStyle]}
                    onPress={handleSave}
                    onPressIn={() => handlePressIn(buttonScale)}
                    onPressOut={() => handlePressOut(buttonScale)}
                    disabled={!name.trim()}
                >
                    <LinearGradient
                        colors={name.trim() ? [...colors.primary] : ['#444', '#333']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.saveButtonGradient}
                    >
                        <Text style={styles.saveButtonText}>Save Changes</Text>
                    </LinearGradient>
                </AnimatedPressable>
            </View>

            <ConfirmationModal
                visible={showDeleteModal}
                title="Delete Habit?"
                message={`Are you sure you want to delete "${habit.name}"? This will permanently erase all your progress and streaks.`}
                confirmLabel="Yes, Delete Habit"
                cancelLabel="Cancel"
                type="danger"
                onConfirm={async () => {
                    setShowDeleteModal(false);
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    await deleteHabit(habitId);
                    navigation.goBack();
                }}
                onCancel={() => setShowDeleteModal(false)}
            />
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.bgDark,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: spacing.md,
        paddingTop: spacing.lg,
    },
    dragHandleContainer: {
        alignItems: 'center',
        paddingVertical: spacing.sm,
        marginBottom: spacing.xs,
    },
    dragHandle: {
        width: 40,
        height: 4,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 2,
    },
    header: {
        marginBottom: spacing.lg,
        alignItems: 'center',
    },
    title: {
        ...typography.h1,
        color: colors.textPrimary,
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        marginTop: spacing.sm,
    },
    statsText: {
        ...typography.caption,
        color: colors.textSecondary,
    },
    section: {
        marginBottom: spacing.lg,
    },
    sectionTitle: {
        ...typography.bodyBold,
        color: colors.textSecondary,
        marginBottom: spacing.sm,
        textTransform: 'uppercase',
        letterSpacing: 1,
        fontSize: 12,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.glass,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.glassBorder,
        paddingHorizontal: spacing.md,
    },
    inputIcon: {
        fontSize: 24,
        marginRight: spacing.sm,
    },
    input: {
        flex: 1,
        ...typography.body,
        color: colors.textPrimary,
        paddingVertical: spacing.md,
    },
    iconGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    iconButton: {
        width: 48,
        height: 48,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.glass,
        borderRadius: borderRadius.sm,
        borderWidth: 1,
        borderColor: colors.glassBorder,
    },
    activeChoice: {
        borderColor: colors.primaryStart,
        backgroundColor: 'rgba(102, 126, 234, 0.15)',
    },
    iconText: {
        fontSize: 24,
    },
    colorGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    colorButton: {
        width: 48,
        height: 48,
        borderRadius: borderRadius.sm,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: 'transparent',
    },
    colorButtonActive: {
        borderColor: '#fff',
    },
    colorGradient: {
        flex: 1,
    },
    deleteButton: {
        padding: spacing.md,
        backgroundColor: 'rgba(255, 107, 107, 0.1)',
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: 'rgba(255, 107, 107, 0.3)',
        alignItems: 'center',
    },
    deleteButtonText: {
        ...typography.bodyBold,
        color: colors.dangerStart,
    },
    buttonContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: spacing.md,
        paddingBottom: spacing.xl,
        backgroundColor: colors.bgDark,
    },
    saveButton: {
        borderRadius: borderRadius.md,
        overflow: 'hidden',
        ...Platform.select({
            ios: {
                shadowColor: colors.primaryStart,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
            },
            android: {
                elevation: 6,
            },
        }),
    },
    saveButtonGradient: {
        paddingVertical: spacing.md,
        alignItems: 'center',
    },
    saveButtonText: {
        ...typography.bodyBold,
        color: colors.textPrimary,
        fontSize: 18,
    },
});
