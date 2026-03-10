import React from 'react';
import {
  Text,
  View,
  ScrollView,
  Switch,
  Pressable,
  Platform,
  StyleSheet,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useStyleFn, useTheme } from 'react-native-stylefn';

// =============================================================================
// Example: Dark Mode Toggle
// =============================================================================

function DarkModeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <View
      style={(t) => ({
        flexDirection: 'row' as const,
        justifyContent: 'space-between' as const,
        alignItems: 'center' as const,
        padding: t.theme.spacing[4],
        backgroundColor: t.colors.surface,
        borderRadius: t.theme.borderRadius.lg,
        marginBottom: t.theme.spacing[3],
      })}
    >
      <Text
        style={(t) => ({
          fontSize: t.theme.fontSize.lg,
          fontWeight: t.theme.fontWeight.semibold,
          color: t.colors.text,
        })}
      >
        Dark Mode
      </Text>
      <Switch value={theme} onValueChange={toggleTheme} />
    </View>
  );
}

// =============================================================================
// Example: Responsive Card
// =============================================================================

function ResponsiveCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <View
      style={(t) => ({
        backgroundColor: t.colors.surface,
        borderRadius: t.theme.borderRadius.lg,
        padding: t.breakpoint === 'lg' || t.breakpoint === 'xl' ? 24 : 16,
        marginBottom: t.theme.spacing[3],
        borderWidth: 1,
        borderColor: t.colors.border,
      })}
    >
      <Text
        style={(t) => ({
          fontSize:
            t.breakpoint === 'xl'
              ? t.theme.fontSize['2xl']
              : t.theme.fontSize.lg,
          fontWeight: t.theme.fontWeight.bold,
          color: t.colors.text,
          marginBottom: t.theme.spacing[2],
        })}
      >
        {title}
      </Text>
      <Text
        style={(t) => ({
          fontSize: t.theme.fontSize.base,
          color: t.colors['text-muted'],
          lineHeight: 20,
        })}
      >
        {description}
      </Text>
    </View>
  );
}

// =============================================================================
// Example: Orientation-Aware Layout
// =============================================================================

function OrientationDemo() {
  return (
    <View
      style={(t) => ({
        flexDirection: t.orientation === 'landscape' ? 'row' as const : 'column' as const,
        gap: t.theme.spacing[3],
        marginBottom: t.theme.spacing[3],
      })}
    >
      <View
        style={(t) => ({
          flex: 1,
          backgroundColor: t.theme.colors.primary,
          padding: t.theme.spacing[4],
          borderRadius: t.theme.borderRadius.md,
        })}
      >
        <Text
          style={{
            color: '#fff',
            fontSize: 14,
            fontWeight: '600',
          }}
        >
          {`I'm on the ${Platform.OS} platform`}
        </Text>
      </View>
      <View
        style={(t) => ({
          flex: 1,
          backgroundColor: t.theme.colors.secondary,
          padding: t.theme.spacing[4],
          borderRadius: t.theme.borderRadius.md,
        })}
      >
        <Text
          style={{
            color: '#fff',
            fontSize: 14,
            fontWeight: '600',
          }}
        >
          Rotates with orientation
        </Text>
      </View>
    </View>
  );
}

// =============================================================================
// Example: Accessibility Tokens
// =============================================================================

function AccessibilityDemo() {
  const { reducedMotion, fontScale, boldText } = useStyleFn();

  return (
    <View
      style={(t) => ({
        backgroundColor: t.colors.surface,
        borderRadius: t.theme.borderRadius.lg,
        padding: t.theme.spacing[4],
        marginBottom: t.theme.spacing[3],
        borderWidth: 1,
        borderColor: t.colors.border,
      })}
    >
      <Text
        style={(t) => ({
          fontSize: t.theme.fontSize.base,
          color: t.colors.text,
          fontWeight: t.theme.fontWeight.semibold,
          marginBottom: t.theme.spacing[2],
        })}
      >
        Accessibility
      </Text>
      <Text
        style={(t) => ({
          fontSize: t.theme.fontSize.sm,
          color: t.colors['text-muted'],
          marginBottom: 4,
        })}
      >
        Reduced Motion: {reducedMotion ? 'Yes' : 'No'}
      </Text>
      <Text
        style={(t) => ({
          fontSize: t.theme.fontSize.sm,
          color: t.colors['text-muted'],
          marginBottom: 4,
        })}
      >
        Font Scale: {fontScale.toFixed(2)}×
      </Text>
      <Text
        style={(t) => ({
          fontSize: t.theme.fontSize.sm,
          color: t.colors['text-muted'],
        })}
      >
        Bold Text: {boldText ? 'Yes' : 'No'}
      </Text>
    </View>
  );
}

// =============================================================================
// Example: Mixed Array Styles
// =============================================================================

