import React, { useLayoutEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useHabits } from '../context/HabitContext';
import { useI18n } from '../context/I18nContext';
import { useTheme } from '../context/ThemeContext';
import { spacing, borderRadius, typography } from '../theme';
import HabitCalendar from '../components/HabitCalendar';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { triggerHaptic, triggerSelectionHaptic, triggerNotificationHaptic, FeedbackType, ImpactStyle } from '../utils/feedback';
import ConfirmationModal from '../components/ConfirmationModal';

type Props = NativeStackScreenProps<RootStackParamList, 'HabitDetail'>;

import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function HabitDetailScreen({ route, navigation }: Props) {
    const { habitId } = route.params;
    const { habits, deleteHabit, toggleHabitCompletion } = useHabits();
    const { t } = useI18n();
    const { colors } = useTheme();
    const styles = useMemo(() => getStyles(colors), [colors]);

    const habit = habits.find(h => h.id === habitId);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const insets = useSafeAreaInsets();

    useLayoutEffect(() => {
        navigation.setOptions({
            headerShown: false,
        });
    }, [navigation]);

    if (!habit) {
        return (
            <View style={styles.container}>
                <Text style={{ color: colors.textPrimary }}>Habit not found.</Text>
            </View>
        );
    }

    const themeColor = colors.habitColors[habit.colorIndex]?.[0] || colors.primaryStart;

    return (
        <View style={styles.container}>
            {/* Custom Header */}
            <View style={[styles.customHeader, { paddingTop: insets.top + spacing.sm }]}>
                <Pressable
                    onPress={() => navigation.goBack()}
                    style={({ pressed }) => [
                        styles.headerBackBtn,
                        pressed && { opacity: 0.7 }
                    ]}
                >
                    <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
                </Pressable>

                <View style={styles.headerActions}>
                    <Pressable
                        onPress={() => {
                            triggerHaptic(ImpactStyle.Medium);
                            setShowDeleteModal(true);
                        }}
                        style={({ pressed }) => [
                            styles.headerBtn,
                            pressed && { opacity: 0.6 }
                        ]}
                    >
                        <Ionicons name="trash-outline" size={20} color={colors.dangerStart || '#EF4444'} />
                    </Pressable>

                    <Pressable
                        onPress={() => {
                            triggerSelectionHaptic();
                            navigation.navigate('EditHabit', { habitId: habit.id });
                        }}
                        style={({ pressed }) => [
                            styles.headerBtn,
                            pressed && { opacity: 0.6 }
                        ]}
                    >
                        <Ionicons name="pencil" size={20} color={colors.textPrimary} />
                    </Pressable>
                </View>
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {/* Header Card */}
                <View style={styles.headerCard}>
                    <View style={[styles.iconBox, { backgroundColor: themeColor + '20' }]}>
                        <Text style={styles.icon}>{habit.icon}</Text>
                    </View>
                    <View style={styles.headerInfo}>
                        <Text style={styles.title}>{habit.name}</Text>
                        {habit.description ? (
                            <Text style={styles.description}>{habit.description}</Text>
                        ) : null}
                        <Text style={styles.frequency}>
                            {habit.frequency === 'daily' ? 'Daily Goal' : 'Weekly Goal'}: {habit.dailyTarget}
                        </Text>
                    </View>
                </View>

                {/* Main Stats (Streak, Total) */}
                <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                        <Text style={[styles.statValue, { color: themeColor }]}>{habit.streak}🔥</Text>
                        <Text style={styles.statLabel}>Current Streak</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>
                            {Object.keys(habit.completions).filter(k => habit.completions[k] >= habit.dailyTarget).length}
                        </Text>
                        <Text style={styles.statLabel}>Total Completions</Text>
                    </View>
                </View>

                {/* Calendar Section */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>HISTORY</Text>
                    </View>
                    <HabitCalendar
                        habit={habit}
                        onToggle={(date) => toggleHabitCompletion(habit.id, date)}
                    />
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>

            <ConfirmationModal
                visible={showDeleteModal}
                title="Delete Habit?"
                message={`Are you sure you want to delete "${habit.name}"? This will permanently erase all your progress and streaks.`}
                confirmLabel="Yes, Delete Habit"
                cancelLabel="Cancel"
                type="danger"
                onConfirm={async () => {
                    setShowDeleteModal(false);
                    triggerNotificationHaptic(FeedbackType.Success);
                    await deleteHabit(habit.id);
                    navigation.goBack();
                }}
                onCancel={() => setShowDeleteModal(false)}
            />
        </View>
    );
}


const getStyles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.bgDark,
    },
    content: {
        padding: spacing.md,
        paddingTop: spacing.md,
    },
    customHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.md,
        paddingBottom: spacing.sm,
        backgroundColor: colors.bgDark,
        zIndex: 10,
    },
    headerBackBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    headerActions: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    headerCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.bgCard,
        padding: spacing.lg,
        borderRadius: borderRadius.lg,
        marginBottom: spacing.md,
    },
    iconBox: {
        width: 60,
        height: 60,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: spacing.md,
    },
    icon: {
        fontSize: 30,
    },
    headerInfo: {
        flex: 1,
    },
    title: {
        ...typography.h3,
        color: colors.textPrimary,
        marginBottom: 4,
    },
    description: {
        ...typography.caption,
        color: colors.textSecondary,
        marginBottom: 4,
    },
    frequency: {
        ...typography.caption,
        color: colors.textMuted,
        textTransform: 'uppercase',
        fontSize: 10,
        letterSpacing: 1,
    },
    headerBtn: {
        padding: 8,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    statsRow: {
        flexDirection: 'row',
        backgroundColor: colors.bgCard,
        borderRadius: borderRadius.lg,
        padding: spacing.md,
        marginBottom: spacing.xl,
        justifyContent: 'space-around',
        alignItems: 'center',
    },
    statItem: {
        alignItems: 'center',
    },
    statValue: {
        ...typography.h2,
        color: colors.textPrimary,
        marginBottom: 4,
    },
    statLabel: {
        ...typography.caption,
        color: colors.textMuted,
    },
    statDivider: {
        width: 1,
        height: '60%',
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    section: {
        marginBottom: spacing.lg,
    },
    sectionHeader: {
        marginBottom: spacing.sm,
        paddingHorizontal: spacing.sm,
    },
    sectionTitle: {
        ...typography.small,
        color: colors.textMuted,
        letterSpacing: 1.5,
    },
});
