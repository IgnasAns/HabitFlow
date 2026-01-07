import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

// State to cache settings in memory for performance
let isHapticsEnabled = true;
let isSoundEnabled = true;

// Initialize settings from storage
export const initFeedbackSettings = async () => {
    try {
        const storedSettings = await AsyncStorage.getItem('app_settings');
        if (storedSettings) {
            const parsed = JSON.parse(storedSettings);
            isHapticsEnabled = parsed.hapticsEnabled ?? true;
            isSoundEnabled = parsed.soundEnabled ?? true;
        }
    } catch (e) {
        console.warn('Failed to load feedback settings', e);
    }
};

// Update cached settings (call this when saving settings)
export const updateFeedbackSettings = (haptics: boolean, sound: boolean) => {
    isHapticsEnabled = haptics;
    isSoundEnabled = sound;
};

// Haptic helpers
export const triggerHaptic = (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Medium) => {
    if (isHapticsEnabled) {
        Haptics.impactAsync(style).catch(() => { });
    }
};

export const triggerSelectionHaptic = () => {
    if (isHapticsEnabled) {
        Haptics.selectionAsync().catch(() => { });
    }
};
// Re-export Haptics types for convenience
export const FeedbackType = Haptics.NotificationFeedbackType;
export const ImpactStyle = Haptics.ImpactFeedbackStyle;

export const triggerNotificationHaptic = (type: Haptics.NotificationFeedbackType) => {
    if (isHapticsEnabled) {
        Haptics.notificationAsync(type).catch(() => { });
    }
};

// Sound helpers
// Simple sound mapping for now
const SOUNDS = {
    // Add sound files here if we had them. For now, we stub this or use system sounds if possible.
    // Expo AV requires requiring assets.
};

export const playSound = async (soundName: string) => {
    if (isSoundEnabled) {
        // Implementation would play sound file
        // try {
        //    const { sound } = await Audio.Sound.createAsync(require('./path/to/sound.mp3'));
        //    await sound.playAsync();
        // } catch (e) {}
    }
};
