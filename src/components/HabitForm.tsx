import React, { useMemo, useState } from 'react';
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
import Animated, {
    FadeInDown,
    useAnimatedStyle,
    withSpring,
    useSharedValue,
    Layout,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets, EdgeInsets } from 'react-native-safe-area-context';
import { triggerSelectionHaptic, triggerNotificationHaptic, FeedbackType } from '../utils/feedback';
import { useI18n } from '../context/I18nContext';
import { useTheme, ThemeColors } from '../context/ThemeContext';
import { spacing, borderRadius, typography, habitIcons, pickTextOn } from '../theme';
import { getLastGrapheme } from '../utils/text';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const TIME_PRESETS = [
    { h: 7, m: 0, label: '7:00 AM' },
    { h: 8, m: 0, label: '8:00 AM' },
    { h: 9, m: 0, label: '9:00 AM' },
    { h: 12, m: 0, label: '12:00 PM' },
    { h: 17, m: 0, label: '5:00 PM' },
    { h: 18, m: 0, label: '6:00 PM' },
    { h: 21, m: 0, label: '9:00 PM' },
    { h: 22, m: 0, label: '10:00 PM' },
];

export interface HabitFormTimeSlot {
    start: string;
    end: string;
    reminder: boolean;
}

export interface HabitFormValues {
    name: string;
    description: string;
    icon: string;
    colorIndex: number;
    frequency: 'daily' | 'weekly';
    dailyTarget: number;
    timeSlot?: HabitFormTimeSlot;
}

/** Live form state exposed to the optional `renderAboveFields` slot. */
export interface HabitFormLiveState {
    selectedColor: number;
    selectedIcon: string;
    frequency: 'daily' | 'weekly';
}

interface HabitFormProps {
    title: string;
    subtitle?: string;
    submitLabel: string;
    submitVariant: 'create' | 'save';
    onBack: () => void;
    onSubmit: (values: HabitFormValues) => void | Promise<void>;
    initialValues?: Partial<HabitFormValues>;
    /** Default colour index used when no initial colour is provided (e.g. auto-cycle on Add). */
    defaultColorIndex?: number;
    /** Extra content under the title (e.g. streak badge + completion count on Edit). */
    headerExtra?: React.ReactNode;
    /** Rendered between the header and the Name field (e.g. the month calendar on Edit). */
    renderAboveFields?: (state: HabitFormLiveState) => React.ReactNode;
    /** Rendered after the Target field (e.g. the danger zone / delete button on Edit). */
    belowFields?: React.ReactNode;
}

/**
 * Shared habit add/edit form. Owns all of the common form state and UI
 * (name, description, time slot, icon/colour/frequency pickers, target,
 * live preview, save button). Screen-specific chrome — the month calendar,
 * danger zone, header stats — is injected via the slot props.
 */
