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
    Switch,
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
import HabitCalendar from '../components/HabitCalendar';
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
    const [frequency, setFrequency] = useState<'daily' | 'weekly'>((habit?.frequency === 'daily' || habit?.frequency === 'weekly') ? habit.frequency : 'daily');
    const [dailyTarget, setDailyTarget] = useState(habit?.dailyTarget?.toString() || '1');
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [completions, setCompletions] = useState(habit?.completions || {});

    // Time Slot State
    const [hasTimeSlot, setHasTimeSlot] = useState(!!habit?.timeSlot);
    const [startTime, setStartTime] = useState(habit?.timeSlot?.start || '12:00');
    const [endTime, setEndTime] = useState(habit?.timeSlot?.end || '13:00');
    const [reminderEnabled, setReminderEnabled] = useState(habit?.timeSlot?.reminder || false);
    const [activeTimePicker, setActiveTimePicker] = useState<'start' | 'end' | null>(null);

    // Custom Time Picker State (for active picker)
    const [customMode, setCustomMode] = useState(false);
    const [localHour, setLocalHour] = useState('');
    const [localMinute, setLocalMinute] = useState('');

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
            frequency,
            dailyTarget: parseInt(dailyTarget) || 1,
            completions: completions,
            timeSlot: hasTimeSlot ? {
                start: startTime,
                end: endTime,
                reminder: reminderEnabled
            } : undefined,
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

                {/* Monthly Calendar */}
                <View style={{ marginBottom: spacing.lg }}>
                    <HabitCalendar
                        habit={{
                            ...habit,
                            colorIndex: selectedColor,
                            completions: completions,
                        }}
                        onToggle={(dateKey) => {
                            const current = completions[dateKey] || 0;
                            const isWeekly = habit.frequency === 'weekly';
                            const effectiveTarget = isWeekly ? 1 : habit.dailyTarget;

                            const newCompletions = { ...completions };
                            if (current >= effectiveTarget) {
                                // Toggle off - remove completion
                                delete newCompletions[dateKey];
                            } else {
                                // Toggle on - complete it
                                newCompletions[dateKey] = effectiveTarget;
                            }
                            setCompletions(newCompletions);
                            triggerSelectionHaptic();
                        }}
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

                {/* Time Slot Section */}
                <Animated.View
                    entering={FadeInDown.delay(600)}
                    style={styles.section}
                >
                    <View style={styles.sectionHeaderTimeSlot}>
                        <Text style={styles.sectionTitle}>{t.habit.timeSlot || "Time Slot"}</Text>
                        <Switch
                            value={hasTimeSlot}
                            onValueChange={(v) => {
                                triggerSelectionHaptic();
                                setHasTimeSlot(v);
                                if (!v) setReminderEnabled(false);
                            }}
                            trackColor={{ false: colors.bgCard, true: colors.primaryStart }}
                            thumbColor={'#fff'}
                        />
                    </View>

                    {hasTimeSlot && (
                        <View style={styles.timeSlotContainer}>
                            <View style={styles.timeRow}>
                                <Pressable
                                    style={[styles.timeButton, activeTimePicker === 'start' && styles.timeButtonActive]}
                                    onPress={() => {
                                        triggerSelectionHaptic();
                                        setActiveTimePicker(activeTimePicker === 'start' ? null : 'start');
                                    }}
                                >
                                    <Text style={styles.timeLabel}>{t.habit.startTime || "Start"}</Text>
                                    <Text style={styles.timeValue}>{startTime}</Text>
                                </Pressable>
                                <View style={styles.timeArrow}><Ionicons name="arrow-forward" size={16} color={colors.textMuted} /></View>
                                <Pressable
                                    style={[styles.timeButton, activeTimePicker === 'end' && styles.timeButtonActive]}
                                    onPress={() => {
                                        triggerSelectionHaptic();
                                        setActiveTimePicker(activeTimePicker === 'end' ? null : 'end');
                                    }}
                                >
                                    <Text style={styles.timeLabel}>{t.habit.endTime || "End"}</Text>
                                    <Text style={styles.timeValue}>{endTime}</Text>
                                </Pressable>
                            </View>

                            {/* Time Picker Options (WidgetHub Style) */}
                            {activeTimePicker && (
                                <View style={styles.timePickerContainer}>
                                    <Text style={styles.pickerLabel}>{activeTimePicker === 'start' ? 'START TIME' : 'END TIME'}</Text>

                                    <View style={styles.presetsContainer}>
                                        {/* Helper Logic */}
                                        {(() => {
                                            // Get current value to highlight
                                            const currentVal = activeTimePicker === 'start' ? startTime : endTime;
                                            const [curH, curM] = currentVal.split(':').map(Number);

                                            const PRESETS = [
                                                { h: 7, m: 0, label: '7:00 AM' },
                                                { h: 8, m: 0, label: '8:00 AM' },
                                                { h: 9, m: 0, label: '9:00 AM' },
                                                { h: 12, m: 0, label: '12:00 PM' },
                                                { h: 17, m: 0, label: '5:00 PM' },
                                                { h: 18, m: 0, label: '6:00 PM' },
                                                { h: 21, m: 0, label: '9:00 PM' },
                                                { h: 22, m: 0, label: '10:00 PM' },
                                            ];

                                            const currentPresetMatch = PRESETS.some(t => t.h === curH && t.m === curM);
                                            const showCustomInput = customMode || !currentPresetMatch;

                                            return (
                                                <>
                                                    {PRESETS.map((time) => {
                                                        const isSelected = !customMode && curH === time.h && curM === time.m;
                                                        return (
                                                            <Pressable
                                                                key={`${time.h}:${time.m}`}
                                                                style={({ pressed }) => [
                                                                    styles.presetButton,
                                                                    isSelected && styles.presetButtonActive,
                                                                    pressed && { opacity: 0.7 }
                                                                ]}
                                                                onPress={() => {
                                                                    triggerSelectionHaptic();
                                                                    setCustomMode(false);
                                                                    const newTime = `${time.h.toString().padStart(2, '0')}:${time.m.toString().padStart(2, '0')}`;
                                                                    if (activeTimePicker === 'start') setStartTime(newTime);
                                                                    else setEndTime(newTime);
                                                                }}
                                                            >
                                                                <Text style={[styles.presetText, isSelected && styles.presetTextActive]}>
                                                                    {time.label}
                                                                </Text>
                                                            </Pressable>
                                                        );
                                                    })}

                                                    {/* Custom Button */}
                                                    <Pressable
                                                        style={({ pressed }) => [
                                                            styles.presetButton,
                                                            showCustomInput && styles.presetButtonActive,
                                                            pressed && { opacity: 0.7 }
                                                        ]}
                                                        onPress={() => {
                                                            triggerSelectionHaptic();
                                                            setCustomMode(true);
                                                            // Init local input with current value
                                                            setLocalHour(curH.toString().padStart(2, '0'));
                                                            setLocalMinute(curM.toString().padStart(2, '0'));
                                                        }}
                                                    >
                                                        <Text style={[styles.presetText, showCustomInput && styles.presetTextActive]}>
                                                            CUSTOM
                                                        </Text>
                                                    </Pressable>
                                                </>
                                            );
                                        })()}
                                    </View>

                                    {/* Manual Time Input */}
                                    {customMode && (
                                        <View style={styles.customInputContainer}>
                                            <Text style={styles.customLabel}>CUSTOM TIME (24H)</Text>
                                            <View style={styles.customInputRow}>
                                                <TextInput
                                                    style={styles.timeInput}
                                                    value={localHour}
                                                    onChangeText={setLocalHour}
                                                    keyboardType="number-pad"
                                                    maxLength={2}
                                                    placeholder="HH"
                                                    placeholderTextColor={colors.textMuted}
                                                />
                                                <Text style={styles.timeSeparator}>:</Text>
                                                <TextInput
                                                    style={styles.timeInput}
                                                    value={localMinute}
                                                    onChangeText={setLocalMinute}
                                                    keyboardType="number-pad"
                                                    maxLength={2}
                                                    placeholder="MM"
                                                    placeholderTextColor={colors.textMuted}
                                                />
                                                <Pressable
                                                    style={styles.setButton}
                                                    onPress={() => {
                                                        triggerSelectionHaptic();
                                                        const h = parseInt(localHour, 10) || 0;
                                                        const m = parseInt(localMinute, 10) || 0;
                                                        const hStr = Math.min(23, Math.max(0, h)).toString().padStart(2, '0');
                                                        const mStr = Math.min(59, Math.max(0, m)).toString().padStart(2, '0');
                                                        const newTime = `${hStr}:${mStr}`;

                                                        if (activeTimePicker === 'start') setStartTime(newTime);
                                                        else setEndTime(newTime);
                                                    }}
                                                >
                                                    <Text style={styles.setButtonText}>SET</Text>
                                                </Pressable>
                                            </View>
                                        </View>
                                    )}
                                </View>
                            )}

                            <View style={styles.reminderRow}>
                                <View>
                                    <Text style={styles.reminderLabel}>{t.habit.reminder || "Remind me 15m before"}</Text>
                                    <Text style={styles.reminderSubLabel}>{t.habit.reminderDesc || "Notification"}</Text>
                                </View>
                                <Switch
                                    value={reminderEnabled}
                                    onValueChange={(v) => {
                                        triggerSelectionHaptic();
                                        setReminderEnabled(v);
                                    }}
                                    trackColor={{ false: colors.bgCard, true: activeThemeColor }}
                                    thumbColor={'#fff'}
                                />
                            </View>
                        </View>
                    )}
                </Animated.View>

                {/* Icon Picker */}
                <Animated.View
                    entering={FadeInDown.delay(650)}
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
                    entering={FadeInDown.delay(700)}
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

                {/* Frequency */}
                <Animated.View
                    entering={FadeInDown.delay(725)}
                    style={styles.section}
                >
                    <Text style={styles.sectionTitle}>{t.habit.frequency}</Text>
                    <View style={styles.frequencyContainer}>
                        <ChoiceButton
                            active={frequency === 'daily'}
                            style={styles.frequencyButton}
                            activeColor={activeThemeColor}
                            onPress={() => {
                                triggerSelectionHaptic();
                                setFrequency('daily');
                            }}
                        >
                            {frequency === 'daily' ? (
                                <LinearGradient
                                    colors={[...colors.habitColors[selectedColor]]}
                                    style={styles.frequencyGradient}
                                >
                                    <Text style={styles.frequencyTextActive}>{t.habit.daily}</Text>
                                </LinearGradient>
                            ) : (
                                <Text style={styles.frequencyText}>{t.habit.daily}</Text>
                            )}
                        </ChoiceButton>

                        <ChoiceButton
                            active={frequency === 'weekly'}
                            style={styles.frequencyButton}
                            activeColor={activeThemeColor}
                            onPress={() => {
                                triggerSelectionHaptic();
                                setFrequency('weekly');
                            }}
                        >
                            {frequency === 'weekly' ? (
                                <LinearGradient
                                    colors={[...colors.habitColors[selectedColor]]}
                                    style={styles.frequencyGradient}
                                >
                                    <Text style={styles.frequencyTextActive}>{t.habit.weekly}</Text>
                                </LinearGradient>
                            ) : (
                                <Text style={styles.frequencyText}>{t.habit.weekly}</Text>
                            )}
                        </ChoiceButton>
                    </View>
                </Animated.View>

                {/* Daily/Weekly Target */}
                <Animated.View
                    entering={FadeInDown.delay(750)}
                    style={styles.section}
                >
                    <Text style={styles.sectionTitle}>{frequency === 'daily' ? t.habit.dailyTarget : t.habit.weeklyTarget}</Text>
                    <View style={styles.inputContainer}>
                        <TextInput
                            style={styles.input}
                            placeholder="1"
                            placeholderTextColor={colors.textMuted}
                            value={dailyTarget}
                            onChangeText={(val) => setDailyTarget(val.replace(/[^0-9]/g, ''))}
                            keyboardType="number-pad"
                            maxLength={3}
                        />
                    </View>
                </Animated.View>

                {/* Danger Zone */}
                <Animated.View
                    entering={FadeInDown.delay(800)}
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
    sectionHeaderTimeSlot: { // Specific header for time slot to allow switch
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
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
        textAlign: 'center',
        padding: 0,
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
    frequencyContainer: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    frequencyButton: {
        flex: 1,
        height: 48,
        borderRadius: borderRadius.md,
        overflow: 'hidden',
        backgroundColor: colors.glass,
        borderWidth: 1,
        borderColor: colors.glassBorder,
        justifyContent: 'center',
        alignItems: 'center',
    },
    frequencyGradient: {
        flex: 1,
        width: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    frequencyText: {
        ...typography.bodyBold,
        color: colors.textSecondary,
    },
    frequencyTextActive: {
        ...typography.bodyBold,
        color: colors.textPrimary,
    },
    deleteButtonText: {
        ...typography.bodyBold,
        color: colors.dangerStart,
    },
    // Time Slot Styles
    timeSlotContainer: {
        marginTop: spacing.sm,
        backgroundColor: colors.glass,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: colors.glassBorder,
    },
    timeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.md,
    },
    timeButton: {
        flex: 1,
        backgroundColor: colors.bgCard,
        padding: spacing.sm,
        borderRadius: borderRadius.sm,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'transparent',
    },
    timeButtonActive: {
        borderColor: colors.primaryStart,
        backgroundColor: colors.primaryStart + '10',
    },
    timeLabel: {
        ...typography.caption,
        color: colors.textMuted,
        marginBottom: 2,
    },
    timeValue: {
        ...typography.h3,
        color: colors.textPrimary,
    },
    timeArrow: {
        paddingHorizontal: spacing.sm,
    },
    timePickerContainer: {
        backgroundColor: colors.bgDark,
        borderRadius: borderRadius.sm,
        padding: spacing.sm,
        marginBottom: spacing.md,
    },
    pickerLabel: {
        ...typography.small,
        color: colors.textMuted,
        marginBottom: spacing.sm,
        fontWeight: 'bold',
    },
    presetsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.xs,
    },
    presetButton: {
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.sm,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: borderRadius.sm,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    presetButtonActive: {
        backgroundColor: colors.primaryStart,
        borderColor: colors.primaryStart,
    },
    presetText: {
        ...typography.small,
        color: colors.textSecondary,
    },
    presetTextActive: {
        color: '#fff',
        fontWeight: '700',
    },
    customInputContainer: {
        marginTop: spacing.md,
    },
    customLabel: {
        ...typography.small,
        color: colors.textMuted,
        marginBottom: spacing.xs,
    },
    customInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    timeInput: {
        width: 60,
        height: 44,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: borderRadius.sm,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        color: colors.textPrimary,
        textAlign: 'center',
        fontSize: 18,
        fontWeight: '700',
    },
    timeSeparator: {
        color: colors.textPrimary,
        fontSize: 24,
        fontWeight: '700',
    },
    setButton: {
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.md,
        backgroundColor: colors.primaryStart,
        borderRadius: borderRadius.sm,
        height: 44,
        justifyContent: 'center',
    },
    setButtonText: {
        color: '#fff',
        fontWeight: '700',
    },
    reminderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: spacing.xs,
        paddingTop: spacing.sm,
        borderTopWidth: 1,
        borderTopColor: colors.glassBorder,
    },
    reminderLabel: {
        ...typography.bodyBold,
        color: colors.textPrimary,
    },
    reminderSubLabel: {
        ...typography.caption,
        color: colors.textMuted,
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
