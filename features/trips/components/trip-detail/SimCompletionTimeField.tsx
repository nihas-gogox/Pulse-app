/**
 * Compact date and 12-hour time for the simulate-stage log.
 * Time uses hour, minute, and AM/PM steppers so the page does not open a tall menu.
 */
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Feather } from "@expo/vector-icons";
import { createElement, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import {
  hour12To24,
  hour24To12,
  parseSimCompletionPickerValue,
  toSimCompletionPickerValue,
} from "../../utils/simulateTripStage.util";

type Props = {
  initialValue: string;
  onChange: (next: string) => void;
};

type Period = "AM" | "PM";

function selectedDate(value: string): Date {
  const iso = parseSimCompletionPickerValue(value);
  return iso ? new Date(iso) : new Date();
}

function datePart(value: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})T/.exec(value);
  return match?.[1] ?? toSimCompletionPickerValue().slice(0, 10);
}

function clockFromValue(value: string): { hour: number; minute: number; period: Period } {
  const match = /T(\d{2}):(\d{2})$/.exec(value);
  const hour24 = match ? Number(match[1]) : new Date().getHours();
  const minute = match ? Number(match[2]) : new Date().getMinutes();
  const converted = hour24To12(hour24);
  return { hour: converted.hour, minute, period: converted.period };
}

const webDateStyle = {
  width: "100%",
  height: "32px",
  boxSizing: "border-box" as const,
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: "8px",
  background: "rgba(15,23,42,0.55)",
  color: "#ffffff",
  fontSize: "12px",
  fontWeight: "600",
  fontFamily: "inherit",
  padding: "0 8px",
  margin: 0,
  colorScheme: "dark" as const,
};

const webDigitStyle = {
  width: "20px",
  height: "32px",
  border: "none",
  outline: "none",
  background: "transparent",
  color: "#ffffff",
  fontSize: "12px",
  fontWeight: "700",
  fontFamily: "inherit",
  textAlign: "center" as const,
  padding: 0,
  margin: 0,
};

function DigitField({
  label,
  value,
  max,
  min,
  onCommit,
}: {
  label: string;
  value: number;
  max: number;
  min: number;
  onCommit: (next: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? String(value).padStart(2, "0");

  const commit = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 2);
    if (!digits) return;
    const next = Number(digits);
    if (next >= min && next <= max) onCommit(next);
  };

  const step = (delta: number) => {
    const span = max - min + 1;
    const next = ((value - min + delta) % span + span) % span + min;
    setDraft(null);
    onCommit(next);
  };

  return (
    <View style={styles.stepper}>
      <Pressable
        onPress={() => step(-1)}
        hitSlop={4}
        style={styles.chevron}
        accessibilityLabel={`Decrease ${label}`}
      >
        <Feather name="chevron-left" size={12} color="#94a3b8" />
      </Pressable>
      {Platform.OS === "web" ? (
        createElement("input", {
          "aria-label": label,
          inputMode: "numeric",
          value: shown,
          onChange: (event: { target: { value: string } }) => {
            const digits = event.target.value.replace(/\D/g, "").slice(0, 2);
            setDraft(digits);
            if (digits.length === 2) commit(digits);
          },
          onBlur: () => {
            if (draft != null) commit(draft);
            setDraft(null);
          },
          style: webDigitStyle,
        })
      ) : (
        <TextInput
          value={shown}
          onChangeText={(text) => {
            const digits = text.replace(/\D/g, "").slice(0, 2);
            setDraft(digits);
            if (digits.length === 2) commit(digits);
          }}
          onBlur={() => {
            if (draft != null) commit(draft);
            setDraft(null);
          }}
          keyboardType="number-pad"
          maxLength={2}
          style={styles.digit}
          accessibilityLabel={label}
        />
      )}
      <Pressable
        onPress={() => step(1)}
        hitSlop={4}
        style={styles.chevron}
        accessibilityLabel={`Increase ${label}`}
      >
        <Feather name="chevron-right" size={12} color="#94a3b8" />
      </Pressable>
    </View>
  );
}

