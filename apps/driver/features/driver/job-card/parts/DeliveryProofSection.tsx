import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Camera, Paperclip } from 'lucide-react-native';
import Layout from '@pulse/core/constants/Layout';
import { getDriverThemeColors } from '@pulse/ui/contexts/DriverThemeContext';
import {
  DELIVERY_PLACE_CODES,
  MAX_STOP_PROOF_PHOTOS,
  PICKUP_PLACE_CODES,
  canSubmitDeliveryProof,
  stopProofPlaceLabel,
  type DeliveryProofDraft,
  type StopProofKind,
  type StopProofPlaceCode,
} from '@pulse/domain/features/driver/job-card/deliveryProof';
import {
  pickStopProofImage,
  type StopProofImageSource,
} from '../pickStopProofImage';

type Colors = ReturnType<typeof getDriverThemeColors>;

type Props = {
  colors: Colors;
  kind?: StopProofKind;
  draft: DeliveryProofDraft;
  readOnly?: boolean;
  error?: string | null;
  onChange: (next: DeliveryProofDraft) => void;
};

export function DeliveryProofSection({
  colors,
  kind = 'delivery',
  draft,
  readOnly,
  error,
  onChange,
}: Props) {
  const [picking, setPicking] = useState<StopProofImageSource | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);
  const pickup = kind === 'pickup';
  const places: StopProofPlaceCode[] = pickup
    ? [...PICKUP_PLACE_CODES, 'other']
    : [...DELIVERY_PLACE_CODES, 'other'];
  const canAddPhoto = draft.photoUris.length < MAX_STOP_PROOF_PHOTOS;

  const addPhoto = async (source: StopProofImageSource) => {
    if (readOnly || picking || !canAddPhoto) return;
    setPicking(source);
    setPickError(null);
    try {
      const uri = await pickStopProofImage(source);
      if (uri) onChange({ ...draft, photoUris: [...draft.photoUris, uri] });
    } catch (err) {
      setPickError(err instanceof Error ? err.message : 'Could not add photo');
    } finally {
      setPicking(null);
    }
  };

  return (
    <View style={styles.wrap} testID="delivery-proof">
      <Text style={[styles.section, { color: colors.textMuted }]}>
        {pickup ? 'Proof of pickup' : 'Proof of delivery'}
      </Text>
      <Text style={[styles.hint, { color: colors.textMuted }]}>
        {pickup
          ? 'Photo of the collected load, or where you picked it up.'
          : 'Photo or where you left the order.'}
      </Text>
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        {places.map((code) => {
          const selected = draft.place === code;
          return (
            <Pressable
              key={code}
              disabled={readOnly}
              onPress={() => onChange({ ...draft, place: selected ? null : code })}
              accessibilityRole="button"
              accessibilityLabel={stopProofPlaceLabel(kind, code)}
              accessibilityState={{ selected }}
              style={[
                styles.chip,
                {
                  borderColor: selected ? colors.emerald : colors.border,
                  backgroundColor: selected ? colors.emeraldMuted : colors.surface,
                },
              ]}
            >
              <Text style={[styles.chipText, { color: selected ? colors.emerald : colors.text }]}>
                {stopProofPlaceLabel(kind, code)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {draft.place === 'other' && !readOnly ? (
        <TextInput
          testID="delivery-proof-note"
          value={draft.placeNote}
          onChangeText={(placeNote) => onChange({ ...draft, placeNote })}
          placeholder={pickup ? 'Where did you collect it?' : 'Where did you leave it?'}
          placeholderTextColor={colors.textMuted}
          style={[styles.note, { color: colors.text, borderColor: colors.border }]}
        />
      ) : null}

      <View style={styles.photos}>
        {draft.photoUris.map((uri) => (
          <Image
            key={uri}
            source={{ uri }}
            style={styles.thumb}
            accessibilityLabel={pickup ? 'Pickup photo' : 'Delivery photo'}
          />
        ))}
        {readOnly || !canAddPhoto ? null : (
          <>
            <Pressable
              onPress={() => void addPhoto('camera')}
              disabled={picking != null}
              accessibilityRole="button"
              accessibilityLabel="Capture proof with camera"
              hitSlop={Layout.touchTargetHitSlop}
              style={[styles.iconBtn, { borderColor: colors.border }]}
            >
              <Camera size={14} color={colors.emerald} strokeWidth={2.4} />
              <Text style={[styles.iconBtnText, { color: colors.emerald }]}>
                {picking === 'camera' ? '…' : 'Camera'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => void addPhoto('library')}
              disabled={picking != null}
              accessibilityRole="button"
              accessibilityLabel="Attach proof photo"
              hitSlop={Layout.touchTargetHitSlop}
              style={[styles.iconBtn, { borderColor: colors.border }]}
            >
              <Paperclip size={14} color={colors.emerald} strokeWidth={2.4} />
              <Text style={[styles.iconBtnText, { color: colors.emerald }]}>
                {picking === 'library' ? '…' : 'Attach'}
              </Text>
            </Pressable>
          </>
        )}
      </View>
      {error || pickError ? (
        <Text style={[styles.error, { color: colors.text }]} accessibilityRole="alert">
          {error ?? pickError}
        </Text>
      ) : !readOnly && !canSubmitDeliveryProof(draft) ? (
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          {pickup
            ? 'Choose how you collected it or add a photo to confirm.'
            : 'Choose a drop location or add a photo to confirm.'}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  section: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  hint: {
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 15,
  },
  chips: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingRight: 4,
  },
  chip: {
    height: 32,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
  },
  chipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  note: {
    minHeight: Layout.minTouchTargetSize,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 10,
    fontSize: 13,
  },
  photos: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  iconBtn: {
    height: 32,
    minWidth: 88,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  iconBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  error: {
    fontSize: 12,
    fontWeight: '600',
  },
});
