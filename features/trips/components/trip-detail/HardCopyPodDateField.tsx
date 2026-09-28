/**
 * Compact date field for hard-copy POD forms — native calendar on web,
 * DateTimePicker on iOS/Android. Stores ISO YYYY-MM-DD.
 */
import Theme from "@/constants/Theme";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Calendar } from "lucide-react-native";
import { createElement, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseISO(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T12:00:00`);
  }
  return new Date();
}

function formatDisplay(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  return parseISO(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function HardCopyPodDateField({
  label,
  value,
  onChange,
  required,
  error,
}: {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  required?: boolean;
  error?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const isoValue = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";

  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.req}> *</Text> : null}
      </Text>
      {Platform.OS === "web" ? (
        <View style={[styles.shell, error ? styles.shellError : null]}>
          {createElement("input", {
            type: "date",
            value: isoValue,
            "aria-label": label,
            onChange: (e: { target?: { value?: string } }) => {
              onChange(String(e?.target?.value ?? ""));
            },
            style: {
              flex: "1 1 0",
              minWidth: 0,
              width: "100%",
              boxSizing: "border-box",
              border: "none",
              outline: "none",
              background: "transparent",
              fontSize: 14,
              fontWeight: "500",
              color: Theme.textPrimaryDark,
              fontFamily: "inherit",
              padding: 0,
              margin: 0,
              minHeight: 22,
              cursor: "pointer",
            },
          })}
          <View pointerEvents="none">
            <Calendar size={15} color={Theme.textMuted} strokeWidth={2.2} />
          </View>
        </View>
      ) : (
        <>
          <Pressable
            onPress={() => setOpen(true)}
            style={({ pressed }) => [
              styles.shell,
              error ? styles.shellError : null,
              pressed && { opacity: 0.9 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={label}
          >
            <Text style={[styles.valueText, !isoValue && styles.placeholder]}>
              {isoValue ? formatDisplay(isoValue) : "DD/MM/YYYY"}
            </Text>
            <Calendar size={15} color={Theme.textMuted} strokeWidth={2.2} />
          </Pressable>
          {open && Platform.OS === "android" ? (
            <DateTimePicker
              value={parseISO(isoValue)}
              mode="date"
              display="default"
              onChange={(e, date) => {
                setOpen(false);
                if (e.type === "set" && date) onChange(toISODate(date));
              }}
            />
          ) : null}
          {Platform.OS === "ios" ? (
            <Modal visible={open} transparent animationType="slide">
              <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
                <View style={styles.sheet} onStartShouldSetResponder={() => true}>
                  <View style={styles.sheetHeader}>
                    <Pressable
                      onPress={() => {
                        onChange("");
                        setOpen(false);
                      }}
                      hitSlop={10}
                    >
                      <Text style={styles.clearText}>Clear</Text>
                    </Pressable>
                    <Text style={styles.sheetTitle}>{label}</Text>
                    <Pressable onPress={() => setOpen(false)} hitSlop={10}>
                      <Text style={styles.doneText}>Done</Text>
                    </Pressable>
                  </View>
                  <DateTimePicker
                    value={parseISO(isoValue)}
                    mode="date"
                    display="spinner"
                    onChange={(_, date) => date && onChange(toISODate(date))}
                  />
                </View>
              </Pressable>
            </Modal>
          ) : null}
        </>
      )}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6, width: "100%" },
  label: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: Theme.textMuted,
  },
  req: { color: Theme.warning },
  shell: {
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Theme.borderMedium,
    backgroundColor: Theme.cardWhite,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  shellError: {
    borderColor: Theme.warning,
  },
  valueText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
    color: Theme.textPrimaryDark,
  },
  placeholder: {
    color: Theme.textMuted,
  },
  errorText: {
    fontSize: 11,
    color: Theme.warning,
    fontWeight: "600",
  },
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15,23,42,0.35)",
  },
  sheet: {
    backgroundColor: Theme.cardWhite,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 24,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Theme.borderLight,
  },
  sheetTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: Theme.textPrimaryDark,
  },
  clearText: { fontSize: 14, color: Theme.textMuted, fontWeight: "600" },
  doneText: { fontSize: 14, color: Theme.analyticsHeroBg, fontWeight: "700" },
});
