import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    RefreshControl,
    ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
    FadeInUp,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useHabits } from '../context/HabitContext';
import { colors, spacing, borderRadius, typography } from '../theme';
import HabitCard from '../components/HabitCard';
import LevelProgress from '../components/LevelProgress';
import ConfettiOverlay from '../components/ConfettiOverlay';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import DraggableFlatList, { ScaleDecorator, RenderItemParams } from 'react-native-draggable-flatlist';
import { Habit } from '../types';

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
        reorderHabits,
    } = useHabits();

    const [showConfetti, setShowConfetti] = useState(false);
    const [confettiType, setConfettiType] = useState<'completion' | 'levelUp' | 'streak'>('completion');
    const [refreshing, setRefreshing] = useState(false);

    // Stable handlers for HabitCard performance
    const handleToggle = useCallback((id: string, dateKey?: string) => {
        toggleHabitCompletion(id, dateKey);
    }, [toggleHabitCompletion]);

    const handleIncrement = useCallback((id: string, amount: number, dateKey?: string) => {
        incrementHabitProgress(id, amount, dateKey);
    }, [incrementHabitProgress]);

    const handleEdit = useCallback((id: string) => {
        navigation.navigate('EditHabit', { habitId: id });
    }, [navigation]);

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

    const renderItem = useCallback(({ item, drag, isActive }: RenderItemParams<Habit>) => {
        return (
            <ScaleDecorator activeScale={1.05}>
                <View style={{ marginBottom: 0 }}>
                    <HabitCard
                        habit={item}
                        onToggle={handleToggle}
                        onIncrement={handleIncrement}
                        onPress={handleEdit}
                        drag={drag}
                        isActive={isActive}
                    />
                </View>
            </ScaleDecorator>
        );
    }, [handleToggle, handleIncrement, handleEdit]);

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primaryStart} />
            </View>
        );
    }

    return (
        <GestureHandlerRootView style={styles.container}>
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

                {/* Draggable List */}
                <DraggableFlatList
                    data={habits}
                    onDragEnd={({ data }) => reorderHabits(data)}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor={colors.primaryStart}
                        />
                    }
                    ListHeaderComponent={
                        <View style={{ marginBottom: 10 }}>
                            <Animated.View entering={FadeInUp.delay(500)}>
                                <LevelProgress
                                    level={levelInfo.level}
                                    currentXp={levelInfo.currentXp}
                                    xpNeeded={levelInfo.xpNeeded}
                                    totalXp={userStats.totalXp}
                                />
                            </Animated.View>
                        </View>
                    }
                    ListEmptyComponent={
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
                    }
                    ListFooterComponent={<View style={{ height: 40 }} />}
                />
            </View>
        </GestureHandlerRootView>
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
    emptyState: {
        alignItems: 'center',
        marginTop: 20,
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
