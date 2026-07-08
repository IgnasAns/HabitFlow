import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { triggerHaptic, triggerSelectionHaptic, triggerNotificationHaptic, FeedbackType, ImpactStyle } from '../utils/feedback';
import { useHabits } from '../context/HabitContext';
import { useI18n, interpolate } from '../context/I18nContext';
import { useTheme, ThemeColors } from '../context/ThemeContext';
import { spacing, borderRadius, typography } from '../theme';
import StreakBadge from '../components/StreakBadge';
import ConfirmationModal from '../components/ConfirmationModal';
import HabitCalendar from '../components/HabitCalendar';
import HabitForm, { HabitFormValues, HabitFormLiveState } from '../components/HabitForm';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';

type EditHabitScreenProps = NativeStackScreenProps<RootStackParamList, 'EditHabit'>;

export default function EditHabitScreen({ route, navigation }: EditHabitScreenProps) {
    const { habitId } = route.params;
    const { habits, updateHabit, deleteHabit } = useHabits();
    const { t } = useI18n();
    const { colors } = useTheme();
    const styles = useMemo(() => getStyles(colors), [colors]);

    const habit = habits.find(h => h.id === habitId);

    // Calendar edits are staged locally and persisted on save.
    const [completions, setCompletions] = useState(habit?.completions || {});
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    useEffect(() => {
        if (!habit) navigation.goBack();
    }, [habit]);

    if (!habit) return null;

    const completedCount = Object.keys(habit.completions).filter(
        k => habit.completions[k] >= (habit.dailyTarget || 1)
    ).length;

    const handleSubmit = async (values: HabitFormValues) => {
        await updateHabit(habitId, { ...values, completions });
        navigation.goBack();
    };

    const toggleCalendarDay = (dateKey: string) => {
        const current = completions[dateKey] || 0;
        const effectiveTarget = habit.frequency === 'weekly' ? 1 : habit.dailyTarget;
        const next = { ...completions };
        if (current >= effectiveTarget) {
            delete next[dateKey];
        } else {
            next[dateKey] = effectiveTarget;
        }
        setCompletions(next);
        triggerSelectionHaptic();
    };

    return (
        <>
            <HabitForm
                title={t.nav.editHabit}
                submitLabel={t.habit.saveChanges}
                submitVariant="save"
                initialValues={{
                    name: habit.name,
                    description: habit.description,
                    icon: habit.icon,
                    colorIndex: habit.colorIndex,
                    frequency: habit.frequency === 'weekly' ? 'weekly' : 'daily',
                    dailyTarget: habit.dailyTarget,
                    timeSlot: habit.timeSlot,
                }}
                onBack={() => navigation.navigate('Home')}
                onSubmit={handleSubmit}
                headerExtra={
                    <View style={styles.statsRow}>
                        <StreakBadge streak={habit.streak} size="medium" />
                        <Text style={styles.statsText}>
                            {interpolate(t.stats.completionsCount, { count: completedCount })}
                        </Text>
                    </View>
                }
                renderAboveFields={(state: HabitFormLiveState) => (
                    <View style={styles.calendarWrap}>
                        <HabitCalendar
                            habit={{ ...habit, colorIndex: state.selectedColor, completions }}
                            onToggle={toggleCalendarDay}
                        />
                    </View>
                )}
                belowFields={
                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: colors.dangerStart }]}>
                            {t.habit.dangerZone}
                        </Text>
                        <Pressable
                            style={({ pressed }) => [styles.deleteButton, pressed && { opacity: 0.7 }]}
                            onPress={() => {
                                triggerHaptic(ImpactStyle.Medium);
                                setShowDeleteModal(true);
                            }}
                        >
                            <Text style={styles.deleteButtonText}>{t.habit.deleteHabit}</Text>
                        </Pressable>
                    </View>
                }
            />

            <ConfirmationModal
                visible={showDeleteModal}
                title={t.confirm.deleteTitle}
                message={interpolate(t.confirm.deleteMessage, { name: habit.name })}
                confirmLabel={t.habit.deleteHabit}
                cancelLabel={t.common.cancel}
                type="danger"
                onConfirm={async () => {
                    setShowDeleteModal(false);
                    triggerNotificationHaptic(FeedbackType.Success);
                    await deleteHabit(habitId);
                    navigation.goBack();
                }}
                onCancel={() => setShowDeleteModal(false)}
            />
        </>
    );
}

const getStyles = (colors: ThemeColors) => StyleSheet.create({
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        marginTop: spacing.sm,
    },
    statsText: {
        ...typography.caption,
        color: colors.textSecondary,
    },
    calendarWrap: {
        marginBottom: spacing.lg,
    },
    section: {
        marginBottom: spacing.lg,
    },
    sectionTitle: {
        ...typography.bodyBold,
        color: colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 1,
        fontSize: 12,
        marginBottom: spacing.sm,
    },
    deleteButton: {
        padding: spacing.md,
        backgroundColor: 'rgba(255, 107, 107, 0.1)',
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: 'rgba(255, 107, 107, 0.3)',
        alignItems: 'center',
    },
    deleteButtonText: {
        ...typography.bodyBold,
        color: colors.dangerStart,
    },
});
