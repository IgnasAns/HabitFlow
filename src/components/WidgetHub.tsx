import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, TouchableOpacity, ScrollView, Alert, Share, Switch, Platform, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { EdgeInsets } from 'react-native-safe-area-context';
import { spacing, borderRadius, typography, pickTextOn } from '../theme';
import { useTheme, ThemeColors } from '../context/ThemeContext';
import { useHabits } from '../context/HabitContext';
import { useI18n, interpolate } from '../context/I18nContext';
import { SupportedLanguage } from '../i18n';
import { LinearGradient } from 'expo-linear-gradient';
import { getTodayKey } from '../utils/storage';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { scheduleDailyReminder, cancelReminders, registerForPushNotificationsAsync, scheduleTestNotification, NotificationTranslations } from '../utils/notifications';
import { triggerHaptic, triggerSelectionHaptic, triggerNotificationHaptic, updateFeedbackSettings, FeedbackType, ImpactStyle } from '../utils/feedback';

import StyledModal from './StyledModal';
import ConfirmationModal from './ConfirmationModal';
import ConfettiOverlay from './ConfettiOverlay';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';

// Note: LayoutAnimation is a no-op under the New Architecture (Fabric), so we
// no longer call setLayoutAnimationEnabledExperimental (it only logs a warning).

type WidgetHubProps = NativeStackScreenProps<RootStackParamList, 'WidgetHub'>;

