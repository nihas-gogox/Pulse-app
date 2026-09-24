import { memo, useMemo, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
} from 'react-native';
import { UploadCloud } from 'lucide-react-native';

import type { PresetAvatar } from '@pulse/core/constants/DriverLevels';
import { SignUpBrandingStepLayout } from './SignUpBrandingStepLayout';
import { PULSE_SIGNUP_RADIUS, type SignUpTheme } from '@pulse/domain/features/auth/signup/signUpPulseTheme';
import { PULSE_SIGNUP } from '@pulse/domain/features/auth/signup/signUpPulseTheme';
import { createPulseSignUpTextStyles } from '@pulse/domain/features/auth/signup/signUpTypography';

/** Fixed rows; columns grow sideways for horizontal swipe. */
const AVATAR_CAROUSEL_ROWS = 5;
const AVATAR_CELL = 56;
const AVATAR_GAP = Platform.OS === 'web' ? 8 : 10;

export interface SignUpPhotoPickerStepProps {
  title: string;
  subtitle?: string | ReactNode;
  previewUri?: string | null;
  previewImage?: ImageSourcePropType;
  previewFallback?: ReactNode;
  presetAvatars?: readonly PresetAvatar[];
  selectedPresetSeed?: string | null;
  onPresetSelect?: (seed: string) => void;
  onUpload: () => void;
  uploading?: boolean;
  uploadLabel?: string;
  primaryLabel?: string;
  onPrimary: () => void;
  primaryLoading?: boolean;
  onSkip?: () => void;
  skipLabel?: string;
  theme?: SignUpTheme;
}

function chunkIntoColumns<T>(items: readonly T[], rows: number): T[][] {
  if (items.length === 0 || rows <= 0) return [];
  const cols: T[][] = [];
  for (let i = 0; i < items.length; i += 1) {
    const colIndex = Math.floor(i / rows);
    if (!cols[colIndex]) cols[colIndex] = [];
    cols[colIndex]!.push(items[i]!);
  }
  return cols;
}

