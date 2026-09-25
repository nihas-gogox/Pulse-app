/**
 * Month-grid date picker for "Needed by" (salary request). Works on iOS, Android (in-modal), and web.
 * Past dates are selectable (no minDate) so users can navigate prior months/years; future span is capped by maxDate.
 */
import Theme from '@pulse/core/constants/Theme';
import { Calendar, type DateData } from 'react-native-calendars';
import { StyleSheet, View } from 'react-native';

/** Subset of driver theme colors used by the calendar. */
export interface NeededByCalendarColors {
  surface: string;
  text: string;
  textMuted: string;
  placeholder: string;
  emerald: string;
  emeraldMuted: string;
}

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export interface NeededByCalendarProps {
  value: Date | null;
  onDayPress: (date: Date) => void;
  colors: NeededByCalendarColors;
}

export function NeededByCalendar({ value, onDayPress, colors }: NeededByCalendarProps) {
  const today = new Date();
  const todayYmd = toYmd(today);
  const selectedKey = value ? toYmd(value) : undefined;
  const max = new Date(today);
  max.setFullYear(max.getFullYear() + 2);
  const maxStr = toYmd(max);

  const marked =
    selectedKey != null
      ? {
          [selectedKey]: {
            selected: true,
            selectedColor: colors.emerald,
            selectedTextColor: Theme.textOnPrimary,
          },
        }
      : undefined;

  return (
    <View style={styles.wrap}>
      <Calendar
        current={selectedKey ?? todayYmd}
        maxDate={maxStr}
        onDayPress={(day: DateData) => {
          const next = new Date(day.year, day.month - 1, day.day);
          onDayPress(next);
        }}
        markedDates={marked}
        enableSwipeMonths
        theme={{
          backgroundColor: colors.surface,
          calendarBackground: colors.surface,
          textSectionTitleColor: colors.textMuted,
          textSectionTitleDisabledColor: colors.placeholder,
          monthTextColor: colors.text,
          dayTextColor: colors.text,
          textDisabledColor: colors.placeholder,
          todayTextColor: colors.emerald,
          todayBackgroundColor: colors.emeraldMuted,
          arrowColor: colors.emerald,
          selectedDayBackgroundColor: colors.emerald,
          selectedDayTextColor: Theme.textOnPrimary,
          textDayFontWeight: '500',
          textMonthFontWeight: '700',
          textDayHeaderFontWeight: '600',
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    borderRadius: 12,
  },
});