export default function WidgetHub({ navigation }: WidgetHubProps) {
    const { habits, userStats, levelInfo, lastAction, clearLastAction, resetApp, importData, updateHabit, listBackups, restoreBackup } = useHabits();
    const { t, language, setLanguage, languageNames, languageFlags, supportedLanguages } = useI18n();
    const { colors, toggleTheme, theme, colorMode, toggleColorMode } = useTheme();
    const todayKey = getTodayKey();
    const insets = useSafeAreaInsets();
    // Reminders default OFF until the user enables them (nothing is scheduled
    // on a fresh install, so the switch must not claim otherwise).
    const [smartReminders, setSmartReminders] = useState(false);
    const [reminderHour, setReminderHour] = useState(20); // Default 8 PM
    const [reminderMinute, setReminderMinute] = useState(0);
    const [hapticsEnabled, setHapticsEnabled] = useState(true);
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [showTimePicker, setShowTimePicker] = useState(false);

    // Local state for time inputs to prevent cursor jumping
    const [localHour, setLocalHour] = useState('20');
    const [localMinute, setLocalMinute] = useState('00');
    const [customMode, setCustomMode] = useState(false);



    // Load settings
    useEffect(() => {
        const loadSettings = async () => {
            try {
                const storedSettings = await AsyncStorage.getItem('app_settings');
                if (storedSettings) {
                    const parsed = JSON.parse(storedSettings);
                    setSmartReminders(parsed.smartReminders ?? false);
                    setReminderHour(parsed.reminderHour ?? 20);
                    setReminderMinute(parsed.reminderMinute ?? 0);
                    setHapticsEnabled(parsed.hapticsEnabled ?? true);
                    setSoundEnabled(parsed.soundEnabled ?? true);
                }
            } catch (e) {
                // error loading
            }
        };
        loadSettings();
    }, []);

    // Sync local state when picker opens - REMOVED to prevent race conditions
    // Syncing is now done imperatively in the toggle handler

    const saveSettings = async (updates: any) => {
        try {
            const currentMatrix = { smartReminders, reminderHour, reminderMinute, hapticsEnabled, soundEnabled, darkMode: theme === 'dark', colorMode };
            const newSettings = { ...currentMatrix, ...updates };
            await AsyncStorage.setItem('app_settings', JSON.stringify(newSettings));
        } catch (e) {
            // error saving
        }
    };

    const toggleSetting = (key: string) => {
        triggerSelectionHaptic();
        switch (key) {
            case 'smartReminders':
                setSmartReminders(!smartReminders);
                saveSettings({ smartReminders: !smartReminders });
                if (!smartReminders) {
                    // Enabling
                    registerForPushNotificationsAsync().then(token => {
                        if (token) {
                            scheduleDailyReminder(reminderHour, reminderMinute, t.notifications as NotificationTranslations);
                            const timeStr = `${reminderHour.toString().padStart(2, '0')}:${reminderMinute.toString().padStart(2, '0')}`;
                            showInfo(t.settings.remindersSet, `You'll be reminded daily at ${timeStr} to check your habits.`, "✅");
                        } else {
                            // Permission denied or error
                            setSmartReminders(false); // Revert switch if failed
                            saveSettings({ smartReminders: false });
                            showInfo(t.settings.permissionRequired, t.settings.permissionMessage, "🚫");
                        }
                    });
                } else {
                    // Disabling
                    cancelReminders();
                }
                break;
            case 'haptics':
                const newHaptics = !hapticsEnabled;
                setHapticsEnabled(newHaptics);
                saveSettings({ hapticsEnabled: newHaptics });
                updateFeedbackSettings(newHaptics, soundEnabled);
                break;
            case 'sound':
                const newSound = !soundEnabled;
                setSoundEnabled(newSound);
                saveSettings({ soundEnabled: newSound });
                updateFeedbackSettings(hapticsEnabled, newSound);
                break;
            case 'auth':
                // setAuthEnabled(!authEnabled);
                break;
            case 'theme':
                toggleTheme();
                saveSettings({ darkMode: theme !== 'dark' });
                break;
            case 'colorMode':
                toggleColorMode();
                saveSettings({ colorMode: colorMode === 'vivid' ? 'pastel' : 'vivid' });
                break;
        }
    };

    // Update reminder time
    const updateReminderTime = useCallback((hour: number, minute: number) => {
        setReminderHour(hour);
        setReminderMinute(minute);
        // Do NOT sync local state here to avoid race conditions while typing
        saveSettings({ reminderHour: hour, reminderMinute: minute });

        // Reschedule notification with new time if reminders are enabled
        if (smartReminders) {
            scheduleDailyReminder(hour, minute, t.notifications as NotificationTranslations);
            const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
            showInfo(t.settings.remindersSet, `Reminder updated to ${timeStr}`, "🔔");
        }
        setShowTimePicker(false);
    }, [smartReminders, t]);

    const handleImport = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: 'application/json',
                copyToCacheDirectory: true
            });

            if (result.canceled) return;

            const file = result.assets[0];
            const fileContent = await FileSystem.readAsStringAsync(file.uri);

            try {
                const parsedData = JSON.parse(fileContent);
                const success = await importData(parsedData);

                if (success) {
                    triggerNotificationHaptic(FeedbackType.Success);
                    showInfo(t.settings.importSuccess, t.settings.importSuccessDesc, "💾");
                } else {
                    throw new Error("Invalid data format");
                }
            } catch (e) {
                triggerNotificationHaptic(FeedbackType.Error);
                showInfo(t.settings.importFailed, t.settings.importFailedDesc, "⚠️");
            }
        } catch (error) {
            console.error(error);
            showInfo(t.settings.importFailed, t.settings.importReadError, "📂");
        }
    };

    // Reset Modal state
    const [showResetModal, setShowResetModal] = useState(false);
    // Management Mode state eliminated - Always in management mode for settings

    // Modal state
    const [modalVisible, setModalVisible] = useState(false);
    const [modalContent, setModalContent] = useState({ title: '', message: '', emoji: '' });

    // Test Notification Modal specific state
    const [showTestModal, setShowTestModal] = useState(false);

    // Language picker state
    const [showLanguagePicker, setShowLanguagePicker] = useState(false);

    // Auto-backup restore state
    const [pendingRestore, setPendingRestore] = useState<import('../utils/storage').BackupSnapshot | null>(null);

    // Confetti state
    const [showConfetti, setShowConfetti] = useState(false);
    const [confettiType, setConfettiType] = useState<'completion' | 'levelUp' | 'streak'>('completion');

    // Pick a random quote index (changes each time component mounts)
    const quoteIndex = useMemo(() => {
        return Math.floor(Math.random() * 10) + 1; // quote1 to quote10
    }, []);

    // Get translated quote
    const randomQuote = useMemo(() => {
        const quoteKey = `quote${quoteIndex}` as keyof typeof t.quotes;
        return t.quotes[quoteKey];
    }, [t, quoteIndex]);

    const handleRestoreBackup = async () => {
        triggerSelectionHaptic();
        const backups = await listBackups();
        if (backups.length === 0) {
            showInfo(t.engagement.restoreBackup, t.engagement.noBackups, '🗂️');
            return;
        }
        // Newest snapshot first (createBackupNow keeps them in that order)
        setPendingRestore(backups[0]);
    };

    // Calculate stats
    const activeHabits = habits.filter(h => !h.archived);
    const archivedHabits = habits.filter(h => h.archived);
    const freezeTokens = userStats.freezeTokens ?? 0;
    const completedToday = activeHabits.filter(h => (h.completions[todayKey] || 0) >= h.dailyTarget).length;
    const totalHabits = activeHabits.length;
    const completionRate = totalHabits > 0 ? Math.round((completedToday / totalHabits) * 100) : 0;

    // Consistency Score (Last 30 days)
    const consistencyScore = useMemo(() => {
        if (activeHabits.length === 0) return 0;
        const now = new Date();
        let totalPossible = 0;
        let totalCompleted = 0;

        for (let i = 0; i < 30; i++) {
            const d = new Date();
            d.setDate(now.getDate() - i);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

            activeHabits.forEach(h => {
                // Approximate: Check if habit was created before this date? 
                // For simplicity/performance, assume active habits tracking applies to window
                // Or check createdAt if string comparison works (ISO strings do)
                // Check if habit existed on this date (compare YYYY-MM-DD)
                if (h.createdAt.substring(0, 10) <= key) {
                    totalPossible++;
                    if ((h.completions[key] || 0) >= h.dailyTarget) {
                        totalCompleted++;
                    }
                }
            });
        }

        return totalPossible === 0 ? 0 : Math.round((totalCompleted / totalPossible) * 100);
    }, [activeHabits]);

    const handleExport = async () => {
        try {
            const data = {
                habits,
                userStats,
                exportedAt: new Date().toISOString(),
                appVersion: '2.2.1'
            };
            await Share.share({
                message: JSON.stringify(data, null, 2),
                title: t.settings.exportTitle
            });
        } catch (error) {
            // Ignore
        }
    };

    // Handle last action (show confetti)
    React.useEffect(() => {
        if (lastAction?.type === 'TOGGLE_COMPLETE' && lastAction.xpGained && lastAction.xpGained > 0) {
            // Trigger positive reinforcement for ANY completion
            if (lastAction.leveledUp) {
                setConfettiType('levelUp');
                triggerNotificationHaptic(FeedbackType.Success);
            } else if (lastAction.habit?.streak && lastAction.habit.streak > 0 && lastAction.habit.streak % 7 === 0) {
                setConfettiType('streak');
                setShowConfetti(true);
            }
            clearLastAction();
        }
    }, [lastAction]);

    const showInfo = (title: string, message: string, emoji: string = '✨') => {
        triggerSelectionHaptic();
        setModalContent({ title, message, emoji });
        setModalVisible(true);
    };


    const styles = useMemo(() => getStyles(colors, insets), [colors, insets]);

    const renderHeader = useCallback(() => (
        <View>
            {/* Screen Title */}
            <View style={styles.screenHeader}>
                <View style={styles.headerMain}>
                    <Pressable
                        onPress={() => navigation?.navigate('Home')}
                        style={styles.backButton}
                        hitSlop={20}
                    >
                        <Ionicons name="chevron-back" size={28} color={colors.textPrimary} />
                    </Pressable>
                    <Text style={styles.screenTitle}>{t.settings.title}</Text>
                </View>
            </View>

            {/* Momentum / Stats */}
            <View style={styles.section}>
                <View style={styles.statBig}>
                    <Text style={styles.statBigValue}>{consistencyScore}%</Text>
                    <Text style={styles.statBigLabel}>{t.settings.consistencyScore} ({t.settings.last30Days})</Text>
                </View>

                {/* Streak Saver tokens */}
                <View style={styles.tokenRow}>
                    <Text style={styles.tokenCount}>🧊 ×{freezeTokens}</Text>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.settingLabel}>{t.engagement.streakSavers}</Text>
                        <Text style={styles.settingDesc}>{t.engagement.streakSaversDesc}</Text>
                    </View>
                </View>
            </View>

        </View>
    ), [consistencyScore, freezeTokens, t, styles, navigation, colors]);

    const renderFooter = useCallback(() => (
        <View>
            {/* Level Info (Low Priority) */}
            <View style={{ alignItems: 'center', marginBottom: spacing.xl }}>
                <Text style={{ ...typography.caption, color: colors.textMuted }}>
                    {interpolate(t.settings.level, { level: levelInfo.level })} • {userStats.totalXp} XP
                </Text>
            </View>

            {/* App Settings */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t.settings.appExperience}</Text>

                <View style={styles.settingRow}>
                    <View style={styles.settingInfo}>
                        <Text style={styles.settingLabel}><Text style={{ fontSize: 18 }}>🔔</Text>  {t.settings.smartReminders}</Text>
                        <Text style={styles.settingDesc}>{t.settings.smartRemindersDesc}</Text>
                    </View>
                    <Switch
                        value={smartReminders}
                        onValueChange={() => toggleSetting('smartReminders')}
                        trackColor={{ false: colors.bgCard, true: colors.primaryStart }}
                        thumbColor={'#fff'}
                    />
                </View>

                {smartReminders && (
                    <View style={{ marginBottom: spacing.md }}>
                        {/* Current Time Display */}
                        <Pressable
                            style={[styles.settingRow, { backgroundColor: colors.bgCard, borderRadius: borderRadius.md, padding: spacing.sm, marginBottom: spacing.sm }]}
                            onPress={() => {
                                triggerSelectionHaptic();
                                if (!showTimePicker) {
                                    // Opening: Sync local state immediately and exclusively here
                                    setLocalHour(reminderHour.toString().padStart(2, '0'));
                                    setLocalMinute(reminderMinute.toString().padStart(2, '0'));
                                }
                                setShowTimePicker(!showTimePicker);
                            }}
                        >
                            <View style={styles.settingInfo}>
                                <Text style={styles.settingLabel}><Text style={{ fontSize: 18 }}>⏰</Text>  {t.settings.reminderTime}</Text>
                                <Text style={styles.settingDesc}>{t.settings.reminderTimeDesc}</Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Text style={{ ...typography.bodyBold, color: colors.accentText, fontSize: 18 }}>
                                    {reminderHour.toString().padStart(2, '0')}:{reminderMinute.toString().padStart(2, '0')}
                                </Text>
                                <Ionicons name={showTimePicker ? "chevron-up" : "chevron-down"} size={18} color={colors.textMuted} />
                            </View>
                        </Pressable>

                        {/* Time Picker Options */}
                        {showTimePicker && (
                            <View style={{ backgroundColor: colors.bgCard, borderRadius: borderRadius.md, padding: spacing.sm, marginBottom: spacing.sm }}>
                                <Text style={{ ...typography.small, color: colors.textMuted, marginBottom: spacing.sm }}>QUICK SELECT</Text>

                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                                    {/* Helper Logic */}
                                    {(() => {
                                        const PRESETS = [
                                            { h: 7, m: 0, label: '7:00 AM' },
                                            { h: 8, m: 0, label: '8:00 AM' },
                                            { h: 9, m: 0, label: '9:00 AM' },
                                            { h: 12, m: 0, label: '12:00 PM' },
                                            { h: 18, m: 0, label: '6:00 PM' },
                                            { h: 19, m: 0, label: '7:00 PM' },
                                            { h: 20, m: 0, label: '8:00 PM' },
                                            { h: 21, m: 0, label: '9:00 PM' },
                                        ];

                                        const currentPresetMatch = PRESETS.some(t => t.h === reminderHour && t.m === reminderMinute);
                                        const showCustomInput = customMode || !currentPresetMatch;

                                        return (
                                            <>
                                                {PRESETS.map((time) => {
                                                    const isSelected = !customMode && reminderHour === time.h && reminderMinute === time.m;
                                                    return (
                                                        <Pressable
                                                            key={`${time.h}:${time.m}`}
                                                            style={({ pressed }) => [
                                                                {
                                                                    paddingVertical: spacing.xs,
                                                                    paddingHorizontal: spacing.sm,
                                                                    backgroundColor: isSelected
                                                                        ? colors.primaryStart
                                                                        : 'rgba(255,255,255,0.05)',
                                                                    borderRadius: borderRadius.sm,
                                                                    borderWidth: 1,
                                                                    borderColor: isSelected
                                                                        ? colors.primaryStart
                                                                        : 'rgba(255,255,255,0.1)',
                                                                },
                                                                pressed && { opacity: 0.7 }
                                                            ]}
                                                            onPress={() => {
                                                                triggerHaptic(ImpactStyle.Light);
                                                                setCustomMode(false);
                                                                setLocalHour(time.h.toString().padStart(2, '0'));
                                                                setLocalMinute(time.m.toString().padStart(2, '0'));
                                                                updateReminderTime(time.h, time.m);
                                                            }}
                                                        >
                                                            <Text style={{
                                                                ...typography.small,
                                                                color: isSelected ? pickTextOn(colors.primaryStart) : colors.textSecondary,
                                                                fontWeight: isSelected ? '700' : '400'
                                                            }}>
                                                                {time.label}
                                                            </Text>
                                                        </Pressable>
                                                    );
                                                })}

                                                {/* Custom Button */}
                                                <Pressable
                                                    style={({ pressed }) => [
                                                        {
                                                            paddingVertical: spacing.xs,
                                                            paddingHorizontal: spacing.sm,
                                                            backgroundColor: showCustomInput
                                                                ? colors.primaryStart
                                                                : 'rgba(255,255,255,0.05)',
                                                            borderRadius: borderRadius.sm,
                                                            borderWidth: 1,
                                                            borderColor: showCustomInput
                                                                ? colors.primaryStart
                                                                : 'rgba(255,255,255,0.1)',
                                                        },
                                                        pressed && { opacity: 0.7 }
                                                    ]}
                                                    onPress={() => {
                                                        triggerHaptic(ImpactStyle.Light);
                                                        setCustomMode(true);
                                                        setLocalHour(reminderHour.toString().padStart(2, '0'));
                                                        setLocalMinute(reminderMinute.toString().padStart(2, '0'));
                                                    }}
                                                >
                                                    <Text style={{
                                                        ...typography.small,
                                                        color: showCustomInput ? pickTextOn(colors.primaryStart) : colors.textSecondary,
                                                        fontWeight: showCustomInput ? '700' : '400'
                                                    }}>
                                                        CUSTOM
                                                    </Text>
                                                </Pressable>
                                            </>
                                        );
                                    })()}
                                </View>

                                {/* Manual Time Input */}
                                {(() => {
                                    const PRESETS = [
                                        { h: 7, m: 0 }, { h: 8, m: 0 }, { h: 9, m: 0 }, { h: 12, m: 0 },
                                        { h: 18, m: 0 }, { h: 19, m: 0 }, { h: 20, m: 0 }, { h: 21, m: 0 }
                                    ];
                                    const currentPresetMatch = PRESETS.some(t => t.h === reminderHour && t.m === reminderMinute);
                                    const showCustomInput = customMode || !currentPresetMatch;

                                    if (showCustomInput) {
                                        return (
                                            <View style={{ marginTop: spacing.md }}>
                                                <Text style={{ ...typography.small, color: colors.textMuted, marginBottom: spacing.xs }}>CUSTOM TIME (24H)</Text>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                                                    <TextInput
                                                        style={{
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
                                                        }}
                                                        value={localHour}
                                                        onChangeText={setLocalHour}
                                                        keyboardType="number-pad"
                                                        maxLength={2}
                                                        placeholder="HH"
                                                        placeholderTextColor={colors.textMuted}
                                                    />
                                                    <Text style={{ color: colors.textPrimary, fontSize: 24, fontWeight: '700' }}>:</Text>
                                                    <TextInput
                                                        style={{
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
                                                        }}
                                                        value={localMinute}
                                                        onChangeText={setLocalMinute}
                                                        keyboardType="number-pad"
                                                        maxLength={2}
                                                        placeholder="MM"
                                                        placeholderTextColor={colors.textMuted}
                                                    />
                                                    <Pressable
                                                        style={{
                                                            paddingVertical: spacing.xs,
                                                            paddingHorizontal: spacing.md,
                                                            backgroundColor: colors.primaryStart,
                                                            borderRadius: borderRadius.sm,
                                                        }}
                                                        onPress={() => {
                                                            triggerHaptic(ImpactStyle.Light);
                                                            const h = parseInt(localHour, 10) || 0;
                                                            const m = parseInt(localMinute, 10) || 0;
                                                            updateReminderTime(Math.min(23, Math.max(0, h)), Math.min(59, Math.max(0, m)));
                                                        }}
                                                    >
                                                        <Text style={{ color: pickTextOn(colors.primaryStart), fontWeight: '700' }}>SET</Text>
                                                    </Pressable>
                                                </View>
                                            </View>
                                        );
                                    }
                                    return null;
                                })()}
                            </View>
                        )}

                        {/* Test Notification Button */}
                        <TouchableOpacity
                            style={[styles.exportButton, { paddingVertical: 8, borderColor: colors.glassBorder }]}
                            onPress={async () => {
                                triggerSelectionHaptic();
                                await registerForPushNotificationsAsync();
                                await scheduleTestNotification();
                                setShowTestModal(true);
                            }}
                        >
                            <Text style={[styles.exportButtonText, { fontSize: 12, color: colors.textSecondary }]}>{t.settings.testNotification}</Text>
                        </TouchableOpacity>
                    </View>
                )}

                <View style={styles.settingRow}>
                    <View style={styles.settingInfo}>
                        <Text style={styles.settingLabel}><Text style={{ fontSize: 18 }}>📳</Text>  {t.settings.hapticFeedback}</Text>
                    </View>
                    <Switch
                        value={hapticsEnabled}
                        onValueChange={() => toggleSetting('haptics')}
                        trackColor={{ false: colors.bgCard, true: colors.primaryStart }}
                        thumbColor={'#fff'}
                    />
                </View>

                <View style={styles.settingRow}>
                    <View style={styles.settingInfo}>
                        <Text style={styles.settingLabel}><Text style={{ fontSize: 18 }}>🔊</Text>  {t.settings.soundEffects}</Text>
                    </View>
                    <Switch
                        value={soundEnabled}
                        onValueChange={() => toggleSetting('sound')}
                        trackColor={{ false: colors.bgCard, true: colors.primaryStart }}
                        thumbColor={'#fff'}
                    />
                </View>

                <View style={styles.settingRow}>
                    <View style={styles.settingInfo}>
                        <Text style={styles.settingLabel}><Text style={{ fontSize: 18 }}>🌓</Text>  {t.settings.darkMode}</Text>
                    </View>
                    <Switch
                        value={theme === 'dark'}
                        onValueChange={() => toggleSetting('theme')}
                        trackColor={{ false: colors.bgCard, true: colors.primaryStart }}
                        thumbColor={'#fff'}
                    />
                </View>

                <View style={styles.settingRow}>
                    <View style={styles.settingInfo}>
                        <Text style={styles.settingLabel}><Text style={{ fontSize: 18 }}>🎨</Text>  {t.settings.pastelMode}</Text>
                        <Text style={styles.settingDesc}>{t.settings.pastelModeDesc}</Text>
                    </View>
                    <Switch
                        value={colorMode === 'pastel'}
                        onValueChange={() => toggleSetting('colorMode')}
                        trackColor={{ false: colors.bgCard, true: colors.primaryStart }}
                        thumbColor={'#fff'}
                    />
                </View>
            </View>

            {/* Language Selector */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t.settings.language.toUpperCase()}</Text>
                <View style={styles.languageContainer}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.languageScroll}>
                        {supportedLanguages.map((lang) => (
                            <Pressable
                                key={lang}
                                style={[
                                    styles.languageOption,
                                    language === lang && styles.languageOptionActive,
                                ]}
                                onPress={() => {
                                    triggerHaptic(ImpactStyle.Light);
                                    setLanguage(lang);
                                }}
                            >
                                <Text style={styles.languageFlag}>{languageFlags[lang]}</Text>
                                <Text style={[
                                    styles.languageName,
                                    language === lang && styles.languageNameActive,
                                ]}>
                                    {languageNames[lang]}
                                </Text>
                            </Pressable>
                        ))}
                    </ScrollView>
                </View>
            </View>

            {/* Archived Habits */}
            {archivedHabits.length > 0 && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{t.engagement.archivedHabits.toUpperCase()}</Text>
                    {archivedHabits.map(habit => (
                        <View key={habit.id} style={styles.archivedRow}>
                            <Text style={styles.archivedIcon}>{habit.icon}</Text>
                            <Text style={styles.archivedName} numberOfLines={1}>{habit.name}</Text>
                            <Pressable
                                style={({ pressed }) => [styles.restoreButton, pressed && { opacity: 0.7 }]}
                                onPress={() => {
                                    triggerHaptic(ImpactStyle.Light);
                                    updateHabit(habit.id, { archived: false });
                                }}
                                accessibilityRole="button"
                                accessibilityLabel={`${t.engagement.restore} ${habit.name}`}
                            >
                                <Text style={styles.restoreButtonText}>{t.engagement.restore}</Text>
                            </Pressable>
                        </View>
                    ))}
                </View>
            )}

            {/* Data Export & Reset */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t.settings.dataPrivacy}</Text>

                <TouchableOpacity style={styles.exportButton} onPress={handleExport}>
                    <Text style={styles.exportButtonText}>{t.settings.downloadData}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.exportButton, { marginTop: 10, borderColor: colors.textMuted }]} onPress={handleImport}>
                    <Text style={[styles.exportButtonText, { color: colors.textMuted }]}>{t.settings.importData}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.exportButton, { marginTop: 10, borderColor: colors.textMuted }]} onPress={handleRestoreBackup}>
                    <Text style={[styles.exportButtonText, { color: colors.textMuted }]}>{t.engagement.restoreBackup}</Text>
                    <Text style={[styles.settingDesc, { marginTop: 2 }]}>{t.engagement.restoreBackupDesc}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.resetButton}
                    onPress={() => {
                        triggerNotificationHaptic(FeedbackType.Warning);
                        setShowResetModal(true);
                    }}
                >
                    <Ionicons name="trash-outline" size={18} color={colors.dangerStart} />
                    <Text style={styles.resetButtonText}>{t.stats.resetData}</Text>
                </TouchableOpacity>
            </View>
            <View style={{ height: 80 }} />
        </View>
    ), [randomQuote, t, language, supportedLanguages, languageFlags, languageNames, setLanguage, styles, colors, smartReminders, reminderHour, reminderMinute, showTimePicker, updateReminderTime, hapticsEnabled, soundEnabled, theme, colorMode, customMode, localHour, localMinute, archivedHabits, updateHabit, listBackups]);

    return (
        <GestureHandlerRootView style={styles.container}>
            <ConfettiOverlay
                visible={showConfetti}
                type={confettiType}
                onComplete={() => setShowConfetti(false)}
            />

            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {/* Header stats section */}
                {renderHeader()}

                {/* Footer with settings */}
                {renderFooter()}
            </ScrollView>

            <StyledModal
                visible={modalVisible}
                title={modalContent.title}
                message={modalContent.message}
                emoji={modalContent.emoji}
                onClose={() => setModalVisible(false)}
            />

            <StyledModal
                visible={showTestModal}
                title={t.settings.testSent}
                message={t.settings.notificationScheduled}
                emoji="🔔"
                onClose={() => setShowTestModal(false)}
                buttonText={t.common.okay}
            />

            <ConfirmationModal
                visible={!!pendingRestore}
                title={t.engagement.restoreConfirmTitle}
                message={interpolate(t.engagement.restoreConfirmMessage, {
                    date: pendingRestore ? new Date(pendingRestore.savedAt).toLocaleDateString() : '',
                })}
                confirmLabel={t.engagement.restore}
                cancelLabel={t.common.cancel}
                type="danger"
                onConfirm={async () => {
                    const snapshot = pendingRestore;
                    setPendingRestore(null);
                    if (!snapshot) return;
                    const ok = await restoreBackup(snapshot);
                    if (ok) {
                        triggerNotificationHaptic(FeedbackType.Success);
                        showInfo(
                            t.engagement.backupRestored,
                            interpolate(t.engagement.backupRestoredDesc, {
                                date: new Date(snapshot.savedAt).toLocaleDateString(),
                            }),
                            '🗂️'
                        );
                    } else {
                        triggerNotificationHaptic(FeedbackType.Error);
                        showInfo(t.settings.importFailed, t.settings.importFailedDesc, '⚠️');
                    }
                }}
                onCancel={() => setPendingRestore(null)}
            />

            <ConfirmationModal
                visible={showResetModal}
                title={t.stats.resetData}
                message={t.stats.resetWarning}
                confirmLabel={t.common.yes}
                cancelLabel={t.common.cancel}
                type="danger"
                onConfirm={() => {
                    setShowResetModal(false);
                    triggerNotificationHaptic(FeedbackType.Success);
                    resetApp();
                }}
                onCancel={() => setShowResetModal(false)}
            />
        </GestureHandlerRootView>
    );
}

