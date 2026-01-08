import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure how notifications are handled when app is in foreground
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

export async function registerForPushNotificationsAsync() {
    let token;
    // On Android, we should always check/request, even on emulators
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }
    if (finalStatus !== 'granted') {
        return;
    }
    // Only get token for actual push notifications if needed, but for local notifications just permission is enough
    try {
        token = (await Notifications.getExpoPushTokenAsync()).data;
    } catch (e) {
        console.log('Error getting push token (expected on emulator):', e);
    }

    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
            name: 'Daily Reminders',
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
            sound: 'default',
            enableVibrate: true,
            showBadge: true,
        });
    }

    // If we are on emulator or token failed but permissions granted, return a dummy token so the app knows it's allowed
    return token || (finalStatus === 'granted' ? 'emulator-token' : undefined);
}

/**
 * Calculate seconds until the next occurrence of a specific time (hour:minute)
 */
function getSecondsUntilTime(hour: number, minute: number): number {
    const now = new Date();
    const target = new Date();
    target.setHours(hour, minute, 0, 0);

    // If the target time has already passed today, schedule for tomorrow
    if (target <= now) {
        target.setDate(target.getDate() + 1);
    }

    return Math.floor((target.getTime() - now.getTime()) / 1000);
}

export interface NotificationMessage {
    title: string;
    body: string;
}

export interface NotificationTranslations {
    reminder1: NotificationMessage;
    reminder2: NotificationMessage;
    reminder3: NotificationMessage;
    reminder4: NotificationMessage;
    reminder5: NotificationMessage;
}

// Default English messages (fallback)
const defaultMessages: NotificationMessage[] = [
    { title: "Time to build habits! 🎯", body: "Check in and complete your daily habits to maintain your streak." },
    { title: "Keep the streak alive! 🔥", body: "Don't break the chain. Do your habits today!" },
    { title: "Invest in yourself 🌱", body: "Small daily actions lead to big results. You got this!" },
    { title: "Ready to level up? 🚀", body: "Complete your habits and gain XP towards your next level." },
    { title: "You're doing great! 💪", body: "Consistency is key. Check in now." },
];

export async function scheduleDailyReminder(
    hour: number = 20,
    minute: number = 0,
    translations?: NotificationTranslations
) {
    if (Platform.OS === 'web') return;

    // Cancel all existing scheduled notifications first
    await Notifications.cancelAllScheduledNotificationsAsync();

    // Use translated messages if provided, otherwise use defaults
    const messages: NotificationMessage[] = translations
        ? [translations.reminder1, translations.reminder2, translations.reminder3, translations.reminder4, translations.reminder5]
        : defaultMessages;

    const randomMessage = messages[Math.floor(Math.random() * messages.length)];

    try {
        if (Platform.OS === 'ios') {
            // iOS: Use CALENDAR trigger (works on iOS)
            await Notifications.scheduleNotificationAsync({
                content: {
                    title: randomMessage.title,
                    body: randomMessage.body,
                    data: { data: 'reminder' },
                    sound: 'default',
                },
                trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
                    hour: hour,
                    minute: minute,
                    repeats: true,
                },
            });
        } else {
            // Android: Use DAILY trigger type which is specifically for daily repeating notifications
            await Notifications.scheduleNotificationAsync({
                content: {
                    title: randomMessage.title,
                    body: randomMessage.body,
                    data: { data: 'reminder', hour, minute },
                    sound: 'default',
                },
                trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.DAILY,
                    hour: hour,
                    minute: minute,
                    channelId: 'default',
                },
            });
        }

        console.log(`Scheduled daily reminder for ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);

        // Debug: Log scheduled notifications
        const scheduled = await Notifications.getAllScheduledNotificationsAsync();
        console.log('Currently scheduled notifications:', scheduled.length);

    } catch (error) {
        console.error('Failed to schedule notification:', error);

        // Fallback: Try using TIME_INTERVAL if DAILY fails (for older Expo versions)
        try {
            const secondsUntil = getSecondsUntilTime(hour, minute);
            await Notifications.scheduleNotificationAsync({
                content: {
                    title: randomMessage.title,
                    body: randomMessage.body,
                    data: { data: 'reminder', hour, minute, needsReschedule: true },
                    sound: 'default',
                    ...(Platform.OS === 'android' && { channelId: 'default' }),
                },
                trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
                    seconds: secondsUntil,
                    repeats: false, // We'll reschedule on receive
                    ...(Platform.OS === 'android' && { channelId: 'default' }),
                },
            });
            console.log(`Scheduled fallback notification in ${secondsUntil} seconds`);
        } catch (fallbackError) {
            console.error('Fallback scheduling also failed:', fallbackError);
        }
    }
}

export async function cancelReminders() {
    if (Platform.OS === 'web') return;
    await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function scheduleTestNotification() {
    if (Platform.OS === 'web') {
        alert('Notifications not supported on web');
        return;
    }

    try {
        await Notifications.scheduleNotificationAsync({
            content: {
                title: "Notifications are working! 🎉",
                body: 'You are all set to receive smart daily reminders.',
                sound: 'default',
                ...(Platform.OS === 'android' && { channelId: 'default' }),
            },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
                seconds: 3,
                repeats: false,
                ...(Platform.OS === 'android' && { channelId: 'default' }),
            },
        });
        console.log('Test notification scheduled for 3 seconds');
    } catch (error) {
        console.error('Failed to schedule test notification:', error);
    }
}

/**
 * Debug function to check scheduled notifications
 */
export async function getScheduledNotifications() {
    return await Notifications.getAllScheduledNotificationsAsync();
}
