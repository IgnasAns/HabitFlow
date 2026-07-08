import React, { useRef, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, ThemeColors } from '../context/ThemeContext';
import { spacing, typography, borderRadius, shadows, pickTextOn } from '../theme';
import { useHabits } from '../context/HabitContext';
import { useI18n, interpolate } from '../context/I18nContext';
import { getTodayKey, generateGridData } from '../utils/storage';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { EdgeInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp } from 'react-native-reanimated';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';

const { width } = Dimensions.get('window');
const COLUMN_count = 2;
const CARD_WIDTH = (width - (spacing.lg * 2) - (spacing.md * (COLUMN_count - 1))) / COLUMN_count;

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_NAMES_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function ShareScreen({ navigation }: any) {
    const { habits, levelInfo, userStats } = useHabits();
    const { t, language } = useI18n();
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const styles = useMemo(() => getStyles(colors, insets), [colors, insets]);
    const todayKey = getTodayKey();

    const now = new Date();
    // Month picker state: default to current month
    const [selectedYear, setSelectedYear] = useState(now.getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(now.getMonth()); // 0-indexed

    const isCurrentMonth = selectedYear === now.getFullYear() && selectedMonth === now.getMonth();

    const localeMap: Record<string, string> = {
        en: 'en-US', es: 'es-ES', de: 'de-DE', fr: 'fr-FR', pt: 'pt-BR'
    };
    const today = now.toLocaleDateString(localeMap[language] || 'en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    const viewShotRef = useRef<any>(null);

    const handleShare = async () => {
        try {
            if (viewShotRef.current && viewShotRef.current.capture) {
                const uri = await viewShotRef.current.capture();
                await Sharing.shareAsync(uri);
            }
        } catch (error) {
            console.error("Share failed", error);
        }
    };

    const prevMonth = () => {
        if (selectedMonth === 0) { setSelectedMonth(11); setSelectedYear(y => y - 1); }
        else setSelectedMonth(m => m - 1);
    };
    const nextMonth = () => {
        // Don't go past current month
        if (selectedYear === now.getFullYear() && selectedMonth === now.getMonth()) return;
        if (selectedMonth === 11) { setSelectedMonth(0); setSelectedYear(y => y + 1); }
        else setSelectedMonth(m => m + 1);
    };

    // Build per-month grid data for a habit: returns day cells for the selected month
    const getMonthGridData = (habit: any) => {
        const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
        const firstDow = new Date(selectedYear, selectedMonth, 1).getDay(); // 0=Sun
        const cells: { bg: string; isEmpty: boolean; isFuture: boolean }[] = [];

        // Leading empty spacers
        for (let i = 0; i < firstDow; i++) cells.push({ bg: 'transparent', isEmpty: true, isFuture: false });

        const createdDate = new Date(habit.createdAt);
        createdDate.setHours(0, 0, 0, 0);

        for (let d = 1; d <= daysInMonth; d++) {
            const dk = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const dateObj = new Date(selectedYear, selectedMonth, d);
            const isFuture = dateObj > now && dk !== todayKey;
            // Days before the habit existed are neutral, not "missed".
            const isBeforeCreation = dateObj < createdDate;
            const progress = habit.completions[dk] || 0;
            const isExplicitlyFailed = habit.explicitFailures?.[dk] || false;
            const isMissed = !progress && !isExplicitlyFailed && !isFuture && !isBeforeCreation && dk !== todayKey;
            const themeColor = colors.habitColors[habit.colorIndex]?.[0] || colors.primaryStart;

            let bg = '#252B37';
            if (isFuture || isBeforeCreation) bg = '#252B37';
            else if (isExplicitlyFailed) bg = colors.dangerStart;
            else if (progress > 0) bg = themeColor;
            else if (isMissed) bg = 'rgba(255,100,100,0.15)';

            cells.push({ bg, isEmpty: false, isFuture });
        }
        return cells;
    };

    // Stats for selected month
    const getMonthStats = (habit: any) => {
        const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
        const lastDay = isCurrentMonth ? now.getDate() : daysInMonth;
        let completed = 0;
        for (let d = 1; d <= lastDay; d++) {
            const dk = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            if ((habit.completions[dk] || 0) >= habit.dailyTarget) completed++;
        }
        return { completed, total: lastDay };
    };

    return (
        <View style={styles.container}>
            <LinearGradient colors={[colors.bgDark, '#1a1b2e']} style={StyleSheet.absoluteFill} />

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1.0 }} style={{ backgroundColor: colors.bgDark }}>
                    <View style={styles.capturePadding}>
                        {/* Header */}
                        <View style={styles.header}>
                            <Text style={styles.appTitle}>HabitFlow</Text>
                            <Text style={styles.date}>{MONTH_NAMES_FULL[selectedMonth]} {selectedYear}</Text>
                        </View>

                        {/* Stats Summary */}
                        <View style={styles.statsRow}>
                            <View style={styles.statItem}>
                                <Text style={styles.statValue}>{interpolate(t.settings.level, { level: levelInfo.level })}</Text>
                                <Text style={styles.statLabel}>{t.share.currentLevel}</Text>
                            </View>
                            <View style={styles.statDivider} />
                            <View style={styles.statItem}>
                                <Text style={styles.statValue}>{Math.max(0, ...habits.map(h => h.streak))}{Math.max(0, ...habits.map(h => h.streak)) > 0 ? '🔥' : ''}</Text>
                                <Text style={styles.statLabel}>{t.share.bestStreak}</Text>
                            </View>
                            <View style={styles.statDivider} />
                            <View style={styles.statItem}>
                                <Text style={styles.statValue}>
                                    {habits.filter(h => {
                                        const { completed, total } = getMonthStats(h);
                                        return completed === total && total > 0;
                                    }).length}/{habits.length}
                                </Text>
                                <Text style={styles.statLabel}>Perfect Month</Text>
                            </View>
                        </View>

                        {/* Habits Grid */}
                        <View style={styles.grid}>
                            {habits.map((habit, index) => {
                                const themeColor = colors.habitColors[habit.colorIndex]?.[0] || colors.primaryStart;
                                const monthCells = getMonthGridData(habit);
                                const { completed, total } = getMonthStats(habit);
                                const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

                                return (
                                    <Animated.View
                                        key={habit.id}
                                        entering={FadeInUp.delay(index * 50).springify()}
                                        style={[
                                            styles.card,
                                            pct === 100 && {
                                                borderColor: themeColor,
                                                borderWidth: 1,
                                                shadowColor: themeColor,
                                                shadowOffset: { width: 0, height: 4 },
                                                shadowOpacity: 0.5,
                                                shadowRadius: 16,
                                                elevation: 10,
                                            }
                                        ]}
                                    >
                                        <View style={styles.cardHeader}>
                                            <View style={[styles.iconBox, { backgroundColor: themeColor + '15' }]}>
                                                <Text style={styles.icon}>{habit.icon}</Text>
                                                {pct === 100 && (
                                                    <View style={[styles.checkBadge, { backgroundColor: themeColor }]}>
                                                        <Ionicons name="checkmark" size={10} color="#FFF" />
                                                    </View>
                                                )}
                                            </View>
                                            <View style={styles.cardInfo}>
                                                <Text style={styles.habitName} numberOfLines={2}>{habit.name}</Text>
                                                <Text style={styles.streakText}>
                                                    <Text style={{ color: themeColor, fontWeight: 'bold' }}>{completed}/{total}</Text>
                                                    {' days · '}<Text style={{ color: themeColor, fontWeight: 'bold' }}>{pct}%</Text>
                                                </Text>
                                            </View>
                                        </View>

                                        {/* Monthly calendar mini-grid */}
                                        <View style={styles.monthGrid}>
                                            {/* Day headers: S M T W T F S */}
                                            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                                                <Text key={i} style={styles.dayHeader}>{d}</Text>
                                            ))}
                                            {monthCells.map((cell, ci) => (
                                                <View
                                                    key={ci}
                                                    style={[
                                                        styles.monthCell,
                                                        { backgroundColor: cell.isEmpty ? 'transparent' : cell.bg },
                                                    ]}
                                                />
                                            ))}
                                        </View>
                                    </Animated.View>
                                );
                            })}
                        </View>

                        {/* Footer */}
                        <View style={styles.footer}>
                            <Text style={styles.footerText}>{t.share.trackedWith}</Text>
                        </View>
                    </View>
                </ViewShot>
            </ScrollView>

            {/* Back Button */}
            <Pressable style={styles.closeButton} onPress={() => navigation.navigate('Home')}>
                <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
            </Pressable>

            {/* Month Picker — centered top */}
            <View style={styles.monthPicker}>
                <Pressable onPress={prevMonth} style={styles.monthArrow}>
                    <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
                </Pressable>
                <Text style={styles.monthPickerLabel}>
                    {MONTH_NAMES_FULL[selectedMonth]} {selectedYear}
                </Text>
                <Pressable
                    onPress={nextMonth}
                    style={[styles.monthArrow, isCurrentMonth && styles.monthArrowDisabled]}
                >
                    <Ionicons name="chevron-forward" size={20} color={isCurrentMonth ? colors.textSecondary : colors.textPrimary} />
                </Pressable>
            </View>

            {/* Share Button */}
            <Pressable style={styles.shareButton} onPress={handleShare}>
                <Ionicons name="share-social" size={24} color={pickTextOn(colors.primaryStart)} />
            </Pressable>
        </View>
    );
}

