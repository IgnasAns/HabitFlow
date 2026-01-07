import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TextInput,
    Pressable,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
    FadeInDown,
    useAnimatedStyle,
    withSpring,
    useSharedValue,
    SharedValue,
} from 'react-native-reanimated';
import { triggerHaptic, triggerSelectionHaptic, triggerNotificationHaptic, FeedbackType, ImpactStyle } from '../utils/feedback';
import { useHabits } from '../context/HabitContext';
import { useI18n, interpolate } from '../context/I18nContext';
import { useTheme } from '../context/ThemeContext';
import { spacing, borderRadius, typography, habitIcons } from '../theme';
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

export default function EditHabitScreen({ route, navigation }: EditHabitScreenProps) {
    const { habitId } = route.params;
    const { habits, updateHabit, deleteHabit } = useHabits();
    const { t } = useI18n();
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const styles = useMemo(() => getStyles(colors, insets), [colors, insets]);

    const habit = habits.find(h => h.id === habitId);

    const [name, setName] = useState(habit?.name || '');
    const [description, setDescription] = useState(habit?.description || '');
    const [selectedIcon, setSelectedIcon] = useState(habit?.icon || '💪');
    const [selectedColor, setSelectedColor] = useState(habit?.colorIndex || 0);
    const [dailyTarget, setDailyTarget] = useState(habit?.dailyTarget?.toString() || '1');
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [completions, setCompletions] = useState(habit?.completions || {});

    const activeThemeColor = colors.habitColors[selectedColor]?.[0] || colors.primaryStart;

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
            triggerNotificationHaptic(FeedbackType.Error);
            return;
        }

        triggerNotificationHaptic(FeedbackType.Success);

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
        triggerHaptic(ImpactStyle.Medium);
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
    const ChoiceButton = ({ onPress, active, children, style, activeColor }: any) => {
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
                style={[
                    style,
                    choiceStyle,
                    active && styles.activeChoice,
                    active && activeColor && {
                        borderColor: activeColor,
                        borderWidth: 2,
                        backgroundColor: activeColor + '25',
                    }
                ]}
            >
                {children}
            </AnimatedPressable>
        );
    };

    // Helper to get the last "visual" character (handles emojis with variation selectors/ZWJ)
    const getLastGrapheme = (text: string) => {
        if (!text) return '';
        if (typeof Intl !== 'undefined' && (Intl as any).Segmenter) {
            try {
                const segmenter = new (Intl as any).Segmenter('en', { granularity: 'grapheme' });
                const segments = Array.from(segmenter.segment(text));
                if (segments.length > 0) {
                    return (segments[segments.length - 1] as any).segment;
                }
            } catch (e) { }
        }
        const chars = Array.from(text);
        if (chars.length === 0) return '';
        let last = chars[chars.length - 1];
        if ((last === '\ufe0f' || last === '\ufe0e') && chars.length >= 2) {
            return chars[chars.length - 2] + last;
        }
        return last;
    };

    const isCustomIcon = !habitIcons.includes(selectedIcon as any);

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


                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.headerMain}>
                        <Pressable
                            onPress={() => navigation.navigate('Home')}
                            style={styles.backButton}
                            hitSlop={20}
                        >
                            <Ionicons name="chevron-back" size={28} color={colors.textPrimary} />
                        </Pressable>
                        <View style={styles.headerTitleGroup}>
                            <Text style={styles.title}>{t.nav.editHabit}</Text>
                            <View style={styles.statsRow}>
                                <StreakBadge streak={habit.streak} size="medium" />
                                <Text style={styles.statsText}>
                                    {interpolate(t.stats.completionsCount, {
                                        count: Object.keys(habit.completions).filter(k => habit.completions[k] >= (habit.dailyTarget || 1)).length
                                    })}
                                </Text>
                            </View>
                        </View>
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
                    <Text style={styles.sectionTitle}>{t.habit.name}</Text>
                    <View style={styles.inputContainer}>
                        <Text style={styles.inputIcon}>{selectedIcon}</Text>
                        <TextInput
                            style={styles.input}
                            placeholder={t.habit.namePlaceholder}
                            placeholderTextColor={colors.textMuted}
                            value={name}
                            onChangeText={setName}
                            maxLength={50}
                        />
                    </View>
                </View>

                {/* Description Input */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{t.habit.description}</Text>
                    <View style={styles.inputContainer}>
                        <TextInput
                            style={styles.input}
                            placeholder={t.habit.descriptionPlaceholder}
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
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>{t.habit.icon}</Text>
                        {isCustomIcon && (
                            <View style={styles.customBadge}>
                                <Text style={styles.customBadgeText}>{t.habit.custom}</Text>
                            </View>
                        )}
                    </View>
                    <View style={styles.iconGrid}>
                        {habitIcons.map((icon, index) => (
                            <ChoiceButton
                                key={index}
                                active={selectedIcon === icon}
                                style={styles.iconButton}
                                activeColor={activeThemeColor}
                                onPress={() => {
                                    triggerSelectionHaptic();
                                    setSelectedIcon(icon);
                                }}
                            >
                                <Text style={styles.iconText}>{icon}</Text>
                            </ChoiceButton>
                        ))}
                    </View>

                    {/* Distinct Custom Icon Input */}
                    <View style={styles.customIconContainer}>
                        <Text style={styles.customIconPrompt}>{t.habit.customIcon}</Text>
                        <View style={[
                            styles.customIconInputBox,
                            isCustomIcon && {
                                borderColor: activeThemeColor,
                                backgroundColor: activeThemeColor + '15'
                            }
                        ]}>
                            <TextInput
                                style={[styles.iconText, styles.customTextInput]}
                                value={isCustomIcon ? selectedIcon : ''}
                                onChangeText={(text) => {
                                    if (text.length > 0) {
                                        const icon = getLastGrapheme(text);
                                        setSelectedIcon(icon);
                                        triggerSelectionHaptic();
                                    } else {
                                        setSelectedIcon('💪');
                                    }
                                }}
                                placeholder={t.habit.customIconPlaceholder}
                                placeholderTextColor={colors.textMuted}
                                maxLength={10}
                            />
                            {!isCustomIcon && <Ionicons name="add-circle-outline" size={20} color={colors.textMuted} />}
                        </View>
                    </View>
                </Animated.View>

                {/* Color Picker */}
                <Animated.View
                    entering={FadeInDown.delay(500)}
                    style={styles.section}
                >
                    <Text style={styles.sectionTitle}>{t.habit.color}</Text>
                    <View style={styles.colorGrid}>
                        {colors.habitColors.map((gradient, index) => (
                            <ChoiceButton
                                key={index}
                                active={selectedColor === index}
                                style={[styles.colorButton, selectedColor === index && styles.colorButtonActive]}
                                activeColor={colors.habitColors[index][0]}
                                onPress={() => {
                                    triggerSelectionHaptic();
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
                        {t.habit.dangerZone}
                    </Text>
                    <AnimatedPressable
                        style={[styles.deleteButton, deleteButtonStyle]}
                        onPress={handleDelete}
                        onPressIn={() => handlePressIn(deleteScale)}
                        onPressOut={() => handlePressOut(deleteScale)}
                    >
                        <Text style={styles.deleteButtonText}>{t.habit.deleteHabit}</Text>
                    </AnimatedPressable>
                </Animated.View>

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
                        <Text style={styles.saveButtonText}>{t.habit.saveChanges}</Text>
                    </LinearGradient>
                </AnimatedPressable>
            </View>

            <ConfirmationModal
                visible={showDeleteModal}
                title={t.confirm.deleteTitle}
                message={interpolate(t.confirm.deleteMessage, { name: habit.name })}
                confirmLabel={t.habit.deleteHabit}
                cancelLabel={t.common.cancel}
                type="danger"
                onConfirm={async () => {
                    setShowDeleteModal(false);
                    triggerNotificationHaptic(FeedbackType.Success);
                    await deleteHabit(habitId);
                    navigation.goBack();
                }}
                onCancel={() => setShowDeleteModal(false)}
            />
        </KeyboardAvoidingView>
    );
}


const getStyles = (colors: any, insets: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.bgDark,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: spacing.md,
        paddingTop: Math.max(insets.top, 20) + spacing.sm,
    },
    dragHandleContainer: {
        alignItems: 'center',
        paddingVertical: spacing.sm,
        marginBottom: spacing.xs,
    },
    dragHandle: {
        width: 40, height: 4,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 2,
    },
    header: {
        marginBottom: spacing.lg,
    },
    headerMain: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    headerTitleGroup: {
        flex: 1,
    },
    backButton: {
        marginLeft: -spacing.xs,
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
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.sm,
    },
    sectionTitle: {
        ...typography.bodyBold,
        color: colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 1,
        fontSize: 12,
    },
    customBadge: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    customBadgeText: {
        ...typography.small,
        color: colors.textSecondary,
        fontSize: 10,
        textTransform: 'uppercase',
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
    customIconContainer: {
        marginTop: spacing.md,
    },
    customIconPrompt: {
        ...typography.caption,
        color: colors.textSecondary,
        marginBottom: spacing.xs,
    },
    customIconInputBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.glass,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.glassBorder,
        paddingHorizontal: spacing.md,
        height: 56,
    },
    customTextInput: {
        flex: 1,
        ...typography.body,
        color: colors.textPrimary,
        fontSize: 18,
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
