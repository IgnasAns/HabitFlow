
export interface SuggestedHabit {
    nameKey: string; // Translation key for the habit name
    name: string; // Default name (English) for fallback
    icon: string;
    colorIndex: number;
    category: 'morning' | 'evening' | 'health' | 'productivity' | 'fitness';
    goal?: number; // Total lifetime goal
    dailyTarget?: number; // Daily count goal
}

// Core habits ordered by time of day (morning to evening)
// These are the essential habits for a productive, healthy lifestyle
export const suggestedHabits: SuggestedHabit[] = [
    // Morning - Start the day right
    {
        nameKey: 'habits.wakeUpEarly',
        name: 'Wake up before 7am',
        icon: '☀️',
        colorIndex: 6, // Gold/Yellow - morning sunshine
        category: 'morning',
        dailyTarget: 1,
    },

    // Productivity - Deep work
    {
        nameKey: 'habits.workSession',
        name: 'Work session (4h)',
        icon: '💻',
        colorIndex: 0, // Purple - focus/productivity
        category: 'productivity',
        dailyTarget: 4, // Can track hours or just 1 for completion
    },

    // Fitness - Stay active
    {
        nameKey: 'habits.goToGym',
        name: 'Go to the gym',
        icon: '🏋️',
        colorIndex: 2, // Red/Orange - energy/fitness
        category: 'fitness',
        dailyTarget: 1,
    },

    // Health - Hydration
    {
        nameKey: 'habits.drinkWater',
        name: 'Drink 8 glasses of water',
        icon: '💧',
        colorIndex: 5, // Blue - water/calm
        category: 'health',
        dailyTarget: 8,
    },

    // Productivity - Reading
    {
        nameKey: 'habits.read30min',
        name: 'Read for 30 minutes',
        icon: '📚',
        colorIndex: 1, // Green - growth/learning
        category: 'productivity',
        dailyTarget: 1,
    },

    // Evening - Digital wellness
    {
        nameKey: 'habits.noPhoneAfter10',
        name: 'No phone after 10pm',
        icon: '📵',
        colorIndex: 4, // Pink - calm/digital detox
        category: 'evening',
        dailyTarget: 1,
    },

    // Evening - Sleep hygiene
    {
        nameKey: 'habits.sleepBefore11',
        name: 'Go to sleep before 11pm',
        icon: '🌙',
        colorIndex: 7, // Indigo - night/sleep
        category: 'evening',
        dailyTarget: 1,
    },
];

// Get default habits for first-time users
export const getDefaultHabits = (): SuggestedHabit[] => {
    return [...suggestedHabits];
};

export default suggestedHabits;