const AvatarPresetCarousel = memo(function AvatarPresetCarousel({
  presetAvatars,
  selectedPresetSeed,
  onPresetSelect,
  styles,
}: {
  presetAvatars: readonly PresetAvatar[];
  selectedPresetSeed?: string | null;
  onPresetSelect: (seed: string) => void;
  styles: ReturnType<typeof createStyles>;
}) {
  const columns = useMemo(
    () => chunkIntoColumns(presetAvatars, AVATAR_CAROUSEL_ROWS),
    [presetAvatars],
  );

  return (
    <>
      <View style={styles.gridLabelRow}>
        <Text style={styles.gridLabel}>Or choose a preset</Text>
        <Text style={styles.gridHint}>Swipe →</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={Platform.OS === 'web'}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.carouselContent}
        style={styles.carousel}
        accessibilityLabel="Avatar presets, swipe sideways"
      >
        {columns.map((col, colIndex) => (
          <View key={`col-${colIndex}`} style={styles.avatarCol}>
            {col.map((av) => {
              const selected = selectedPresetSeed === av.seed;
              return (
                <Pressable
                  key={av.seed}
                  onPress={() => onPresetSelect(av.seed)}
                  style={[styles.gridItem, selected && styles.gridItemSelected]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={av.name}
                >
                  <Image
                    source={av.image}
                    style={styles.gridImage}
                    resizeMode="cover"
                  />
                </Pressable>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </>
  );
});

export const SignUpPhotoPickerStep = memo(function SignUpPhotoPickerStep({
  title,
  subtitle,
  previewUri,
  previewImage,
  previewFallback,
  presetAvatars,
  selectedPresetSeed,
  onPresetSelect,
  onUpload,
  uploading = false,
  uploadLabel = 'Upload from gallery',
  primaryLabel = 'Continue',
  onPrimary,
  primaryLoading = false,
  onSkip,
  skipLabel = 'Skip for now',
  theme = PULSE_SIGNUP,
}: SignUpPhotoPickerStepProps) {
  const styles = createStyles(theme);

  return (
    <SignUpBrandingStepLayout
      title={title}
      subtitle={subtitle}
      primaryLabel={primaryLabel}
      onPrimary={onPrimary}
      primaryLoading={primaryLoading}
      onSkip={onSkip}
      skipLabel={skipLabel}
      theme={theme}
    >
      <View style={styles.previewWrap}>
        {previewUri ? (
          <Image
            key={previewUri}
            source={{ uri: previewUri }}
            style={styles.previewImage}
            resizeMode="cover"
          />
        ) : previewImage ? (
          <Image source={previewImage} style={styles.previewImage} resizeMode="contain" />
        ) : (
          previewFallback ?? <View style={styles.previewPlaceholder} />
        )}
      </View>

      <Pressable
        onPress={onUpload}
        disabled={uploading}
        style={({ pressed }) => [
          styles.uploadBtn,
          uploading && styles.uploadBtnDisabled,
          pressed && !uploading && styles.uploadBtnPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={uploadLabel}
      >
        {uploading ? (
          <ActivityIndicator color={theme.primary} size="small" />
        ) : (
          <>
            <UploadCloud size={18} color={theme.primary} strokeWidth={2.5} />
            <Text style={styles.uploadText}>{uploadLabel}</Text>
          </>
        )}
      </Pressable>

      {presetAvatars && presetAvatars.length > 0 && onPresetSelect ? (
        <AvatarPresetCarousel
          presetAvatars={presetAvatars}
          selectedPresetSeed={selectedPresetSeed}
          onPresetSelect={onPresetSelect}
          styles={styles}
        />
      ) : null}
    </SignUpBrandingStepLayout>
  );
});

/** Body-only picker for driver signup scroll pages. */
export const SignUpPhotoPickerBody = memo(function SignUpPhotoPickerBody({
  previewUri,
  previewImage,
  previewFallback,
  presetAvatars,
  selectedPresetSeed,
  onPresetSelect,
  onUpload,
  uploading = false,
  uploadLabel = 'Upload photo',
  theme = PULSE_SIGNUP,
}: Omit<
  SignUpPhotoPickerStepProps,
  'onPrimary' | 'primaryLabel' | 'primaryLoading' | 'onSkip' | 'skipLabel'
>) {
  const styles = createStyles(theme);

  return (
    <View style={styles.body}>
      <View style={styles.previewWrap}>
        {previewUri ? (
          <Image
            key={previewUri}
            source={{ uri: previewUri }}
            style={styles.previewImage}
            resizeMode="cover"
          />
        ) : previewImage ? (
          <Image source={previewImage} style={styles.previewImage} resizeMode="contain" />
        ) : (
          previewFallback ?? <View style={styles.previewPlaceholder} />
        )}
      </View>
      <Pressable
        onPress={onUpload}
        disabled={uploading}
        style={({ pressed }) => [
          styles.uploadBtn,
          uploading && styles.uploadBtnDisabled,
          pressed && !uploading && styles.uploadBtnPressed,
        ]}
      >
        {uploading ? (
          <ActivityIndicator color={theme.primary} size="small" />
        ) : (
          <>
            <UploadCloud size={18} color={theme.primary} strokeWidth={2.5} />
            <Text style={styles.uploadText}>{uploadLabel}</Text>
          </>
        )}
      </Pressable>
      {presetAvatars && presetAvatars.length > 0 && onPresetSelect ? (
        <AvatarPresetCarousel
          presetAvatars={presetAvatars}
          selectedPresetSeed={selectedPresetSeed}
          onPresetSelect={onPresetSelect}
          styles={styles}
        />
      ) : null}
    </View>
  );
});

function createStyles(theme: SignUpTheme) {
  const text = createPulseSignUpTextStyles(theme);
  const colHeight =
    AVATAR_CELL * AVATAR_CAROUSEL_ROWS + AVATAR_GAP * (AVATAR_CAROUSEL_ROWS - 1);

  return StyleSheet.create({
    body: {
      width: '100%',
    },
    previewWrap: {
      alignSelf: 'center',
      width: Platform.OS === 'web' ? 96 : 128,
      height: Platform.OS === 'web' ? 96 : 128,
      borderRadius: PULSE_SIGNUP_RADIUS.card,
      overflow: 'hidden',
      borderWidth: 2,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      marginBottom: Platform.OS === 'web' ? 12 : 20,
    },
    previewImage: {
      width: '100%',
      height: '100%',
    },
    previewPlaceholder: {
      flex: 1,
      backgroundColor: theme.primaryTint,
    },
    uploadBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      paddingVertical: Platform.OS === 'web' ? 10 : 14,
      borderRadius: PULSE_SIGNUP_RADIUS.button,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.bg,
      marginBottom: Platform.OS === 'web' ? 12 : 20,
    },
    uploadBtnDisabled: {
      opacity: 0.6,
    },
    uploadBtnPressed: {
      backgroundColor: theme.surface,
    },
    uploadText: {
      ...text.linkSmall,
      color: theme.primaryDark,
      fontWeight: '600',
    },
    gridLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
      gap: 8,
    },
    gridLabel: {
      ...text.fieldLabel,
      marginBottom: 0,
      flex: 1,
    },
    gridHint: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.muted,
      letterSpacing: 0.2,
    },
    carousel: {
      width: '100%',
      maxHeight: colHeight + 4,
      marginBottom: 8,
    },
    carouselContent: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: AVATAR_GAP,
      paddingRight: 4,
      paddingBottom: 4,
    },
    avatarCol: {
      width: AVATAR_CELL,
      height: colHeight,
      gap: AVATAR_GAP,
    },
    gridItem: {
      width: AVATAR_CELL,
      height: AVATAR_CELL,
      borderRadius: 14,
      overflow: 'hidden',
      borderWidth: 2,
      borderColor: theme.border,
      backgroundColor: theme.surface,
    },
    gridItemSelected: {
      borderColor: theme.primaryDark,
      borderWidth: 3,
    },
    gridImage: {
      width: '100%',
      height: '100%',
    },
  });
}
