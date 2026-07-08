import React from 'react';
import { useHabits } from '../context/HabitContext';
import { useI18n } from '../context/I18nContext';
import { useTheme } from '../context/ThemeContext';
import HabitForm, { HabitFormValues } from '../components/HabitForm';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';

type AddHabitScreenProps = NativeStackScreenProps<RootStackParamList, 'AddHabit'>;

export default function AddHabitScreen({ navigation }: AddHabitScreenProps) {
    const { addHabit, habits } = useHabits();
    const { t } = useI18n();
    const { colors } = useTheme();

    // Auto-cycle colour: next colour based on existing habit count.
    const autoColor = habits.length % colors.habitColors.length;

    const handleSubmit = async (values: HabitFormValues) => {
        await addHabit({ ...values, goal: 0 });
        navigation.goBack();
    };

    return (
        <HabitForm
            title={t.nav.addHabit}
            subtitle={t.home.startBuilding}
            submitLabel={t.habit.createHabit}
            submitVariant="create"
            defaultColorIndex={autoColor}
            onBack={() => navigation.navigate('Home')}
            onSubmit={handleSubmit}
        />
    );
}
