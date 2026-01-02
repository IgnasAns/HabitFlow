import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TouchableOpacity } from 'react-native';
import { colors, spacing, borderRadius, typography } from '../theme';
import { useHabits } from '../context/HabitContext';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { getTodayKey } from '../utils/storage';
import StyledModal from './StyledModal';
import ConfettiOverlay from './ConfettiOverlay';

// Collection of motivational quotes about habits and success
const MOTIVATIONAL_QUOTES = [
    { text: "Success is the sum of small efforts, repeated day in and day out.", author: "Robert Collier" },
    { text: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.", author: "Aristotle" },
    { text: "The secret of your future is hidden in your daily routine.", author: "Mike Murdock" },
    { text: "Motivation is what gets you started. Habit is what keeps you going.", author: "Jim Ryun" },
    { text: "Small daily improvements over time lead to stunning results.", author: "Robin Sharma" },
    { text: "Your habits will determine your future.", author: "Jack Canfield" },
    { text: "Champions don't do extraordinary things. They do ordinary things, but they do them without thinking.", author: "Charles Duhigg" },
    { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
    { text: "It's not what we do once in a while that shapes our lives, but what we do consistently.", author: "Tony Robbins" },
    { text: "First forget inspiration. Habit is more dependable.", author: "Octavia Butler" },
    { text: "Successful people are simply those with successful habits.", author: "Brian Tracy" },
    { text: "You'll never change your life until you change something you do daily.", author: "John C. Maxwell" },
    { text: "The chains of habit are too weak to be felt until they are too strong to be broken.", author: "Samuel Johnson" },
    { text: "Discipline is choosing between what you want now and what you want most.", author: "Abraham Lincoln" },
    { text: "Every action you take is a vote for the type of person you wish to become.", author: "James Clear" },
    { text: "Progress, not perfection, is what we should be asking of ourselves.", author: "Julia Cameron" },
    { text: "The difference between who you are and who you want to be is what you do.", author: "Unknown" },
    { text: "A journey of a thousand miles begins with a single step.", author: "Lao Tzu" },
    { text: "Don't count the days, make the days count.", author: "Muhammad Ali" },
    { text: "The best time to plant a tree was 20 years ago. The second best time is now.", author: "Chinese Proverb" },
];

export default function WidgetHub() {
    const { habits, toggleHabitCompletion, levelInfo, userStats, lastAction, clearLastAction } = useHabits();
    const todayKey = getTodayKey();

    // Modal state
    const [modalVisible, setModalVisible] = useState(false);
    const [modalContent, setModalContent] = useState({ title: '', message: '', emoji: '' });

    // Confetti state
    const [showConfetti, setShowConfetti] = useState(false);
    const [confettiType, setConfettiType] = useState<'completion' | 'levelUp' | 'streak'>('completion');

    // Pick a random quote (changes each time component mounts)
    const randomQuote = useMemo(() => {
        const index = Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length);
        return MOTIVATIONAL_QUOTES[index];
    }, []);

    // Calculate stats
    const completedToday = habits.filter(h => (h.completions[todayKey] || 0) >= h.dailyTarget).length;
    const totalHabits = habits.length;
    const completionRate = totalHabits > 0 ? Math.round((completedToday / totalHabits) * 100) : 0;
    const totalStreakDays = habits.reduce((sum, h) => sum + h.streak, 0);
    const bestStreak = habits.length > 0 ? Math.max(...habits.map(h => h.streak)) : 0;

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

    return (
        <>
            <ConfettiOverlay
                visible={showConfetti}
                type={confettiType}
                onComplete={() => setShowConfetti(false)}
            />
            <ScrollView
                style={styles.container}
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="always"
            >
                {/* Today's Progress */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>TODAY'S PROGRESS</Text>
                    <Pressable
                        style={styles.progressCard}
                        onPress={() => showInfo("Today's Progress", `You've completed ${completedToday} out of ${totalHabits} habits today. Keep going!`, '📊')}
                    >
                        <LinearGradient
                            colors={completionRate === 100 ? [...colors.success] : [...colors.primary]}
                            style={styles.progressGradient}
                        >
                            <Text style={styles.progressPercent}>{completionRate}%</Text>
                            <Text style={styles.progressLabel}>{completedToday}/{totalHabits} habits done</Text>
                            {completionRate === 100 && (
                                <Text style={styles.perfectDay}>🎉 Perfect Day!</Text>
                            )}
                        </LinearGradient>
                    </Pressable>
                </View>

                {/* Quick Stats Grid */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>QUICK STATS</Text>
                    <View style={styles.statsGrid}>
                        <Pressable
                            style={styles.statCard}
                            onPress={() => showInfo("Level Info", `You're Level ${levelInfo.level}! Earn XP by completing habits. ${levelInfo.xpNeeded - levelInfo.currentXp} XP until next level.`, '⭐')}
                        >
                            <Text style={styles.statEmoji}>⭐</Text>
                            <Text style={styles.statValue}>Level {levelInfo.level}</Text>
                            <Text style={styles.statLabel}>{userStats.totalXp} XP</Text>
                        </Pressable>

                        <Pressable
                            style={styles.statCard}
                            onPress={() => showInfo("Best Streak", `Your longest current streak is ${bestStreak} days. Keep the momentum going!`, '🔥')}
                        >
                            <Text style={styles.statEmoji}>🔥</Text>
                            <Text style={styles.statValue}>{bestStreak}</Text>
                            <Text style={styles.statLabel}>Best Streak</Text>
                        </Pressable>

                        <Pressable
                            style={styles.statCard}
                            onPress={() => showInfo("Total Habits", `You're tracking ${totalHabits} habits. Good discipline!`, '📊')}
                        >
                            <Text style={styles.statEmoji}>📊</Text>
                            <Text style={styles.statValue}>{totalHabits}</Text>
                            <Text style={styles.statLabel}>Habits</Text>
                        </Pressable>

                        <Pressable
                            style={styles.statCard}
                            onPress={() => showInfo("Combined Streaks", `Your combined streak days across all habits: ${totalStreakDays} days!`, '📈')}
                        >
                            <Text style={styles.statEmoji}>📈</Text>
                            <Text style={styles.statValue}>{totalStreakDays}</Text>
                            <Text style={styles.statLabel}>Total Days</Text>
                        </Pressable>
                    </View>
                </View>

                {/* Quick Actions - Mark habits complete */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>QUICK ACTIONS</Text>
                    {habits.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>No habits yet. Add some habits to see quick actions here!</Text>
                        </View>
                    ) : (
                        <View style={styles.quickActions}>
                            {habits.map(habit => {
                                const progress = habit.completions[todayKey] || 0;
                                const isComplete = progress >= habit.dailyTarget;
                                const isExplicitlyFailed = habit.explicitFailures?.[todayKey] || false;
                                const themeColor = colors.habitColors[habit.colorIndex]?.[0] || colors.primaryStart;

                                return (
                                    <TouchableOpacity
                                        key={habit.id}
                                        activeOpacity={0.7}
                                        delayPressIn={0}
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                        style={[
                                            styles.quickAction,
                                            { borderColor: themeColor + '30' }, // Always show subtle border
                                            isComplete && { borderColor: themeColor }
                                        ]}
                                        onPress={() => {
                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                            requestAnimationFrame(() => {
                                                toggleHabitCompletion(habit.id);
                                            });
                                        }}
                                    >
                                        <View style={[styles.quickActionIcon, { backgroundColor: themeColor + '20' }]}>
                                            <Text style={styles.quickActionEmoji}>{habit.icon}</Text>
                                        </View>
                                        <View style={styles.quickActionInfo}>
                                            <Text style={styles.quickActionName} numberOfLines={1}>{habit.name}</Text>
                                            <Text style={styles.quickActionProgress}>
                                                {progress}/{habit.dailyTarget} • {habit.streak}🔥
                                            </Text>
                                        </View>
                                        <View style={[
                                            styles.quickActionCheck,
                                            isComplete ? {
                                                backgroundColor: themeColor,
                                                shadowColor: themeColor,
                                                shadowOffset: { width: 0, height: 4 },
                                                shadowOpacity: 0.5,
                                                shadowRadius: 12,
                                                elevation: 10
                                            } : isExplicitlyFailed ? {
                                                backgroundColor: colors.dangerStart || '#EF4444',
                                            } : { borderColor: themeColor + '40', borderWidth: 2 }
                                        ]}>
                                            {isComplete ? (
                                                <Text style={styles.checkMark}>✓</Text>
                                            ) : isExplicitlyFailed ? (
                                                <Text style={[styles.checkMark, { fontSize: 18 }]}>✕</Text>
                                            ) : null}
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    )}
                </View>

                {/* Motivational Quote */}
                <View style={styles.section}>
                    <Pressable
                        style={styles.quoteCard}
                        onPress={() => {
                            Haptics.selectionAsync();
                            showInfo("Keep Going! 💪", "Every day is a new opportunity to build the life you want. Small actions lead to big changes.", "💪");
                        }}
                    >
                        <Text style={styles.quoteText}>"{randomQuote.text}"</Text>
                        <Text style={styles.quoteAuthor}>— {randomQuote.author}</Text>
                    </Pressable>
                </View>

                <View style={{ height: 40 }} />
            </ScrollView >

            <StyledModal
                visible={modalVisible}
                title={modalContent.title}
                message={modalContent.message}
                emoji={modalContent.emoji}
                onClose={() => setModalVisible(false)}
            />
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.bgDark,
    },
    content: {
        padding: spacing.md,
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
    progressCard: {
        borderRadius: borderRadius.lg,
        overflow: 'hidden',
    },
    progressGradient: {
        padding: spacing.xl,
        alignItems: 'center',
    },
    progressPercent: {
        fontSize: 48,
        fontWeight: '800',
        color: colors.textPrimary,
    },
    progressLabel: {
        ...typography.body,
        color: 'rgba(255,255,255,0.8)',
        marginTop: spacing.xs,
    },
    perfectDay: {
        ...typography.bodyBold,
        color: colors.textPrimary,
        marginTop: spacing.md,
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing.sm,
    },
    statCard: {
        flex: 1,
        minWidth: '45%',
        backgroundColor: colors.bgCard,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        alignItems: 'center',
    },
    statEmoji: {
        fontSize: 24,
        marginBottom: spacing.xs,
    },
    statValue: {
        ...typography.h3,
        color: colors.textPrimary,
    },
    statLabel: {
        ...typography.caption,
        color: colors.textMuted,
    },
    quickActions: {
        gap: spacing.sm,
    },
    quickAction: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.bgCard,
        borderRadius: borderRadius.md,
        padding: spacing.md,
        gap: spacing.md,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    quickActionIcon: {
        width: 44,
        height: 44,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    quickActionEmoji: {
        fontSize: 22,
    },
    quickActionInfo: {
        flex: 1,
    },
    quickActionName: {
        ...typography.bodyBold,
        color: colors.textPrimary,
    },
    quickActionProgress: {
        ...typography.caption,
        color: colors.textMuted,
    },
    quickActionCheck: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkMark: {
        color: '#fff',
        fontWeight: '800',
        fontSize: 16,
    },
    emptyState: {
        backgroundColor: colors.bgCard,
        borderRadius: borderRadius.md,
        padding: spacing.xl,
        alignItems: 'center',
    },
    emptyText: {
        ...typography.body,
        color: colors.textMuted,
        textAlign: 'center',
    },
    quoteCard: {
        backgroundColor: colors.glass,
        borderRadius: borderRadius.lg,
        padding: spacing.xl,
        borderWidth: 1,
        borderColor: colors.glassBorder,
    },
    quoteText: {
        ...typography.body,
        color: colors.textSecondary,
        fontStyle: 'italic',
        textAlign: 'center',
        lineHeight: 24,
    },
    quoteAuthor: {
        ...typography.caption,
        color: colors.textMuted,
        textAlign: 'center',
        marginTop: spacing.md,
    },
});
