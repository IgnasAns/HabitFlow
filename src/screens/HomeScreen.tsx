import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Pressable,
    RefreshControl,
    ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
    FadeInDown,
    FadeInUp,
    LinearTransition,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useHabits } from '../context/HabitContext';
import { colors, spacing, borderRadius, typography } from '../theme';
import HabitCard from '../components/HabitCard';
import LevelProgress from '../components/LevelProgress';
import ConfettiOverlay from '../components/ConfettiOverlay';
import { getTodayKey } from '../utils/storage';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { registerForPushNotificationsAsync, scheduleDailyReminder } from '../utils/notifications';

interface HomeScreenProps {
    navigation: NativeStackNavigationProp<any>;
}

export default function HomeScreen({ navigation }: HomeScreenProps) {
    const {
        habits,
        isLoading,
        toggleHabitCompletion,
        incrementHabitProgress,
        levelInfo,
        userStats,
        lastAction,
        clearLastAction,
        refreshData,
    } = useHabits();

    const [showConfetti, setShowConfetti] = useState(false);
    const [confettiType, setConfettiType] = useState<'completion' | 'levelUp' | 'streak'>('completion');
    const [refreshing, setRefreshing] = useState(false);

    // Stable handlers for HabitCard performance
    const handleToggle = React.useCallback((id: string, dateKey?: string) => {
        toggleHabitCompletion(id, dateKey);
    }, [toggleHabitCompletion]);

    const handleIncrement = React.useCallback((id: string, amount: number, dateKey?: string) => {
        incrementHabitProgress(id, amount, dateKey);
    }, [incrementHabitProgress]);

    const handleEdit = React.useCallback((id: string) => {
        navigation.navigate('EditHabit', { habitId: id });
    }, [navigation]);

    // Initial setup - notifications disabled for Expo Go compatibility
    // Uncomment when using a development build
    // useEffect(() => {
    //     const setup = async () => {
    //         await registerForPushNotificationsAsync();
    //         await scheduleDailyReminder();
    //     };
    //     setup();
    // }, []);

    // Handle last action (show confetti, etc.)
    useEffect(() => {
        if (lastAction?.type === 'TOGGLE_COMPLETE' && lastAction.xpGained && lastAction.xpGained > 0) {
            if (lastAction.leveledUp) {
                setConfettiType('levelUp');
                setShowConfetti(true);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } else if (lastAction.habit?.streak && lastAction.habit.streak > 0 && lastAction.habit.streak % 7 === 0) {
                setConfettiType('streak');
                setShowConfetti(true);
            }
            clearLastAction();
        }
    }, [lastAction]);

    const onRefresh = async () => {
        setRefreshing(true);
        await refreshData();
        setRefreshing(false);
    };

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primaryStart} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <ConfettiOverlay
                visible={showConfetti}
                type={confettiType}
                onComplete={() => setShowConfetti(false)}
            />

            {/* Top Navigation Bar - Fixed at top */}
            <View style={styles.topBar}>
                <View>
                    <Pressable style={styles.iconBtn} onPress={() => navigation.navigate('WidgetHub')}>
                        <Ionicons name="settings-outline" size={24} color="#FFFFFF" />
                    </Pressable>
                </View>

                <Text style={styles.brandTitle}>HabitFlow</Text>

                <View style={styles.topRight}>
                    <View>
                        <Pressable style={styles.iconBtn} onPress={() => navigation.navigate('Share')}>
                            <Ionicons name="share-social-outline" size={24} color="#FFFFFF" />
                        </Pressable>
                    </View>
                    <View>
                        <Pressable style={styles.iconBtn} onPress={() => navigation.navigate('Stats')}>
                            <Ionicons name="stats-chart" size={22} color="#FFFFFF" />
                        </Pressable>
                    </View>
                    <View>
                        <Pressable style={styles.iconBtn} onPress={() => navigation.navigate('AddHabit')}>
                            <Ionicons name="add" size={30} color="#FFFFFF" />
                        </Pressable>
                    </View>
                </View>
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={colors.primaryStart}
                    />
                }
            >
                {/* Level Progress (Subtle integration) */}
                <Animated.View entering={FadeInUp.delay(500)}>
                    <LevelProgress
                        level={levelInfo.level}
                        currentXp={levelInfo.currentXp}
                        xpNeeded={levelInfo.xpNeeded}
                        totalXp={userStats.totalXp}
                    />
                </Animated.View>

                <View style={{ height: 10 }} />

                {/* Habits Section */}
                <View style={styles.section}>
                    {habits.length === 0 ? (
                        <Animated.View
                            entering={FadeInUp.delay(600)}
                            style={styles.emptyState}
                        >
                            <Text style={styles.emptyIcon}>🎯</Text>
                            <Text style={styles.emptyTitle}>No habits yet</Text>
                            <Text style={styles.emptyText}>
                                Start building better habits today!
                            </Text>
                            <Pressable
                                style={styles.emptyButton}
                                onPress={() => navigation.navigate('AddHabit')}
                            >
                                <LinearGradient
                                    colors={[...colors.primary]}
                                    style={styles.emptyButtonGradient}
                                >
                                    <Text style={styles.emptyButtonText}>Add Your First Habit</Text>
                                </LinearGradient>
                            </Pressable>
                        </Animated.View>
                    ) : (
                        habits.map((habit) => (
                            <View key={habit.id}>
                                <HabitCard
                                    habit={habit}
                                    onToggle={handleToggle}
                                    onIncrement={handleIncrement}
                                    onPress={handleEdit}
                                />
                            </View>
                        ))
                    )}
                </View>

                {/* Bottom spacing - reduced since no tab bar */}
                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.bgDark,
    },
    loadingContainer: {
        flex: 1,
        backgroundColor: colors.bgDark,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: spacing.md,
        paddingTop: 10,
    },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.md,
        paddingTop: 60,
        paddingBottom: spacing.md,
    },
    brandTitle: {
        ...typography.h2,
        color: colors.textPrimary,
        fontWeight: '900',
        fontSize: 22,
    },
    topRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    iconBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    section: {
        marginTop: 0,
    },
    emptyState: {
        alignItems: 'center',
        padding: spacing.xxl,
        backgroundColor: 'rgba(255,255,255,0.02)',
        borderRadius: borderRadius.lg,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    emptyIcon: {
        fontSize: 48,
        marginBottom: spacing.md,
    },
    emptyTitle: {
        ...typography.h3,
        color: colors.textPrimary,
        marginBottom: spacing.xs,
    },
    emptyText: {
        ...typography.body,
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: spacing.lg,
    },
    emptyButton: {
        borderRadius: borderRadius.md,
        overflow: 'hidden',
    },
    emptyButtonGradient: {
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.lg,
    },
    emptyButtonText: {
        ...typography.bodyBold,
        color: colors.textPrimary,
    },
});
