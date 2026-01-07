import React, { useState, useMemo } from 'react';
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
import Animated, {
    FadeInDown,
    useAnimatedStyle,
    withSpring,
    useSharedValue,
    Layout,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { triggerSelectionHaptic, triggerNotificationHaptic, FeedbackType } from '../utils/feedback';
import { useHabits } from '../context/HabitContext';
import { useI18n } from '../context/I18nContext';
import { useTheme } from '../context/ThemeContext';
import { spacing, borderRadius, typography, habitIcons } from '../theme';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function AddHabitScreen({ navigation }: { navigation: NativeStackNavigationProp<any> }) {
    const { addHabit } = useHabits();
    const { t } = useI18n();
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const styles = useMemo(() => getStyles(colors, insets), [colors, insets]);

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [selectedIcon, setSelectedIcon] = useState('💪');
    const [selectedColor, setSelectedColor] = useState(0);
    const [frequency, setFrequency] = useState<'daily' | 'weekly'>('daily');
    const [dailyTarget, setDailyTarget] = useState('1');

    const activeThemeColor = colors.habitColors[selectedColor]?.[0] || colors.primaryStart;

    const buttonScale = useSharedValue(1);

    const handleSave = async () => {
        if (!name.trim()) {
            triggerNotificationHaptic(FeedbackType.Error);
            return;
        }

        triggerNotificationHaptic(FeedbackType.Success);

        await addHabit({
            name: name.trim(),
            description: description.trim(),
            icon: selectedIcon,
            colorIndex: selectedColor,
            frequency,
            dailyTarget: parseInt(dailyTarget) || 1,
            goal: 0, // Placeholder for total goal
        });

        navigation.goBack();
    };

    const handlePressIn = () => {
        buttonScale.value = withSpring(0.95, { damping: 15, stiffness: 300 });
    };

    const handlePressOut = () => {
        buttonScale.value = withSpring(1, { damping: 15, stiffness: 300 });
    };

    const buttonStyle = useAnimatedStyle(() => ({
        transform: [{ scale: buttonScale.value }],
    }));

    // For icon/color pop animation
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

        // Use Intl.Segmenter if available (modern Hermes)
        if (typeof Intl !== 'undefined' && (Intl as any).Segmenter) {
            try {
                const segmenter = new (Intl as any).Segmenter('en', { granularity: 'grapheme' });
                const segments = Array.from(segmenter.segment(text));
                if (segments.length > 0) {
                    return (segments[segments.length - 1] as any).segment;
                }
            } catch (e) { }
        }

        // Fallback: Smart splitting for complex symbols like VS16 (❤️)
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


                <View style={styles.header}>
                    <View style={styles.headerMain}>
                        <Pressable
                            onPress={() => navigation.navigate('Home')}
                            style={styles.backButton}
                            hitSlop={20}
                        >
                            <Ionicons name="chevron-back" size={28} color={colors.textPrimary} />
                        </Pressable>
                        <View style={styles.headerTitles}>
                            <Text style={styles.title}>{t.nav.addHabit}</Text>
                            <Text style={styles.subtitle}>{t.home.startBuilding}</Text>
                        </View>
                    </View>
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
                    entering={FadeInDown.delay(300)}
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

                    {/* New Distinct Custom Icon Input Container */}
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
                    entering={FadeInDown.delay(400)}
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
                                hitSlop={8}
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
                    entering={FadeInDown.delay(500)}
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

                {/* Daily Target */}
                <Animated.View
                    entering={FadeInDown.delay(550)}
                    style={styles.section}
                >
                    <Text style={styles.sectionTitle}>{t.habit.dailyTarget}</Text>
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

                {/* Preview Card */}
                <Animated.View
                    entering={FadeInDown.delay(600)}
                    style={styles.section}
                >
                    <Text style={styles.sectionTitle}>{t.stats.preview}</Text>
                    <Animated.View layout={Layout.springify()} style={styles.previewCard}>
                        <View style={styles.previewIcon}>
                            <LinearGradient
                                colors={[...colors.habitColors[selectedColor]]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.previewIconGradient}
                            >
                                <Text style={styles.previewIconText}>{selectedIcon}</Text>
                            </LinearGradient>
                        </View>
                        <View style={styles.previewInfo}>
                            <Text style={styles.previewName}>
                                {name || t.stats.yourNewHabit}
                            </Text>
                            {description ? (
                                <Text style={styles.previewDescription} numberOfLines={1}>
                                    {description}
                                </Text>
                            ) : null}
                            <Text style={styles.previewFrequency}>
                                {frequency === 'daily' ? t.stats.everyDay : t.habit.weekly} • {t.stats.target}: {dailyTarget || '1'}
                            </Text>
                        </View>
                    </Animated.View>
                </Animated.View>

                {/* Bottom spacing */}
                <View style={{ height: 120 }} />
            </ScrollView>

            {/* Save Button */}
            <View style={styles.buttonContainer}>
                <AnimatedPressable
                    style={[styles.saveButton, buttonStyle]}
                    onPress={handleSave}
                    onPressIn={handlePressIn}
                    onPressOut={handlePressOut}
                    disabled={!name.trim()}
                >
                    <LinearGradient
                        colors={name.trim() ? [...colors.success] : ['#444', '#333']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.saveButtonGradient}
                    >
                        <Text style={styles.saveButtonText}>{t.habit.createHabit}</Text>
                    </LinearGradient>
                </AnimatedPressable>
            </View>
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
        width: 40,
        height: 4,
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
    previewCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        backgroundColor: colors.glass,
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: colors.glassBorder,
    },
    previewIcon: {
        width: 50,
        height: 50,
        borderRadius: borderRadius.md,
        overflow: 'hidden',
    },
    previewIconGradient: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    previewIconText: {
        fontSize: 24,
    },
    previewInfo: {
        marginLeft: spacing.md,
        flex: 1,
    },
    previewName: {
        ...typography.bodyBold,
        color: colors.textPrimary,
        fontSize: 18,
    },
    previewFrequency: {
        ...typography.caption,
        color: colors.textSecondary,
        marginTop: 2,
    },
    previewDescription: {
        ...typography.caption,
        color: colors.textMuted,
        fontSize: 12,
        marginTop: 1,
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
                shadowColor: colors.successStart,
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