function ArrayStyleDemo() {
  return (
    <View
      style={[
        { marginBottom: 12 },
        (t) => ({
          backgroundColor: t.colors.surface,
          borderRadius: t.theme.borderRadius.lg,
          padding: t.theme.spacing[4],
          borderWidth: 1,
          borderColor: t.colors.border,
        }),
      ]}
    >
      <Text
        style={[
          { fontWeight: '600' as const },
          (t) => ({
            fontSize: t.theme.fontSize.base,
            color: t.colors.text,
          }),
        ]}
      >
        Mixed Array Styles ✓
      </Text>
      <Text
        style={(t) => ({
          fontSize: t.theme.fontSize.sm,
          color: t.colors['text-muted'],
          marginTop: 4,
        })}
      >
        This card uses array styles mixing static objects and token functions
      </Text>
    </View>
  );
}

// =============================================================================
// Example: Token Info Bar
// =============================================================================

function TokenInfoBar() {
  const { breakpoint, orientation, platform, screen, colorScheme } =
    useStyleFn();

  return (
    <View
      style={(t) => ({
        flexDirection: 'row' as const,
        flexWrap: 'wrap' as const,
        gap: 8,
        marginBottom: t.theme.spacing[4],
      })}
    >
      {[
        { label: 'Breakpoint', value: breakpoint },
        { label: 'Orientation', value: orientation },
        { label: 'Platform', value: platform },
        { label: 'Screen', value: `${Math.round(screen.width)}×${Math.round(screen.height)}` },
        { label: 'Theme', value: colorScheme },
      ].map((item) => (
        <View
          key={item.label}
          style={(t) => ({
            backgroundColor: t.dark ? '#1e293b' : '#e2e8f0',
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: t.theme.borderRadius.md,
          })}
        >
          <Text
            style={(t) => ({
              fontSize: t.theme.fontSize.xs,
              color: t.colors['text-muted'],
            })}
          >
            {item.label}
          </Text>
          <Text
            style={(t) => ({
              fontSize: t.theme.fontSize.sm,
              color: t.colors.text,
              fontWeight: t.theme.fontWeight.semibold,
            })}
          >
            {item.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

// =============================================================================
// Example: Color Palette
// =============================================================================

function ColorPalette() {
  const { theme } = useStyleFn();
  console.log({ theme })
  const colorEntries = Object.entries(theme.colors);

  return (
    <View
      style={(t) => ({
        marginBottom: t.theme.spacing[3],
      })}
    >
      <Text
        style={(t) => ({
          fontSize: t.theme.fontSize.lg,
          fontWeight: t.theme.fontWeight.bold,
          color: t.colors.text,
          marginBottom: t.theme.spacing[2],
        })}
      >
        Theme Colors
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {colorEntries.map(([name, color]) => (
          <Pressable
            key={name}
            style={{
              alignItems: 'center' as const,
              minWidth: 80,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: color,
                marginBottom: 4,
              }}
            />
            <Text
              style={(t) => ({
                fontSize: t.theme.fontSize.xs,
                color: t.colors['text-muted'],
              })}
            >
              {name}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// =============================================================================
// Example: StyleSheet.create with Style Functions
// =============================================================================

// StyleSheet.create is patched at import time by react-native-stylefn —
// style functions work directly. `t` is automatically typed as StyleTokens.
const sheetStyles = StyleSheet.create({
  // Dynamic — style functions resolved at render time
  card: (t) => ({
    backgroundColor: t.colors.surface,
    borderRadius: t.theme.borderRadius.lg,
    padding: t.theme.spacing[4],
    marginBottom: t.theme.spacing[3],
    borderWidth: 1,
    borderColor: t.colors.border,
  }),
  cardTitle: (t) => ({
    fontSize: t.theme.fontSize.base,
    fontWeight: t.theme.fontWeight.semibold,
    color: t.colors.text,
    marginBottom: t.theme.spacing[1],
  }),
  cardDescription: (t) => ({
    fontSize: t.theme.fontSize.sm,
    color: t.colors['text-muted'],
  }),
  // Static — processed normally by StyleSheet.create
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#3b82f6',
    alignSelf: 'flex-start' as const,
    marginTop: 8,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600' as const,
  },
});

function StyleSheetDemo() {
  return (
    <View style={sheetStyles.card}>
      <Text style={sheetStyles.cardTitle}>
        StyleSheet.create ✓
      </Text>
      <Text style={sheetStyles.cardDescription}>
        StyleSheet.create is patched to accept style functions. Static styles
        use StyleSheet.create normally. Dynamic functions resolve at render time.
      </Text>
      <View style={sheetStyles.badge}>
        <Text style={sheetStyles.badgeText}>STATIC BADGE</Text>
      </View>
    </View>
  );
}

// =============================================================================
// Example: Reanimated Animated Styles with Tokens
// =============================================================================

function AnimatedStyleDemo() {
  const { colors, theme, dark, reducedMotion } = useStyleFn();

  // Shared values for animations
  const scale = useSharedValue(1);
  const rotation = useSharedValue(0);
  const translateY = useSharedValue(0);

  // Bounce animation on press
  const handlePress = () => {
    scale.value = withSpring(0.9, { damping: 4, stiffness: 200 }, () => {
      scale.value = withSpring(1);
    });
  };

  // Continuous floating animation (respects reducedMotion)
  React.useEffect(() => {
    if (reducedMotion) {
      translateY.value = 0;
      rotation.value = 0;
      return;
    }

    translateY.value = withRepeat(
      withTiming(-8, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );

    rotation.value = withRepeat(
      withTiming(5, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [reducedMotion, translateY, rotation]);

  // Animated card style — uses tokens for colors/spacing
  const animatedCardStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateY: translateY.value },
      { rotate: `${rotation.value}deg` },
    ],
  }));

  // Animated gradient bar
  const progress = useSharedValue(0);

  React.useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 2000, easing: Easing.linear }),
      -1,
      true
    );
  }, [progress]);

  const animatedBarStyle = useAnimatedStyle(() => ({
    width: `${30 + progress.value * 70}%`,
  }));

  return (
    <View
      style={(t) => ({
        marginBottom: t.theme.spacing[3],
      })}
    >
      <Text
        style={(t) => ({
          fontSize: t.theme.fontSize.lg,
          fontWeight: t.theme.fontWeight.bold,
          color: t.colors.text,
          marginBottom: t.theme.spacing[2],
        })}
      >
        Reanimated + Tokens ✓
      </Text>

      {/* Animated bouncing card */}
      <Pressable onPress={handlePress}>
        <Animated.View
          style={[
            {
              backgroundColor: dark ? '#1e293b' : colors.surface,
              borderRadius: theme.borderRadius.lg,
              padding: theme.spacing[4],
              marginBottom: theme.spacing[3],
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: 'center' as const,
            },
            animatedCardStyle,
          ]}
        >
          <Text
            style={{
              fontSize: 32,
              marginBottom: theme.spacing[2],
            }}
          >
            🎯
          </Text>
          <Text
            style={{
              fontSize: theme.fontSize.base,
              fontWeight: theme.fontWeight.semibold,
              color: colors.text,
              marginBottom: theme.spacing[1],
            }}
          >
            Tap me! I bounce with spring
          </Text>
          <Text
            style={{
              fontSize: theme.fontSize.sm,
              color: colors['text-muted'],
              textAlign: 'center' as const,
            }}
          >
            useAnimatedStyle + useStyleFn() tokens{'\n'}
            {reducedMotion ? '(reduced motion — no float)' : '(floating animation active)'}
          </Text>
        </Animated.View>
      </Pressable>

      {/* Animated progress bar using theme colors */}
      <View
        style={{
          backgroundColor: dark ? '#1e293b' : colors.surface,
          borderRadius: theme.borderRadius.lg,
          padding: theme.spacing[4],
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Text
          style={{
            fontSize: theme.fontSize.sm,
            fontWeight: theme.fontWeight.semibold,
            color: colors.text,
            marginBottom: theme.spacing[2],
          }}
        >
          Animated Progress Bar
        </Text>
        <View
          style={{
            height: 8,
            backgroundColor: dark ? '#334155' : '#e2e8f0',
            borderRadius: theme.borderRadius.full,
            overflow: 'hidden' as const,
          }}
        >
          <Animated.View
            style={[
              {
                height: '100%',
                backgroundColor: theme.colors.primary,
                borderRadius: theme.borderRadius.full,
              },
              animatedBarStyle,
            ]}
          />
        </View>
        <Text
          style={{
            fontSize: theme.fontSize.xs,
            color: colors['text-muted'],
            marginTop: theme.spacing[1],
          }}
        >
          Animated.View with theme.colors.primary
        </Text>
      </View>
    </View>
  );
}

// =============================================================================
// Example: Custom Components with Style Functions
// =============================================================================

/**
 * A custom Card component that accepts a style function,
 * resolves it, shows the generated style as text, then
 * passes it to the native View.
 */
function StyledCard({
  title,
  style,
  children,
}: {
  title: string;
  style?: ((t: any) => any) | object;
  children?: React.ReactNode;
}) {
  const tokens = useStyleFn();

  // Resolve the style: if it's a function, call it with tokens
  const resolvedStyle =
    typeof style === 'function' ? style(tokens) : style ?? {};

  return (
    <View
      style={(t) => ({
        marginBottom: t.theme.spacing[3],
      })}
    >
      {/* The actual native component with the resolved style */}
      <View style={resolvedStyle}>
        <Text
          style={{
            fontSize: tokens.theme.fontSize.base,
            fontWeight: tokens.theme.fontWeight.bold,
            color: tokens.colors.text,
            marginBottom: tokens.theme.spacing[2],
          }}
        >
          {title}
        </Text>
        {children}
      </View>

      {/* Debug: show the generated style as JSON */}
      <View
        style={{
          marginTop: 8,
          backgroundColor: tokens.dark ? '#0f172a' : '#f1f5f9',
          borderRadius: tokens.theme.borderRadius.md,
          padding: tokens.theme.spacing[3],
        }}
      >
        <Text
          style={{
            fontSize: tokens.theme.fontSize.xs,
            fontWeight: tokens.theme.fontWeight.semibold,
            color: tokens.colors['text-muted'],
            marginBottom: 4,
          }}
        >
          Generated Style:
        </Text>
        <Text
          style={{
            fontSize: 10,
            fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
            color: tokens.dark ? '#93c5fd' : '#3b82f6',
          }}
        >
          {JSON.stringify(resolvedStyle, null, 2)}
        </Text>
      </View>
    </View>
  );
}

/**
 * A custom Text component that resolves style functions internally.
 */
function StyledText({
  style,
  children,
}: {
  style?: ((t: any) => any) | object;
  children: React.ReactNode;
}) {
  const tokens = useStyleFn();
  const resolvedStyle =
    typeof style === 'function' ? style(tokens) : style ?? {};

  return <Text style={resolvedStyle}>{children}</Text>;
}

function CustomComponentDemo() {
  return (
    <View
      style={(t) => ({
        marginBottom: t.theme.spacing[3],
      })}
    >
      <Text
        style={(t) => ({
          fontSize: t.theme.fontSize.lg,
          fontWeight: t.theme.fontWeight.bold,
          color: t.colors.text,
          marginBottom: t.theme.spacing[2],
        })}
      >
        Custom Components ✓
      </Text>

      {/* Custom card with style function */}
      <StyledCard
        title="StyledCard"
        style={(t) => ({
          backgroundColor: t.colors.surface,
          borderRadius: t.theme.borderRadius.lg,
          padding: t.theme.spacing[4],
          borderWidth: 1,
          borderColor: t.colors.border,
        })}
      >
        <StyledText
          style={(t) => ({
            fontSize: t.theme.fontSize.sm,
            color: t.colors['text-muted'],
          })}
        >
          This card resolves style functions internally via useStyleFn(),
          shows the generated style JSON, then passes it to the native View.
        </StyledText>
      </StyledCard>

      {/* Same component with a different style */}
      <StyledCard
        title="Breakpoint-Aware Card"
        style={(t) => ({
          backgroundColor: t.dark ? '#1e293b' : '#eff6ff',
          borderRadius: t.theme.borderRadius.xl,
          padding: t.breakpoint === 'xl' ? 32 : t.theme.spacing[4],
          borderWidth: 2,
          borderColor: t.theme.colors.primary,
        })}
      >
        <StyledText
          style={(t) => ({
            fontSize: t.theme.fontSize.sm,
            color: t.dark ? '#93c5fd' : '#1d4ed8',
          })}
        >
          Breakpoint: {'{t.breakpoint}'} → padding changes at xl
        </StyledText>
      </StyledCard>
    </View>
  );
}

// =============================================================================
// Main App
// =============================================================================

function AppContent() {
  return (
    <ScrollView
      style={(t) => ({
        flex: 1,
        backgroundColor: t.colors.background,
      })}
      contentContainerStyle={(t) => {
        console.log({ t })
        return{
          padding: t.theme.spacing[4],
          paddingTop: t.insets.top + t.theme.spacing[4],
          paddingBottom: t.insets.bottom + t.theme.spacing[6],
        }
      }}
    >
      <Text
        style={(t) => ({
          fontSize: t.theme.fontSize['3xl'],
          fontWeight: t.theme.fontWeight.bold,
          color: t.colors.text,
          marginBottom: t.theme.spacing[1],
        })}
      >
        react-native-stylefn
      </Text>
      <Text
        style={(t) => ({
          fontSize: t.theme.fontSize.base,
          color: t.colors['text-muted'],
          marginBottom: t.theme.spacing[5],
        })}
      >
        Tailwind-inspired style functions for React Native
      </Text>

      <TokenInfoBar />
      <DarkModeToggle />
      <ColorPalette />
      <OrientationDemo />
      <ResponsiveCard
        title="Responsive Card"
        description="This card adjusts its padding and font sizes based on the current breakpoint. Try resizing your screen or rotating your device."
      />
      <AccessibilityDemo />
      <AnimatedStyleDemo />
      <CustomComponentDemo />
      <ArrayStyleDemo />
      <StyleSheetDemo />
    </ScrollView>
  );
}

export default function App() {
  return <AppContent />;
}