const getStyles = (colors: ThemeColors, insets: EdgeInsets) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bgDark },
    scrollContent: { flexGrow: 1 },
    capturePadding: {
        padding: spacing.lg,
        // Clear the floating month picker / back / share controls above the title.
        paddingTop: Math.max(insets.top, 20) + spacing.xl * 2,
        paddingBottom: spacing.xl,
    },
    header: { alignItems: 'center', marginBottom: spacing.xl },
    appTitle: {
        fontSize: 32, fontWeight: '800', color: colors.textPrimary,
        letterSpacing: -1, marginBottom: spacing.xs,
    },
    date: { ...typography.body, color: colors.textSecondary, opacity: 0.8 },
    statsRow: {
        flexDirection: 'row', backgroundColor: colors.bgCard,
        borderRadius: borderRadius.lg, padding: spacing.md,
        alignItems: 'center', justifyContent: 'space-between',
        marginBottom: spacing.xl, borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)', ...shadows.card,
    },
    statItem: { flex: 1, alignItems: 'center' },
    statValue: { fontSize: 20, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
    statLabel: { fontSize: 10, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
    statDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.1)' },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
    card: {
        width: CARD_WIDTH, backgroundColor: colors.bgCard,
        borderRadius: borderRadius.md, padding: spacing.md,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.03)', ...shadows.card,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
    iconBox: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', position: 'relative' },
    icon: { fontSize: 20 },
    checkBadge: {
        position: 'absolute', bottom: -4, right: -4,
        width: 16, height: 16, borderRadius: 8,
        justifyContent: 'center', alignItems: 'center',
        borderWidth: 1.5, borderColor: colors.bgCard,
    },
    cardInfo: { flex: 1 },
    habitName: { ...typography.bodyBold, fontSize: 14, color: colors.textPrimary, marginBottom: 2 },
    streakText: { fontSize: 11, color: colors.textSecondary },
    // Monthly calendar grid inside card
    monthGrid: {
        flexDirection: 'row', flexWrap: 'wrap',
        marginTop: spacing.sm, gap: 3,
        justifyContent: 'flex-start',
    },
    dayHeader: {
        width: (CARD_WIDTH - spacing.md * 2 - 3 * 6) / 7,
        fontSize: 7, color: colors.textSecondary,
        textAlign: 'center', fontWeight: '600', marginBottom: 1,
    },
    monthCell: {
        width: (CARD_WIDTH - spacing.md * 2 - 3 * 6) / 7,
        height: (CARD_WIDTH - spacing.md * 2 - 3 * 6) / 7,
        borderRadius: 2,
    },
    footer: { marginTop: spacing.xxl, alignItems: 'center' },
    footerText: { ...typography.caption, color: 'rgba(255,255,255,0.3)' },
    closeButton: {
        position: 'absolute',
        top: Math.max(insets.top, 20) + spacing.sm,
        left: 20, width: 40, height: 40, borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'center', alignItems: 'center', zIndex: 10,
    },
    monthPicker: {
        position: 'absolute',
        top: Math.max(insets.top, 20) + spacing.sm,
        left: 70, right: 70, height: 40,
        flexDirection: 'row', alignItems: 'center',
        justifyContent: 'center', zIndex: 10,
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderRadius: 20, gap: spacing.sm,
    },
    monthArrow: { padding: spacing.xs },
    monthArrowDisabled: { opacity: 0.3 },
    monthPickerLabel: {
        fontSize: 14, fontWeight: '700',
        color: colors.textPrimary, letterSpacing: 0.3,
    },
    shareButton: {
        position: 'absolute',
        top: Math.max(insets.top, 20) + spacing.sm,
        right: 20, width: 40, height: 40, borderRadius: 20,
        backgroundColor: colors.primaryStart,
        justifyContent: 'center', alignItems: 'center',
        zIndex: 10, ...shadows.card,
    },
});
