import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export async function registerForPushNotificationsAsync() {
    let token;
    // On Android, we should always check/request, even on emulators
    // if (Device.isDevice) { // <--- REMOVED this check which fails on emulators
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
    // }

    if (Platform.OS === 'android') {
        Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
        });
    }

    // If we are on emulator or token failed but permissions granted, return a dummy token so the app knows it's allowed
    return token || (finalStatus === 'granted' ? 'emulator-token' : undefined);
}

export async function scheduleDailyReminder(hour: number = 20, minute: number = 0) {
    if (Platform.OS === 'web') return;

    await Notifications.cancelAllScheduledNotificationsAsync();

    const messages = [
        { title: "Time to build habits! 🎯", body: "Check in and complete your daily habits to maintain your streak." },
        { title: "Keep the streak alive! 🔥", body: "Don't break the chain. Do your habits today!" },
        { title: "Invest in yourself 🌱", body: "Small daily actions lead to big results. You got this!" },
        { title: "Ready to level up? 🚀", body: "Complete your habits and gain XP towards your next level." },
        { title: "You are doing great! 💪", body: "Consistency is key. Provide your daily update now." },
    ];
    const randomMessage = messages[Math.floor(Math.random() * messages.length)];

    await Notifications.scheduleNotificationAsync({
        content: {
            title: randomMessage.title,
            body: randomMessage.body,
            data: { data: 'reminder' },
        },
        trigger: {
            type: 'calendar',
            hour: hour,
            minute: minute,
            repeats: true,
        } as Notifications.CalendarTriggerInput,
    });
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

    await Notifications.scheduleNotificationAsync({
        content: {
            title: "Notifications are working! 🎉",
            body: 'You are all set to receive smart daily reminders.',
        },
        trigger: {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: 5,
            repeats: false,
        },
    });
}
