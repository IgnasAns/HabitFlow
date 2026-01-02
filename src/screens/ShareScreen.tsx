import React, { useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, typography, borderRadius, shadows } from '../theme';
import { useHabits } from '../context/HabitContext';
import { getTodayKey, generateGridData } from '../utils/storage';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp } from 'react-native-reanimated';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';

const { width } = Dimensions.get('window');
const COLUMN_count = 2; // 2 columns for compactness
const CARD_WIDTH = (width - (spacing.lg * 2) - (spacing.md * (COLUMN_count - 1))) / COLUMN_count;

export default function ShareScreen({ navigation }: any) {
    const { habits, levelInfo, userStats } = useHabits();
    const todayKey = getTodayKey();
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
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

    return (
        <View style={styles.container}>
            {/* Background Gradient */}
            <LinearGradient
                colors={[colors.bgDark, '#1a1b2e']}
                style={StyleSheet.absoluteFill}
            />

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* ViewShot captures everything inside this block */}
                <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 0.9 }} style={{ backgroundColor: colors.bgDark }}>
                    <View style={styles.capturePadding}>
                        {/* Header Section */}
                        <View style={styles.header}>
                            <Text style={styles.appTitle}>HabitFlow</Text>
                            <Text style={styles.date}>{today}</Text>
                        </View>

                        {/* Stats Summary */}
                        <View style={styles.statsRow}>
                            <View style={styles.statItem}>
                                <Text style={styles.statValue}>Lvl {levelInfo.level}</Text>
                                <Text style={styles.statLabel}>Current Level</Text>
                            </View>
                            <View style={styles.statDivider} />
                            <View style={styles.statItem}>
                                <Text style={styles.statValue}>{Math.max(0, ...habits.map(h => h.streak))}🔥</Text>
                                <Text style={styles.statLabel}>Best Streak</Text>
                            </View>
                            <View style={styles.statDivider} />
                            <View style={styles.statItem}>
                                <Text style={styles.statValue}>{habits.filter(h => (h.completions[todayKey] || 0) >= h.dailyTarget).length}/{habits.length}</Text>
                                <Text style={styles.statLabel}>Done Today</Text>
                            </View>
                        </View>

                        {/* Habits Grid */}
                        <View style={styles.grid}>
                            {habits.map((habit, index) => {
                                const isCompleted = (habit.completions[todayKey] || 0) >= habit.dailyTarget;
                                const themeColor = colors.habitColors[habit.colorIndex]?.[0] || colors.primaryStart;
                                const gridData = generateGridData(habit, 91); // 13 weeks

                                return (
                                    <Animated.View
                                        key={habit.id}
                                        entering={FadeInUp.delay(index * 50).springify()}
                                        style={[
                                            styles.card,
                                            isCompleted && {
                                                borderColor: themeColor,
                                                borderWidth: 1,
                                                // Completed Glow
                                                shadowColor: themeColor,
                                                shadowOffset: { width: 0, height: 0 },
                                                shadowOpacity: 0.6,
                                                shadowRadius: 12,
                                                elevation: 6
                                            }
                                        ]}
                                    >
                                        <View style={styles.cardHeader}>
                                            <View style={[styles.iconBox, { backgroundColor: themeColor + '15' }]}>
                                                <Text style={styles.icon}>{habit.icon}</Text>
                                                {isCompleted && (
                                                    <View style={[styles.checkBadge, { backgroundColor: themeColor }]}>
                                                        <Ionicons name="checkmark" size={10} color="#FFF" />
                                                    </View>
                                                )}
                                            </View>

                                            <View style={styles.cardInfo}>
                                                <Text style={styles.habitName} numberOfLines={1}>{habit.name}</Text>
                                                <Text style={styles.streakText}>
                                                    <Text style={{ color: themeColor, fontWeight: 'bold' }}>{habit.streak}</Text> day streak
                                                </Text>
                                            </View>
                                        </View>

                                        <View style={styles.miniGrid}>
                                            {Array.from({ length: 13 }).map((_, col) => (
                                                <View key={col} style={{ gap: 2 }}>
                                                    {Array.from({ length: 7 }).map((_, row) => {
                                                        const day = gridData[col * 7 + row];
                                                        if (!day) return null;

                                                        let bg = 'rgba(255,255,255,0.05)';
                                                        if (day.isExplicitlyFailed) bg = colors.dangerStart;
                                                        else if (day.progress > 0) bg = themeColor;
                                                        else if (day.isMissed) bg = 'rgba(255,100,100,0.15)';

                                                        return (
                                                            <View
                                                                key={`${col}-${row}`}
                                                                style={{
                                                                    width: 8,
                                                                    height: 8,
                                                                    borderRadius: 2,
                                                                    backgroundColor: bg,
                                                                    opacity: day.progress > 0 ? (0.4 + (day.progress / day.dailyTarget * 0.6)) : 1
                                                                }}
                                                            />
                                                        );
                                                    })}
                                                </View>
                                            ))}
                                        </View>
                                    </Animated.View>
                                );
                            })}
                        </View>

                        {/* Footer Brand */}
                        <View style={styles.footer}>
                            <Text style={styles.footerText}>Tracked with HabitFlow</Text>
                        </View>
                    </View>
                </ViewShot>
            </ScrollView>

            {/* Back Button (Top Left) */}
            <Pressable
                style={styles.closeButton}
                onPress={() => navigation.goBack()}
            >
                <Ionicons name="close" size={24} color={colors.textPrimary} />
            </Pressable>

            {/* Share Button (Top Right) */}
            <Pressable
                style={styles.shareButton}
                onPress={handleShare}
            >
                <Ionicons name="share-social" size={24} color="#fff" />
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.bgDark,
    },
    scrollContent: {
        flexGrow: 1,
    },
    capturePadding: {
        padding: spacing.lg,
        paddingTop: spacing.xl * 3, // Initial padding for layout (under buttons)
        paddingBottom: spacing.xl,
    },
    header: {
        alignItems: 'center',
        marginBottom: spacing.xl,
    },
    appTitle: {
        fontSize: 32,
        fontWeight: '800',
        color: colors.textPrimary,
        letterSpacing: -1,
        marginBottom: spacing.xs,
    },
    date: {
        ...typography.body,
        color: colors.textSecondary,
        opacity: 0.8,
    },
    statsRow: {
        flexDirection: 'row',
        backgroundColor: colors.bgCard,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.xl,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        ...shadows.card,
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
    },
    statValue: {
        fontSize: 20,
        fontWeight: '700',
        color: colors.textPrimary,
        marginBottom: 2,
    },
    statLabel: {
        fontSize: 10,
        color: colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    statDivider: {
        width: 1,
        height: 30,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.md,
    },
    card: {
        width: CARD_WIDTH,
        backgroundColor: colors.bgCard,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.03)',
        ...shadows.card,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginBottom: spacing.sm,
    },
    miniGrid: {
        flexDirection: 'row',
        gap: 2,
        width: '100%',
        marginTop: spacing.sm,
        // justifyContent: 'space-between' REMOVED in step 896
        // Explicitly removed here too to keep consistency
    },
    iconBox: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    icon: {
        fontSize: 20,
    },
    checkBadge: {
        position: 'absolute',
        bottom: -4,
        right: -4,
        width: 16,
        height: 16,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: colors.bgCard,
    },
    cardInfo: {
        flex: 1,
    },
    habitName: {
        ...typography.bodyBold,
        fontSize: 14,
        color: colors.textPrimary,
        marginBottom: 2,
    },
    streakText: {
        fontSize: 11,
        color: colors.textSecondary,
    },
    footer: {
        marginTop: spacing.xxl,
        alignItems: 'center',
    },
    footerText: {
        ...typography.caption,
        color: 'rgba(255,255,255,0.3)',
    },
    closeButton: {
        position: 'absolute',
        top: 50,
        left: 20, // Moved to left
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    shareButton: {
        position: 'absolute',
        top: 50,
        right: 20, // Moved to right
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.primaryStart, // Colored button for Share
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
        ...shadows.card,
    }
});
