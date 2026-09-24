import Theme from '@pulse/core/constants/Theme';
import { Minus, Plus } from 'lucide-react-native';
import { Platform, StyleSheet, TouchableOpacity, View } from 'react-native';

type Props = {
  onZoomIn: () => void;
  onZoomOut: () => void;
  disabled?: boolean;
};

export function LeafletMapZoomControls({ onZoomIn, onZoomOut, disabled }: Props) {
  return (
    <View style={styles.column} pointerEvents="box-none">
      <TouchableOpacity
        style={[styles.btn, disabled && styles.btnDisabled]}
        onPress={onZoomIn}
        disabled={disabled}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Zoom in"
      >
        <Plus size={18} color={Theme.text} strokeWidth={2.5} />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.btn, disabled && styles.btnDisabled]}
        onPress={onZoomOut}
        disabled={disabled}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Zoom out"
      >
        <Minus size={18} color={Theme.text} strokeWidth={2.5} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    position: 'absolute',
    right: 12,
    bottom: Platform.OS === 'web' ? 72 : 56,
    zIndex: 20,
    gap: 8,
    alignItems: 'center',
  },
  btn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Theme.surface,
    borderWidth: 1,
    borderColor: Theme.border,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 2px 10px rgba(15,23,42,0.14)' as const }
      : null),
  },
  btnDisabled: {
    opacity: 0.45,
  },
});