export default function HabitForm({
    title,
    subtitle,
    submitLabel,
    submitVariant,
    onBack,
    onSubmit,
    initialValues,
    defaultColorIndex = 0,
    headerExtra,
    renderAboveFields,
    belowFields,
}: HabitFormProps) {
    const { t } = useI18n();
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const styles = useMemo(() => getStyles(colors, insets), [colors, insets]);

    const [name, setName] = useState(initialValues?.name ?? '');
    const [description, setDescription] = useState(initialValues?.description ?? '');
    const [selectedIcon, setSelectedIcon] = useState(initialValues?.icon ?? '💪');
    const [selectedColor, setSelectedColor] = useState(initialValues?.colorIndex ?? defaultColorIndex);
    const [frequency, setFrequency] = useState<'daily' | 'weekly'>(initialValues?.frequency ?? 'daily');
    const [dailyTarget, setDailyTarget] = useState((initialValues?.dailyTarget ?? 1).toString());

    // Time Slot State
    const [hasTimeSlot, setHasTimeSlot] = useState(!!initialValues?.timeSlot);
    const [startTime, setStartTime] = useState(initialValues?.timeSlot?.start ?? '09:00');
    const [endTime, setEndTime] = useState(initialValues?.timeSlot?.end ?? '17:00');
    const [reminderEnabled, setReminderEnabled] = useState(initialValues?.timeSlot?.reminder ?? false);
    const [activeTimePicker, setActiveTimePicker] = useState<'start' | 'end' | null>(null);

    // Custom Time Picker State (for active picker)
    const [customMode, setCustomMode] = useState(false);
    const [localHour, setLocalHour] = useState('');
    const [localMinute, setLocalMinute] = useState('');

    const activeThemeColor = colors.habitColors[selectedColor]?.[0] || colors.primaryStart;
    const isCustomIcon = !habitIcons.includes(selectedIcon as any);
    const isValid = !!name.trim();

    const buttonScale = useSharedValue(1);
    const buttonStyle = useAnimatedStyle(() => ({
        transform: [{ scale: buttonScale.value }],
    }));

    const handleSave = async () => {
        if (!isValid) {
            triggerNotificationHaptic(FeedbackType.Error);
            return;
        }
        triggerNotificationHaptic(FeedbackType.Success);
        await onSubmit({
            name: name.trim(),
            description: description.trim(),
            icon: selectedIcon,
            colorIndex: selectedColor,
            frequency,
            dailyTarget: parseInt(dailyTarget, 10) || 1,
            timeSlot: hasTimeSlot ? { start: startTime, end: endTime, reminder: reminderEnabled } : undefined,
        });
    };

    // For icon/color pop animation
    const ChoiceButton = ({ onPress, active, children, style, activeColor }: any) => {
        const scale = useSharedValue(1);
        const choiceStyle = useAnimatedStyle(() => ({
            transform: [{ scale: scale.value }],
        }));
        return (
            <AnimatedPressable
                onPress={onPress}
                onPressIn={() => { scale.value = withSpring(0.92, { stiffness: 400, damping: 10 }); }}
                onPressOut={() => { scale.value = withSpring(1, { stiffness: 400, damping: 10 }); }}
                style={[
                    style,
                    choiceStyle,
                    active && styles.activeChoice,
                    active && activeColor && {
                        borderColor: activeColor,
                        borderWidth: 2,
                        backgroundColor: activeColor + '25',
                    },
                ]}
            >
                {children}
            </AnimatedPressable>
        );
    };

    const setActiveTime = (value: string) => {
        if (activeTimePicker === 'start') setStartTime(value);
        else setEndTime(value);
    };

    const saveGradient = (isValid
        ? (submitVariant === 'create' ? [...colors.success] : [...colors.primary])
        : (submitVariant === 'create' ? [colors.glass, colors.glass] : ['#444', '#333'])) as [string, string];

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
                        <Pressable onPress={onBack} style={styles.backButton} hitSlop={20}>
                            <Ionicons name="chevron-back" size={28} color={colors.textPrimary} />
                        </Pressable>
                        <View style={styles.headerTitles}>
                            <Text style={styles.title}>{title}</Text>
                            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
                            {headerExtra}
                        </View>
                    </View>
                </View>

                {renderAboveFields?.({ selectedColor, selectedIcon, frequency })}

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
                <Animated.View entering={FadeInDown.delay(250)} style={styles.section}>
                    <View style={styles.sectionHeaderTimeSlot}>
                        <Text style={styles.sectionTitle}>{t.habit.timeSlot || 'Time Slot'}</Text>
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
                        <Animated.View entering={FadeInDown} layout={Layout.springify()} style={styles.timeSlotContainer}>
                            {/* Start/End Time Buttons */}
                            <View style={styles.timeRow}>
                                <Pressable
                                    style={[styles.timeButton, activeTimePicker === 'start' && styles.timeButtonActive]}
                                    onPress={() => {
                                        triggerSelectionHaptic();
                                        setActiveTimePicker(activeTimePicker === 'start' ? null : 'start');
                                        setCustomMode(false);
                                    }}
                                >
                                    <Text style={styles.timeLabel}>{t.habit.startTime || 'Start'}</Text>
                                    <Text style={styles.timeValue}>{startTime}</Text>
                                </Pressable>

                                <View style={styles.timeArrow}>
                                    <Ionicons name="arrow-forward" size={20} color={colors.textMuted} />
                                </View>

                                <Pressable
                                    style={[styles.timeButton, activeTimePicker === 'end' && styles.timeButtonActive]}
                                    onPress={() => {
                                        triggerSelectionHaptic();
                                        setActiveTimePicker(activeTimePicker === 'end' ? null : 'end');
                                        setCustomMode(false);
                                    }}
                                >
                                    <Text style={styles.timeLabel}>{t.habit.endTime || 'End'}</Text>
                                    <Text style={styles.timeValue}>{endTime}</Text>
                                </Pressable>
                            </View>

                            {/* Time Picker Options */}
                            {activeTimePicker && (
                                <View style={styles.timePickerContainer}>
                                    <Text style={styles.pickerLabel}>{activeTimePicker === 'start' ? 'START TIME' : 'END TIME'}</Text>

                                    <View style={styles.presetsContainer}>
                                        {(() => {
                                            const currentVal = activeTimePicker === 'start' ? startTime : endTime;
                                            const [curH, curM] = currentVal.split(':').map(Number);
                                            const currentPresetMatch = TIME_PRESETS.some(p => p.h === curH && p.m === curM);
                                            const showCustomInput = customMode || !currentPresetMatch;

                                            return (
                                                <>
                                                    {TIME_PRESETS.map((time) => {
                                                        const isSelected = !customMode && curH === time.h && curM === time.m;
                                                        return (
                                                            <Pressable
                                                                key={`${time.h}:${time.m}`}
                                                                style={({ pressed }) => [
                                                                    styles.presetButton,
                                                                    isSelected && styles.presetButtonActive,
                                                                    pressed && { opacity: 0.7 },
                                                                ]}
                                                                onPress={() => {
                                                                    triggerSelectionHaptic();
                                                                    setCustomMode(false);
                                                                    setActiveTime(`${time.h.toString().padStart(2, '0')}:${time.m.toString().padStart(2, '0')}`);
                                                                }}
                                                            >
                                                                <Text style={[styles.presetText, isSelected && styles.presetTextActive]}>
                                                                    {time.label}
                                                                </Text>
                                                            </Pressable>
                                                        );
                                                    })}

                                                    <Pressable
                                                        style={({ pressed }) => [
                                                            styles.presetButton,
                                                            showCustomInput && styles.presetButtonActive,
                                                            pressed && { opacity: 0.7 },
                                                        ]}
                                                        onPress={() => {
                                                            triggerSelectionHaptic();
                                                            setCustomMode(true);
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
                                                        const h = Math.min(23, Math.max(0, parseInt(localHour, 10) || 0));
                                                        const m = Math.min(59, Math.max(0, parseInt(localMinute, 10) || 0));
                                                        setActiveTime(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
                                                    }}
                                                >
                                                    <Text style={styles.setButtonText}>SET</Text>
                                                </Pressable>
                                            </View>
                                        </View>
                                    )}
                                </View>
                            )}

                            {/* Reminder Switch */}
                            <View style={styles.reminderRow}>
                                <View style={styles.reminderInfo}>
                                    <Text style={styles.reminderTitle}>{t.habit.reminder || 'Reminder'}</Text>
                                    <Text style={styles.reminderDesc}>{t.habit.reminderDesc || 'Get notified 15m before'}</Text>
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
                        </Animated.View>
                    )}
                </Animated.View>

                {/* Icon Picker */}
                <Animated.View entering={FadeInDown.delay(300)} style={styles.section}>
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

                    {/* Custom Icon Input */}
                    <View style={styles.customIconContainer}>
                        <Text style={styles.customIconPrompt}>{t.habit.customIcon}</Text>
                        <View style={[
                            styles.customIconInputBox,
                            isCustomIcon && { borderColor: activeThemeColor, backgroundColor: activeThemeColor + '15' },
                        ]}>
                            <TextInput
                                style={[styles.iconText, styles.customTextInput]}
                                value={isCustomIcon ? selectedIcon : ''}
                                onChangeText={(text) => {
                                    if (text.length > 0) {
                                        setSelectedIcon(getLastGrapheme(text));
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
                <Animated.View entering={FadeInDown.delay(400)} style={styles.section}>
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
                <Animated.View entering={FadeInDown.delay(500)} style={styles.section}>
                    <Text style={styles.sectionTitle}>{t.habit.frequency}</Text>
                    <View style={styles.frequencyContainer}>
                        {(['daily', 'weekly'] as const).map((freq) => (
                            <ChoiceButton
                                key={freq}
                                active={frequency === freq}
                                style={styles.frequencyButton}
                                activeColor={activeThemeColor}
                                onPress={() => {
                                    triggerSelectionHaptic();
                                    setFrequency(freq);
                                }}
                            >
                                {frequency === freq ? (
                                    <LinearGradient colors={[...colors.habitColors[selectedColor]]} style={styles.frequencyGradient}>
                                        <Text style={styles.frequencyTextActive}>{freq === 'daily' ? t.habit.daily : t.habit.weekly}</Text>
                                    </LinearGradient>
                                ) : (
                                    <Text style={styles.frequencyText}>{freq === 'daily' ? t.habit.daily : t.habit.weekly}</Text>
                                )}
                            </ChoiceButton>
                        ))}
                    </View>
                </Animated.View>

                {/* Daily / Weekly Target */}
                <Animated.View entering={FadeInDown.delay(550)} style={styles.section}>
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

                {belowFields}

                {/* Bottom spacing */}
                <View style={{ height: 120 }} />
            </ScrollView>

            {/* Save Button */}
            <View style={styles.buttonContainer}>
                <AnimatedPressable
                    style={[styles.saveButton, buttonStyle]}
                    onPress={handleSave}
                    onPressIn={() => { buttonScale.value = withSpring(0.95, { damping: 15, stiffness: 300 }); }}
                    onPressOut={() => { buttonScale.value = withSpring(1, { damping: 15, stiffness: 300 }); }}
                    disabled={!isValid}
                >
                    <LinearGradient
                        colors={saveGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.saveButtonGradient}
                    >
                        <Text style={[styles.saveButtonText, isValid && { color: pickTextOn(saveGradient[0]) }]}>{submitLabel}</Text>
                    </LinearGradient>
                </AnimatedPressable>
            </View>
        </KeyboardAvoidingView>
    );
}

const getStyles = (colors: ThemeColors, insets: EdgeInsets) => StyleSheet.create({
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
    header: {
        marginBottom: spacing.lg,
    },
    headerMain: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    headerTitles: {
        flex: 1,
    },
    backButton: {
        marginLeft: -spacing.xs,
    },
    title: {
        ...typography.h1,
        color: colors.textPrimary,
    },
    subtitle: {
        ...typography.body,
        color: colors.textSecondary,
        marginTop: spacing.xs,
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
    // Time Slot Styles
    sectionHeaderTimeSlot: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.sm,
    },
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
        color: pickTextOn(colors.primaryStart),
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
        color: pickTextOn(colors.primaryStart),
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
    reminderInfo: {
        flex: 1,
        paddingRight: spacing.sm,
    },
    reminderTitle: {
        ...typography.bodyBold,
        color: colors.textPrimary,
    },
    reminderDesc: {
        ...typography.caption,
        color: colors.textMuted,
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
        color: colors.textSecondary,
        fontSize: 18,
    },
});
