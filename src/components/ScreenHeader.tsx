import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { spacing, borderRadius, typography } from '../theme';
import { triggerHaptic } from '../utils/feedback';

interface ScreenHeaderProps {
    title: string;
    subtitle?: string;
    onBack: () => void;
    rightElement?: React.ReactNode;
}

export default function ScreenHeader({ title, subtitle, onBack, rightElement }: ScreenHeaderProps) {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();

    const handleBack = () => {
        triggerHaptic();
        onBack();
    };

    return (
        <View style={[styles.container, { paddingTop: Math.max(insets.top, 20) + spacing.sm }]}>
            <View style={styles.headerRow}>
                {/* Back Button - Large and prominent */}
                <Pressable
                    onPress={handleBack}
                    style={({ pressed }) => [
                        styles.backButton,
                        { backgroundColor: colors.glass, borderColor: colors.glassBorder },
                        pressed && styles.backButtonPressed,
                    ]}
                    hitSlop={10}
                >
                    <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
                </Pressable>

                {/* Title Section */}
                <View style={styles.titleContainer}>
                    <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
                    {subtitle && (
                        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
                    )}
                </View>

                {/* Right Element (optional) */}
                <View style={styles.rightSection}>
                    {rightElement}
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: spacing.md,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    backButtonPressed: {
        opacity: 0.7,
        transform: [{ scale: 0.95 }],
    },
    titleContainer: {
        flex: 1,
    },
    title: {
        ...typography.h1,
        fontSize: 24,
        fontWeight: '800',
    },
    subtitle: {
        ...typography.body,
        fontSize: 14,
        marginTop: 2,
    },
    rightSection: {
        minWidth: 44, // Match back button width for balance
    },
});
