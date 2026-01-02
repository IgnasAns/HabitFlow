import { Habit } from '../types';
import { colors } from '../theme';

export interface SuggestedHabit {
    name: string;
    icon: string;
    colorIndex: number;
    category: 'morning' | 'evening' | 'health' | 'productivity' | 'fitness';
    goal?: number; // Total lifetime goal
    dailyTarget?: number; // Daily count goal
}

export const suggestedHabits: SuggestedHabit[] = [
    // Morning Routine
    {
        name: 'Wake up before 7:00 AM',
        icon: '☀️',
        colorIndex: 6,
        category: 'morning',
        dailyTarget: 1,
    },
    {
        name: 'Brush teeth (morning)',
        icon: '🪥',
        colorIndex: 3,
        category: 'morning',
        dailyTarget: 1,
    },
    {
        name: 'Morning exercise',
        icon: '🏃',
        colorIndex: 1,
        category: 'morning',
        dailyTarget: 1,
    },

    // Deep Work
    {
        name: '1st Deep Work Session (4h)',
        icon: '🧠',
        colorIndex: 0,
        category: 'productivity',
        dailyTarget: 1,
    },
    {
        name: '2nd Deep Work Session (4h)',
        icon: '💻',
        colorIndex: 0,
        category: 'productivity',
        dailyTarget: 1,
    },

    // Fitness
    {
        name: '100 Pushups',
        icon: '💪',
        colorIndex: 2,
        category: 'fitness',
        dailyTarget: 100,
    },
    {
        name: '30 min HIIT',
        icon: '🔥',
        colorIndex: 5,
        category: 'fitness',
        dailyTarget: 1,
    },

    // Evening Routine
    {
        name: 'Brush teeth (evening)',
        icon: '🪥',
        colorIndex: 3,
        category: 'evening',
        dailyTarget: 1,
    },
    {
        name: 'Go to sleep before 11:00 PM',
        icon: '🌙',
        colorIndex: 5,
        category: 'evening',
        dailyTarget: 1,
    },

    // Health
    {
        name: 'Drink 8 glasses of water',
        icon: '💧',
        colorIndex: 5,
        category: 'health',
        dailyTarget: 8,
    },
    {
        name: 'Take vitamins',
        icon: '💊',
        colorIndex: 4,
        category: 'health',
        dailyTarget: 1,
    },
    {
        name: 'Meditation (10 min)',
        icon: '🧘',
        colorIndex: 7,
        category: 'health',
        dailyTarget: 1,
    },
    {
        name: 'Read for 30 minutes',
        icon: '📚',
        colorIndex: 6,
        category: 'productivity',
        dailyTarget: 1,
    },
    {
        name: 'Language Learning (3h)',
        icon: '🎧',
        colorIndex: 0,
        category: 'productivity',
        dailyTarget: 3,
    },
    {
        name: 'No phone after 10 PM',
        icon: '📱',
        colorIndex: 4,
        category: 'evening',
        dailyTarget: 1,
    },
];

// Get default habits for first-time users
export const getDefaultHabits = (): SuggestedHabit[] => {
    return [...suggestedHabits];
};

export default suggestedHabits;
