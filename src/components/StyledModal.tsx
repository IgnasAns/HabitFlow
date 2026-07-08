import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useTheme, ThemeColors } from '../context/ThemeContext';
import { spacing, borderRadius, typography } from '../theme';
import { triggerSelectionHaptic } from '../utils/feedback';

interface StyledModalProps {
    visible: boolean;
    title: string;
    message: string;
    emoji?: string;
    onClose: () => void;
    buttonText?: string;
}

export default function StyledModal({
    visible,
    title,
    message,
    emoji,
    onClose,
    buttonText = 'Got it'
}: StyledModalProps) {
    const { colors } = useTheme();
    const styles = useMemo(() => getStyles(colors), [colors]);

    const handleClose = () => {
        triggerSelectionHaptic();
        onClose();
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <Pressable style={styles.overlay} onPress={handleClose}>
                <Animated.View
                    entering={FadeIn.duration(200)}
                    exiting={FadeOut.duration(150)}
                    style={styles.container}
                >
                    <Pressable onPress={(e) => e.stopPropagation()}>
                        <View style={styles.content}>
                            {/* Header with gradient accent */}
                            <LinearGradient
                                colors={[colors.primaryStart, colors.primaryEnd]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.headerAccent}
                            />

                            {emoji && (
                                <View style={styles.emojiContainer}>
                                    <Text style={styles.emoji}>{emoji}</Text>
                                </View>
                            )}

                            <Text style={styles.title}>{title}</Text>
                            <Text style={styles.message}>{message}</Text>

                            <Pressable
                                style={({ pressed }) => [
                                    styles.button,
                                    pressed && styles.buttonPressed
                                ]}
                                onPress={handleClose}
                            >
                                <LinearGradient
                                    colors={[colors.primaryStart, colors.primaryEnd]}
                                    style={styles.buttonGradient}
                                >
                                    <Text style={styles.buttonText}>{buttonText}</Text>
                                </LinearGradient>
                            </Pressable>
                        </View>
                    </Pressable>
                </Animated.View>
            </Pressable>
        </Modal>
    );
}


const getStyles = (colors: ThemeColors) => StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.lg,
    },
    container: {
        width: '100%',
        maxWidth: 340,
    },
    content: {
        backgroundColor: colors.bgCard,
        borderRadius: borderRadius.xl,
        padding: spacing.xl,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.glassBorder,
        overflow: 'hidden',
        // Shadow for depth
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 10,
        },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    headerAccent: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 4,
    },
    emojiContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(255,255,255,0.05)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.md,
        marginTop: spacing.sm,
    },
    emoji: {
        fontSize: 32,
    },
    title: {
        ...typography.h3,
        color: colors.textPrimary,
        textAlign: 'center',
        marginBottom: spacing.sm,
    },
    message: {
        ...typography.body,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: spacing.xl,
    },
    button: {
        width: '100%',
        borderRadius: borderRadius.md,
        overflow: 'hidden',
    },
    buttonPressed: {
        opacity: 0.9,
        transform: [{ scale: 0.98 }],
    },
    buttonGradient: {
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.xl,
        alignItems: 'center',
    },
    buttonText: {
        ...typography.bodyBold,
        color: colors.textPrimary,
    },
});
