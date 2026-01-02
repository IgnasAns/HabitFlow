import React, { useLayoutEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useHabits } from '../context/HabitContext';
import { colors, spacing, borderRadius, typography } from '../theme';
import HabitCalendar from '../components/HabitCalendar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'HabitDetail'>;

export default function HabitDetailScreen({ route, navigation }: Props) {
    const { habitId } = route.params;
    const { habits, toggleHabitCompletion } = useHabits();
    const habit = habits.find(h => h.id === habitId);

    useLayoutEffect(() => {
        if (habit) {
            navigation.setOptions({
                title: '', // Custom header title
                headerRight: () => (
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                        <Pressable
                            onPress={() => navigation.navigate('EditHabit', { habitId: habit.id })}
                            style={styles.headerBtn}
                        >
                            <Ionicons name="pencil" size={20} color={colors.textPrimary} />
                        </Pressable>
                        <Pressable
                            onPress={() => navigation.goBack()}
                            style={styles.headerBtn}
                        >
                            <Ionicons name="close" size={24} color={colors.textPrimary} />
                        </Pressable>
                    </View>
                ),
                headerLeft: () => null, // Remove default back button if we use custom close
                // Since it's a modal (likely), default might be good.
                // But I'll stick to standard navigation if 'presentation: modal' is set.
            });
        }
    }, [navigation, habit]);

    if (!habit) {
        return (
            <View style={styles.container}>
                <Text style={{ color: colors.textPrimary }}>Habit not found.</Text>
            </View>
        );
    }

    const themeColor = colors.habitColors[habit.colorIndex]?.[0] || colors.primaryStart;

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
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
                    <Text style={styles.statValue}>{Object.keys(habit.completions).length}</Text>
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
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.bgDark,
    },
    content: {
        padding: spacing.md,
        paddingTop: 100,
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
