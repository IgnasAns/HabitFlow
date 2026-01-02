import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    Pressable,
} from 'react-native';

import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
    FadeIn,
    FadeInDown,
    FadeOut,
    FadeOutDown,
    Layout
} from 'react-native-reanimated';
import { colors, spacing, borderRadius, typography, shadows } from '../theme';
import { Ionicons } from '@expo/vector-icons';

interface ConfirmationModalProps {
    visible: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    cancelLabel: string;
    onConfirm: () => void;
    onCancel: () => void;
    type?: 'danger' | 'info';
}

export default function ConfirmationModal({
    visible,
    title,
    message,
    confirmLabel,
    cancelLabel,
    onConfirm,
    onCancel,
    type = 'info'
}: ConfirmationModalProps) {
    const confirmColors = type === 'danger' ? [...colors.danger] : [...colors.primary];
    const iconName = type === 'danger' ? 'alert-circle' : 'information-circle';
    const iconColor = type === 'danger' ? colors.dangerStart : colors.primaryStart;

    return (
        <Modal
            transparent
            visible={visible}
            animationType="none"
            onRequestClose={onCancel}
        >
            <View style={styles.overlay}>
                <Animated.View
                    entering={FadeIn}
                    exiting={FadeOut}
                    style={StyleSheet.absoluteFill}
                >
                    <Pressable style={styles.backdrop} onPress={onCancel} />
                </Animated.View>

                <Animated.View
                    entering={FadeIn.duration(150)}
                    exiting={FadeOut.duration(100)}
                    style={styles.modalContainer}
                >
                    <View style={styles.content}>
                        <View style={[styles.iconContainer, { backgroundColor: iconColor + '15' }]}>
                            <Ionicons name={iconName} size={32} color={iconColor} />
                        </View>

                        <Text style={styles.title}>{title}</Text>
                        <Text style={styles.message}>{message}</Text>

                        <View style={styles.buttons}>
                            <Pressable
                                style={({ pressed }) => [
                                    styles.cancelBtn,
                                    pressed && { opacity: 0.7 }
                                ]}
                                onPress={onCancel}
                            >
                                <Text style={styles.cancelText}>{cancelLabel}</Text>
                            </Pressable>

                            <Pressable
                                style={({ pressed }) => [
                                    styles.confirmBtn,
                                    pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] }
                                ]}
                                onPress={onConfirm}
                            >
                                <LinearGradient
                                    colors={confirmColors as any}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.gradient}
                                >
                                    <Text style={styles.confirmText}>{confirmLabel}</Text>
                                </LinearGradient>
                            </Pressable>
                        </View>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
    },
    modalContainer: {
        width: '85%',
        maxWidth: 400,
        backgroundColor: colors.bgCard,
        borderRadius: 32,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        ...shadows.card,
    },
    content: {
        padding: spacing.xl,
        alignItems: 'center',
    },
    iconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    title: {
        ...typography.h2,
        color: colors.textPrimary,
        textAlign: 'center',
        marginBottom: spacing.sm,
    },
    message: {
        ...typography.body,
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: spacing.xl,
        lineHeight: 22,
    },
    buttons: {
        flexDirection: 'row',
        gap: spacing.md,
        width: '100%',
    },
    cancelBtn: {
        flex: 1,
        height: 52,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
    cancelText: {
        ...typography.bodyBold,
        color: colors.textSecondary,
    },
    confirmBtn: {
        flex: 2,
        height: 52,
        borderRadius: 16,
        overflow: 'hidden',
    },
    gradient: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    confirmText: {
        ...typography.bodyBold,
        color: colors.textPrimary,
    },
});
