import Theme from '@pulse/core/constants/Theme';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import React, { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  style?: ViewStyle;
  inputProps?: Omit<TextInputProps, 'value' | 'onChangeText' | 'placeholder'>;
};

export function SearchBar({ value, onChangeText, placeholder = 'Search...', style, inputProps }: Props) {
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);

  const chromeFix = useMemo(
    () =>
      Platform.OS === 'web'
        ? ({
            outlineStyle: 'none',
            outlineWidth: 0,
            outlineColor: 'transparent',
            boxShadow: 'none',
          } as const)
        : null,
    [],
  );

  const borderColor = focused
    ? 'rgba(16,185,129,0.55)'
    : hovered
      ? 'rgba(148,163,184,0.5)'
      : 'rgba(226,232,240,0.9)';

  const bg = focused ? 'rgba(255,255,255,0.92)' : 'rgba(248,250,252,0.78)';

  return (
    <Pressable
      onPress={() => {}}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={[
        styles.wrap,
        { backgroundColor: bg, borderColor },
        focused && styles.wrapFocused,
        style,
      ]}
    >
      <View style={styles.iconWrap}>
        <FontAwesome name="search" size={16} color={Theme.textMuted} />
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Theme.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        selectionColor={Theme.driverEmerald}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[styles.input, chromeFix as object]}
        {...inputProps}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 24,
    paddingHorizontal: 16,
    minHeight: 54,
  },
  wrapFocused: {
    shadowColor: 'rgba(16,185,129,0.35)',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 6,
  },
  iconWrap: {
    width: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    minWidth: 0,
    fontSize: 16,
    fontWeight: '600',
    color: Theme.textPrimary,
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
});