const getStyles = (colors: ThemeColors, insets: EdgeInsets) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.bgDark,
    },
    content: {
        padding: spacing.md,
        paddingTop: Math.max(insets.top, 20) + spacing.sm,
    },
    screenHeader: {
        paddingBottom: spacing.lg,
    },
    headerMain: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    backButton: {
        marginLeft: -spacing.xs,
    },
    screenTitle: {
        ...typography.h1,
        color: colors.textPrimary,
        fontSize: 28,
        fontWeight: '800',
    },
    section: {
        marginBottom: spacing.xl,
    },
    sectionTitle: {
        ...typography.small,
        color: colors.textMuted,
        letterSpacing: 1.5,
        marginBottom: spacing.md,
    },
    statBig: {
        flex: 1,
        backgroundColor: colors.bgCard,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        alignItems: 'center',
    },
    statBigValue: {
        ...typography.h2,
        color: colors.textPrimary,
        marginBottom: spacing.xs,
    },
    statBigLabel: {
        ...typography.caption,
        color: colors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 1,
        fontSize: 10,
    },
    exportButton: {
        backgroundColor: colors.glass,
        borderColor: colors.primaryStart,
        borderWidth: 1,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        alignItems: 'center',
    },
    exportButtonText: {
        ...typography.bodyBold,
        textTransform: 'uppercase',
        letterSpacing: 1,
        color: colors.accentText,
    },
    resetButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        padding: spacing.md,
        borderRadius: borderRadius.md,
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.2)',
        marginTop: spacing.md,
    },
    resetButtonText: {
        ...typography.bodyBold,
        color: colors.dangerStart,
        fontWeight: '700',
    },
    languageContainer: {
        backgroundColor: colors.bgCard,
        borderRadius: borderRadius.md,
        padding: spacing.sm,
    },
    languageScroll: {
        gap: spacing.sm,
    },
    languageOption: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: borderRadius.sm,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        gap: spacing.xs,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    languageOptionActive: {
        borderColor: colors.primaryStart,
        backgroundColor: 'rgba(6, 182, 212, 0.15)',
    },
    languageFlag: {
        fontSize: 20,
    },
    languageName: {
        ...typography.body,
        color: colors.textSecondary,
    },
    languageNameActive: {
        color: colors.textPrimary,
        fontWeight: '600',
    },
    settingRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing.sm,
        marginBottom: spacing.xs,
    },
    settingInfo: {
        flex: 1,
        marginRight: spacing.md,
    },
    settingLabel: {
        ...typography.body,
        color: colors.textPrimary,
        fontWeight: '500',
    },
    settingDesc: {
        ...typography.caption,
        color: colors.textMuted,
        marginTop: 2,
    },
    tokenRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        backgroundColor: colors.bgCard,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        marginTop: spacing.sm,
    },
    tokenCount: {
        ...typography.h3,
        color: colors.textPrimary,
    },
    archivedRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        backgroundColor: colors.bgCard,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        marginBottom: spacing.sm,
    },
    archivedIcon: {
        fontSize: 20,
    },
    archivedName: {
        ...typography.body,
        color: colors.textSecondary,
        flex: 1,
    },
    restoreButton: {
        paddingVertical: spacing.xs,
        paddingHorizontal: spacing.md,
        borderRadius: borderRadius.sm,
        borderWidth: 1,
        borderColor: colors.primaryStart,
    },
    restoreButtonText: {
        ...typography.caption,
        color: colors.accentText,
        fontWeight: '700',
    },
});