export function SimCompletionTimeField({ initialValue, onChange }: Props) {
  const [value, setValue] = useState(initialValue);
  const [showDate, setShowDate] = useState(false);
  const selected = selectedDate(value);
  const clock = clockFromValue(value);

  const write = (hour12: number, minute: number, period: Period, date = datePart(value)) => {
    const hour24 = String(hour12To24(hour12, period)).padStart(2, "0");
    const mins = String(minute).padStart(2, "0");
    const next = `${date}T${hour24}:${mins}`;
    setValue(next);
    onChange(next);
  };

  const dateLabel = selected.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <View>
    <View style={styles.row}>
      <View style={styles.dateCol}>
        <Text style={styles.fieldLabel}>Date</Text>
        {Platform.OS === "web" ? (
          createElement("input", {
            type: "date",
            value: datePart(value),
            "aria-label": "Completion date",
            onChange: (event: { target: { value: string } }) => {
              const next = event.target.value ?? "";
              if (/^\d{4}-\d{2}-\d{2}$/.test(next)) write(clock.hour, clock.minute, clock.period, next);
            },
            style: webDateStyle,
          })
        ) : (
          <Pressable
            onPress={() => setShowDate(true)}
            style={styles.dateButton}
            accessibilityRole="button"
            accessibilityLabel="Pick completion date"
          >
            <Text style={styles.dateValue} numberOfLines={1}>
              {dateLabel}
            </Text>
            <Feather name="calendar" size={12} color="#f59e0b" />
          </Pressable>
        )}
      </View>
      <View style={styles.timeCol}>
        <Text style={styles.fieldLabel}>Time</Text>
        <View style={styles.timeRow}>
          <DigitField
            label="Hour"
            value={clock.hour}
            min={1}
            max={12}
            onCommit={(hour) => write(hour, clock.minute, clock.period)}
          />
          <Text style={styles.colon}>:</Text>
          <DigitField
            label="Minute"
            value={clock.minute}
            min={0}
            max={59}
            onCommit={(minute) => write(clock.hour, minute, clock.period)}
          />
          <View style={styles.period}>
            {(["AM", "PM"] as const).map((period) => {
              const active = clock.period === period;
              return (
                <Pressable
                  key={period}
                  onPress={() => write(clock.hour, clock.minute, period)}
                  style={[styles.periodBtn, active && styles.periodBtnOn]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.periodText, active && styles.periodTextOn]}>{period}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
      </View>
      {showDate && Platform.OS === "android" ? (
        <DateTimePicker
          value={selected}
          mode="date"
          display="default"
          onChange={(event: DateTimePickerEvent, picked?: Date) => {
            setShowDate(false);
            if (event.type !== "set" || !picked) return;
            const y = picked.getFullYear();
            const m = String(picked.getMonth() + 1).padStart(2, "0");
            const d = String(picked.getDate()).padStart(2, "0");
            write(clock.hour, clock.minute, clock.period, `${y}-${m}-${d}`);
          }}
        />
      ) : null}
      {showDate && Platform.OS === "ios" ? (
        <View>
          <DateTimePicker
            value={selected}
            mode="date"
            display="spinner"
            themeVariant="dark"
            onChange={(_event: DateTimePickerEvent, picked?: Date) => {
              if (!picked) return;
              const y = picked.getFullYear();
              const m = String(picked.getMonth() + 1).padStart(2, "0");
              const d = String(picked.getDate()).padStart(2, "0");
              write(clock.hour, clock.minute, clock.period, `${y}-${m}-${d}`);
            }}
          />
          <Pressable onPress={() => setShowDate(false)} style={styles.done}>
            <Text style={styles.doneText}>Done</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
  },
  dateCol: {
    width: 132,
    flexShrink: 0,
  },
  timeCol: {
    flex: 1,
    minWidth: 0,
  },
  fieldLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#94a3b8",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  dateButton: {
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(15,23,42,0.55)",
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 4,
  },
  dateValue: {
    flex: 1,
    minWidth: 0,
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  stepper: {
    height: 32,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(15,23,42,0.55)",
    paddingHorizontal: 2,
  },
  chevron: {
    width: 14,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  digit: {
    width: 20,
    height: 32,
    padding: 0,
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  colon: {
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: "700",
    width: 6,
    textAlign: "center",
  },
  period: {
    height: 32,
    flexDirection: "row",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    overflow: "hidden",
    marginLeft: 2,
  },
  periodBtn: {
    width: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  done: {
    alignSelf: "flex-end",
    minHeight: 32,
    justifyContent: "center",
  },
  doneText: {
    color: "#f59e0b",
    fontSize: 12,
    fontWeight: "700",
  },
  periodBtnOn: {
    backgroundColor: "#f59e0b",
  },
  periodText: {
    color: "#94a3b8",
    fontSize: 10,
    fontWeight: "800",
  },
  periodTextOn: {
    color: "#fff",
  },
});
