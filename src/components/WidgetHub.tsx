import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, TouchableOpacity, ScrollView, Alert, Share, Switch, LayoutAnimation, Platform, UIManager } from 'react-native';
import { spacing, borderRadius, typography } from '../theme';
import { useTheme } from '../context/ThemeContext';
import { useHabits } from '../context/HabitContext';
import { useI18n } from '../context/I18nContext';
import { SupportedLanguage } from '../i18n';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { getTodayKey } from '../utils/storage';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { scheduleDailyReminder, cancelReminders, registerForPushNotificationsAsync, scheduleTestNotification } from '../utils/notifications';
import { triggerHaptic, triggerSelectionHaptic, triggerNotificationHaptic, updateFeedbackSettings, FeedbackType } from '../utils/feedback';

import StyledModal from './StyledModal';
import ConfirmationModal from './ConfirmationModal';
import ConfettiOverlay from './ConfettiOverlay';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function WidgetHub() {
    const { habits, userStats, levelInfo, lastAction, clearLastAction, resetApp, importData } = useHabits();
    const { t, language, setLanguage, languageNames, languageFlags, supportedLanguages } = useI18n();
    const { colors, toggleTheme, theme } = useTheme();
    const todayKey = getTodayKey();
    // Use local state for options
    const [smartReminders, setSmartReminders] = useState(false);
    const [hapticsEnabled, setHapticsEnabled] = useState(true);
    const [soundEnabled, setSoundEnabled] = useState(true);

    // Load settings
    useEffect(() => {
        const loadSettings = async () => {
            try {
                const storedSettings = await AsyncStorage.getItem('app_settings');
                if (storedSettings) {
                    const parsed = JSON.parse(storedSettings);
                    setSmartReminders(parsed.smartReminders ?? false);
                    setHapticsEnabled(parsed.hapticsEnabled ?? true);
                    setSoundEnabled(parsed.soundEnabled ?? true);
                    // Theme handled by ThemeProvider
                }
            } catch (e) {
                // error loading
            }
        };
        loadSettings();
    }, []);

    const saveSettings = async (updates: any) => {
        try {
            const currentMatrix = { smartReminders, hapticsEnabled, soundEnabled, darkMode: theme === 'dark' };
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
                            scheduleDailyReminder();
                            showInfo("Reminders Set", "You'll be reminded daily at 8 PM to check your habits.", "✅");
                        } else {
                            // Permission denied or error
                            setSmartReminders(false); // Revert switch if failed
                            saveSettings({ smartReminders: false });
                            showInfo("Permission Required", "Please enable notifications in settings to use Smart Reminders.", "🚫");
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
        }
    };

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
                    showInfo("Import Successful", "Your data has been restored.", "💾");
                } else {
                    throw new Error("Invalid data format");
                }
            } catch (e) {
                triggerNotificationHaptic(FeedbackType.Error);
                showInfo("Import Failed", "The selected file is not a valid backup.", "⚠️");
            }
        } catch (error) {
            console.error(error);
            showInfo("Import Failed", "Could not read the file.", "📂");
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

    // Calculate stats
    const activeHabits = habits.filter(h => !h.archived);
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
            const key = d.toISOString().split('T')[0];

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
                appVersion: '1.7.0'
            };
            await Share.share({
                message: JSON.stringify(data, null, 2),
                title: 'HabitFlow Data Export'
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
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } else if (lastAction.habit?.streak && lastAction.habit.streak > 0 && lastAction.habit.streak % 7 === 0) {
                setConfettiType('streak');
                setShowConfetti(true);
            }
            clearLastAction();
        }
    }, [lastAction]);

    const showInfo = (title: string, message: string, emoji: string = '✨') => {
        Haptics.selectionAsync();
        setModalContent({ title, message, emoji });
        setModalVisible(true);
    };


    const styles = useMemo(() => getStyles(colors), [colors]);

    const renderHeader = useCallback(() => (
        <View>
            {/* Screen Title */}
            <View style={styles.screenHeader}>
                <Text style={styles.screenTitle}>{t.settings.title}</Text>
            </View>

            {/* Momentum / Stats */}
            <View style={styles.section}>
                <View style={styles.statBig}>
                    <Text style={styles.statBigValue}>{consistencyScore}%</Text>
                    <Text style={styles.statBigLabel}>Consistency Score (Last 30 Days)</Text>
                </View>
            </View>

        </View>
    ), [consistencyScore, t, styles]);

    const renderFooter = useCallback(() => (
        <View>
            {/* Level Info (Low Priority) */}
            <View style={{ alignItems: 'center', marginBottom: spacing.xl }}>
                <Text style={{ ...typography.caption, color: colors.textMuted }}>
                    Level {levelInfo.level} • {userStats.totalXp} XP
                </Text>
            </View>

            {/* App Settings */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>APP EXPERIENCE</Text>

                <View style={styles.settingRow}>
                    <View style={styles.settingInfo}>
                        <Text style={styles.settingLabel}><Text style={{ fontSize: 18 }}>🔔</Text>  Smart Reminders</Text>
                        <Text style={styles.settingDesc}>Get reminded when you forget</Text>
                    </View>
                    <Switch
                        value={smartReminders}
                        onValueChange={() => toggleSetting('smartReminders')}
                        trackColor={{ false: colors.bgCard, true: colors.primaryStart }}
                        thumbColor={'#fff'}
                    />
                </View>

                {smartReminders && (
                    <TouchableOpacity
                        style={[styles.exportButton, { marginBottom: spacing.md, paddingVertical: 8, borderColor: colors.glassBorder }]}
                        onPress={async () => {
                            triggerSelectionHaptic();
                            await registerForPushNotificationsAsync();
                            await scheduleTestNotification();
                            setShowTestModal(true);
                        }}
                    >
                        <Text style={[styles.exportButtonText, { fontSize: 12, color: colors.textSecondary }]}>Test Notification (5s)</Text>
                    </TouchableOpacity>
                )}

                <View style={styles.settingRow}>
                    <View style={styles.settingInfo}>
                        <Text style={styles.settingLabel}><Text style={{ fontSize: 18 }}>📳</Text>  Haptic Feedback</Text>
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
                        <Text style={styles.settingLabel}><Text style={{ fontSize: 18 }}>🔊</Text>  Sound Effects</Text>
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
                        <Text style={styles.settingLabel}><Text style={{ fontSize: 18 }}>🌓</Text>  Dark Mode</Text>
                    </View>
                    <Switch
                        value={theme === 'dark'}
                        onValueChange={() => toggleSetting('theme')}
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
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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

            {/* Data Export & Reset */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>DATA & PRIVACY</Text>

                <TouchableOpacity style={styles.exportButton} onPress={handleExport}>
                    <Text style={styles.exportButtonText}>Download Your Data (JSON)</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.exportButton, { marginTop: 10, borderColor: colors.textMuted }]} onPress={handleImport}>
                    <Text style={[styles.exportButtonText, { color: colors.textMuted }]}>Import Data (JSON)</Text>
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
    ), [randomQuote, t, language, supportedLanguages, languageFlags, languageNames, setLanguage, styles, colors, smartReminders, hapticsEnabled, soundEnabled, theme]);

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
                title="Test Sent"
                message={"Notification scheduled for 5 seconds from now.\n\nPlease close the app (go to home screen) to see it."}
                emoji="🔔"
                onClose={() => setShowTestModal(false)}
                buttonText="Okay"
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

const getStyles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.bgDark,
    },
    content: {
        padding: spacing.md,
    },
    screenHeader: {
        paddingTop: 50,
        paddingBottom: spacing.lg,
        alignItems: 'center',
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
        color: colors.primaryStart,
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
});
