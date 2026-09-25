/**
 * Phase 3B.1 — publish a capacity Story from an owner vehicle.
 * Places + date pickers match Business create-trip / profile patterns
 * (LocationSearchField → placesService India API; native date picker).
 */
import {
  DRIVER_DETAIL_HORIZONTAL_PAD,
  DriverSubScreenHeader,
  driverDetailPageBackground,
} from '../../../components/driver/DriverSubScreenHeader';
import Theme from '@pulse/core/constants/Theme';
import { useAuth } from '@pulse/domain/contexts/AuthContext';
import { useDriverTheme, useDriverThemeColors } from '@pulse/ui/contexts/DriverThemeContext';
import { createFleetOwnerCapacityStory } from '../services/fleetOwnerCapacityStory.service';
import {
  ownerVehicleSubtitle,
  ownerVehicleTitle,
} from '../services/ownerVehicles.service';
import { LocationSearchField } from '@pulse/features/features/trips/components/add-trip/LocationSearchField';
import { useDriverFleetOwnerQuery } from '../../../lib/queries/useDriverFleetOwnerQuery';
import { useMyCapacityStoriesQuery } from '../../../lib/queries/useMyCapacityStoriesQuery';
import { useOwnerVehiclesQuery } from '../../../lib/queries/useOwnerVehiclesQuery';
import { ROUTES } from '@pulse/core/lib/routes';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Calendar, MapPin, Navigation } from 'lucide-react-native';
import { createElement, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseISODate(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T12:00:00`);
  }
  return new Date();
}

function formatDisplayDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
  return parseISODate(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function CapacityStoryComposerScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile } = useAuth();
  const uid = profile?.uid ?? '';
  const params = useLocalSearchParams<{ vehicleId?: string | string[] }>();
  const rawVehicle = Array.isArray(params.vehicleId)
    ? params.vehicleId[0]
    : params.vehicleId;
  const presetVehicleId = rawVehicle?.trim() || '';

  const { isDark } = useDriverTheme();
  const colors = useDriverThemeColors();
  const pageBg = driverDetailPageBackground(isDark, colors.background);
  const { isFleetOwner, isLoading: ownerLoading } = useDriverFleetOwnerQuery(uid);
  const { vehicles, isLoading: vehiclesLoading } = useOwnerVehiclesQuery(uid);
  const { invalidate } = useMyCapacityStoriesQuery(uid);

  const [vehicleId, setVehicleId] = useState(presetVehicleId);
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [availableFrom, setAvailableFrom] = useState('');
  const [rateText, setRateText] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  useEffect(() => {
    if (presetVehicleId) setVehicleId(presetVehicleId);
    else if (!vehicleId && vehicles[0]?.id) setVehicleId(vehicles[0].id);
  }, [presetVehicleId, vehicles, vehicleId]);

  const selected = useMemo(
    () => vehicles.find((v) => v.id === vehicleId) ?? null,
    [vehicles, vehicleId],
  );

  const cardBorder = isDark ? colors.borderSubtle : Theme.borderLight;
  const inputBg = isDark ? colors.surfaceElevated : Theme.surfaceGray;
  const pickerDate = availableFrom ? parseISODate(availableFrom) : new Date();

  const handlePublish = async () => {
    if (!selected) {
      setError('Select a vehicle from My Fleet.');
      return;
    }
    if (!origin.trim()) {
      setError('Where is the vehicle available?');
      return;
    }
    const rate = rateText.trim() ? Number(rateText.replace(/,/g, '')) : null;
    if (rateText.trim() && (!Number.isFinite(rate) || (rate ?? 0) <= 0)) {
      setError('Enter a valid optional rate, or leave it blank.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const { error: createError } = await createFleetOwnerCapacityStory({
        ownerVehicleId: selected.id,
        origin,
        destination,
        availableFrom: availableFrom.trim() || null,
        rateOffer: rate,
        content: note,
      });
      if (createError) {
        setError(createError.message);
        return;
      }
      invalidate();
      router.replace('/(driver)/stories');
    } finally {
      setBusy(false);
    }
  };

  if (!ownerLoading && !isFleetOwner) {
    return (
      <View style={[styles.root, { backgroundColor: pageBg }]}>
        <DriverSubScreenHeader
          title="Share availability"
          subtitle="Fleet Owner required"
          onBack={() =>
            router.canGoBack() ? router.back() : router.replace('/(driver)/stories')
          }
        />
        <View style={{ padding: 20, gap: 10 }}>
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }}>
            Become a Fleet Owner and add a vehicle first.
          </Text>
          <Pressable
            onPress={() =>
              router.push(
                ROUTES.driverBecomeFleetOwner() as Parameters<typeof router.push>[0],
              )
            }
            style={[styles.cta, { backgroundColor: Theme.buttonPrimary, borderColor: Theme.buttonPrimaryBorder }]}
          >
            <Text style={styles.ctaText}>Become a Fleet Owner</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: pageBg }]}>
      <DriverSubScreenHeader
        title="Share availability"
        subtitle="Capacity Story · Stories tab"
        onBack={() =>
          router.canGoBack() ? router.back() : router.replace('/(driver)/stories')
        }
      />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: DRIVER_DETAIL_HORIZONTAL_PAD,
            paddingBottom: Math.max(insets.bottom, 16) + 24,
            paddingTop: 12,
            gap: 10,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            Business discovers this under Idle capacity. Not a bid or trip assignment.
          </Text>

          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: cardBorder }]}>
            <Text style={[styles.label, { color: colors.textMuted }]}>Vehicle</Text>
            {vehiclesLoading ? (
              <ActivityIndicator color={colors.emerald} />
            ) : vehicles.length === 0 ? (
              <Pressable
                onPress={() =>
                  router.push(
                    ROUTES.driverMyFleetAdd() as Parameters<typeof router.push>[0],
                  )
                }
              >
                <Text style={{ color: Theme.accentBrown, fontWeight: '700', fontSize: 12 }}>
                  Add a vehicle in My Fleet first
                </Text>
              </Pressable>
            ) : (
              <View style={styles.vehicleList}>
                {vehicles.map((v) => {
                  const on = v.id === vehicleId;
                  return (
                    <Pressable
                      key={v.id}
                      onPress={() => setVehicleId(v.id)}
                      style={[
                        styles.vehicleChip,
                        {
                          borderColor: on ? Theme.brandBlueInk : cardBorder,
                          backgroundColor: on ? Theme.brandBlueSoft : inputBg,
                        },
                      ]}
                    >
                      <Text style={[styles.vehicleTitle, { color: colors.text }]}>
                        {ownerVehicleTitle(v)}
                      </Text>
                      <Text style={[styles.vehicleSub, { color: colors.textMuted }]}>
                        {ownerVehicleSubtitle(v)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>

          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: cardBorder }]}>
            <LocationSearchField
              label="Available at"
              placeholder="Search city or area"
              value={origin}
              onChangeText={setOrigin}
              onSelectPlace={(displayName) => setOrigin(displayName)}
              compact
              leadingIcon={<MapPin size={14} color={Theme.textMuted} strokeWidth={2.2} />}
              labelStyle={[styles.label, { color: colors.textMuted }]}
              inputStyle={[
                styles.locationInput,
                { color: colors.text, backgroundColor: inputBg, borderColor: cardBorder },
              ]}
            />

            <View style={{ height: 10 }} />

            <LocationSearchField
              label="Prefers lane to (optional)"
              placeholder="Search destination"
              value={destination}
              onChangeText={setDestination}
              onSelectPlace={(displayName) => setDestination(displayName)}
              compact
              leadingIcon={<Navigation size={14} color={Theme.textMuted} strokeWidth={2.2} />}
              labelStyle={[styles.label, { color: colors.textMuted }]}
              inputStyle={[
                styles.locationInput,
                { color: colors.text, backgroundColor: inputBg, borderColor: cardBorder },
              ]}
            />

            <Text style={[styles.label, { color: colors.textMuted, marginTop: 12 }]}>
              Available from (optional)
            </Text>
            {Platform.OS === 'web' ? (
              <View
                style={[
                  styles.dateField,
                  { backgroundColor: inputBg, borderColor: cardBorder },
                ]}
              >
                <Calendar size={14} color={Theme.textMuted} strokeWidth={2.2} />
                {createElement('input', {
                  type: 'date',
                  value: availableFrom,
                  'aria-label': 'Available from',
                  onChange: (e: { target: { value: string } }) => {
                    setAvailableFrom(e.target.value ?? '');
                  },
                  style: {
                    flex: 1,
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    fontSize: 13,
                    fontWeight: '600',
                    color: colors.text,
                    minHeight: 36,
                  },
                })}
                {availableFrom ? (
                  <Pressable onPress={() => setAvailableFrom('')} hitSlop={8}>
                    <Text style={styles.clearDate}>Clear</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : (
              <>
                <Pressable
                  onPress={() => setDatePickerOpen(true)}
                  style={[
                    styles.dateField,
                    { backgroundColor: inputBg, borderColor: cardBorder },
                  ]}
                >
                  <Calendar size={14} color={Theme.textMuted} strokeWidth={2.2} />
                  <Text
                    style={[
                      styles.dateFieldText,
                      { color: availableFrom ? colors.text : colors.textMuted },
                    ]}
                  >
                    {availableFrom ? formatDisplayDate(availableFrom) : 'Pick a date'}
                  </Text>
                  {availableFrom ? (
                    <Pressable
                      onPress={() => setAvailableFrom('')}
                      hitSlop={8}
                    >
                      <Text style={styles.clearDate}>Clear</Text>
                    </Pressable>
                  ) : null}
                </Pressable>

                {datePickerOpen && Platform.OS === 'android' ? (
                  <DateTimePicker
                    value={pickerDate}
                    mode="date"
                    display="default"
                    minimumDate={new Date()}
                    onChange={(event, date) => {
                      setDatePickerOpen(false);
                      if (event.type === 'dismissed' || !date) return;
                      setAvailableFrom(toISODate(date));
                    }}
                  />
                ) : null}

                {datePickerOpen && Platform.OS === 'ios' ? (
                  <Modal transparent animationType="slide" onRequestClose={() => setDatePickerOpen(false)}>
                    <View style={styles.dateModalRoot}>
                      <Pressable style={StyleSheet.absoluteFill} onPress={() => setDatePickerOpen(false)} />
                      <View
                        style={[
                          styles.dateSheet,
                          { paddingBottom: Math.max(insets.bottom, 12) + 8 },
                        ]}
                      >
                        <View style={styles.dateSheetHeader}>
                          <Text style={styles.dateSheetTitle}>Available from</Text>
                          <Pressable onPress={() => setDatePickerOpen(false)} hitSlop={8}>
                            <Text style={styles.dateSheetDone}>Done</Text>
                          </Pressable>
                        </View>
                        <DateTimePicker
                          value={pickerDate}
                          mode="date"
                          display="spinner"
                          minimumDate={new Date()}
                          onChange={(_, date) => {
                            if (date) setAvailableFrom(toISODate(date));
                          }}
                        />
                      </View>
                    </View>
                  </Modal>
                ) : null}
              </>
            )}

            <Text style={[styles.label, { color: colors.textMuted, marginTop: 12 }]}>
              Asking rate (optional)
            </Text>
            <TextInput
              value={rateText}
              onChangeText={setRateText}
              placeholder="28000"
              keyboardType="numeric"
              placeholderTextColor={colors.textMuted}
              style={[
                styles.input,
                { color: colors.text, backgroundColor: inputBg, borderColor: cardBorder },
              ]}
            />

            <Text style={[styles.label, { color: colors.textMuted, marginTop: 12 }]}>
              Note (optional)
            </Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Anything Business should know"
              placeholderTextColor={colors.textMuted}
              multiline
              style={[
                styles.input,
                styles.noteInput,
                { color: colors.text, backgroundColor: inputBg, borderColor: cardBorder },
              ]}
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            onPress={() => void handlePublish()}
            disabled={busy}
            style={[
              styles.cta,
              {
                backgroundColor: Theme.buttonPrimary,
                borderColor: Theme.buttonPrimaryBorder,
                opacity: busy ? 0.65 : 1,
              },
            ]}
          >
            {busy ? (
              <ActivityIndicator color={Theme.buttonPrimaryText} />
            ) : (
              <Text style={styles.ctaText}>Share as Story</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hint: { fontSize: 11, fontWeight: '500', lineHeight: 15 },
  card: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    gap: 6,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.35,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  vehicleList: { gap: 8 },
  vehicleChip: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 9,
    gap: 2,
  },
  vehicleTitle: { fontSize: 12, fontWeight: '700' },
  vehicleSub: { fontSize: 10, fontWeight: '500' },
  locationInput: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 40,
    fontSize: 13,
    fontWeight: '600',
  },
  dateField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    minHeight: 40,
  },
  dateFieldText: { flex: 1, fontSize: 13, fontWeight: '600' },
  clearDate: { fontSize: 11, fontWeight: '700', color: Theme.accentBrown },
  dateModalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: Theme.overlayBackdrop,
  },
  dateSheet: {
    backgroundColor: Theme.cardWhite,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 10,
  },
  dateSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  dateSheetTitle: { fontSize: 13, fontWeight: '700', color: Theme.textPrimaryDark },
  dateSheetDone: { fontSize: 13, fontWeight: '700', color: Theme.accentBrown },
  input: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 13,
    fontWeight: '600',
    minHeight: 40,
  },
  noteInput: { minHeight: 72, textAlignVertical: 'top' },
  error: { fontSize: 12, fontWeight: '600', color: Theme.negative },
  cta: {
    minHeight: 44,
    borderRadius: 8,
    borderWidth: Theme.buttonPrimaryBorderWidth,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  ctaText: {
    fontSize: 13,
    fontWeight: '700',
    color: Theme.buttonPrimaryText,
  },
});
