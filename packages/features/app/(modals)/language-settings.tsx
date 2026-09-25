/**
 * Language Settings — clean white card design with left accent bar for selection.
 * Matches the reference design: grouped sections, thin dividers, circle checkmark.
 */
import { useLanguage } from "@pulse/core/contexts/LanguageContext";
import type { LocaleOption } from "@pulse/core/lib/i18n";
import { useRouter } from "expo-router";
import { ArrowLeft, Check, Search } from "lucide-react-native";
import { useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const INDIA: LocaleOption["region"] = "india";
const SOUTHEAST_ASIA: LocaleOption["region"] = "southeast_asia";
const OTHER: LocaleOption["region"] = "other";

const ACCENT = "#4D3636";
const TEXT = "#0f172a";
const MUTED = "#94a3b8";
const BORDER = "#e5e7eb";
const BG = "#ffffff";
const SECTION_BG = "#f8fafc";

export default function LanguageSettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t, locale, setLocale, localeOptions } = useLanguage();
  const [search, setSearch] = useState("");

  const filteredByRegion = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filter = (opt: LocaleOption) =>
      !q ||
      opt.label.toLowerCase().includes(q) ||
      opt.labelNative.toLowerCase().includes(q);
    const india = localeOptions.filter((o) => o.region === INDIA && filter(o));
    const sea = localeOptions.filter((o) => o.region === SOUTHEAST_ASIA && filter(o));
    const other = localeOptions.filter((o) => o.region === OTHER && filter(o));
    return { india, sea, other };
  }, [localeOptions, search]);

  const sections: { title: string; data: LocaleOption[]; color: string }[] = [
    { title: t("regionIndia"), data: filteredByRegion.india, color: ACCENT },
    { title: t("regionSoutheastAsia"), data: filteredByRegion.sea, color: "#0891b2" },
    { title: t("regionOther"), data: filteredByRegion.other, color: "#64748b" },
  ].filter((s) => s.data.length > 0);

  const handleSelect = (value: LocaleOption["value"]) => {
    setLocale(value);
    router.back();
  };

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [s.backBtn, pressed && { opacity: 0.7 }]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={18} color={TEXT} strokeWidth={2.2} />
        </Pressable>
        <View style={s.headerText}>
          <Text style={s.headerTitle}>{t("languageSettings")}</Text>
          <Text style={s.headerSub}>APP DISPLAY LANGUAGE</Text>
        </View>
        <View style={s.backBtn} />
      </View>

      {/* Search */}
      <View style={s.searchWrap}>
        <Search size={16} color={MUTED} strokeWidth={2} style={{ flexShrink: 0 }} />
        <TextInput
          style={s.searchInput}
          placeholder={t("searchLanguage")}
          placeholderTextColor={MUTED}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
        />
      </View>

      <FlatList
        data={sections}
        keyExtractor={(item) => item.title}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 + insets.bottom, gap: 16 }}
        renderItem={({ item: section }) => (
          <View>
            {/* Section header */}
            <View style={s.sectionHeader}>
              <View style={[s.sectionDot, { backgroundColor: section.color }]} />
              <Text style={[s.sectionTitle, { color: section.color }]}>
                {section.title.toUpperCase()}
              </Text>
            </View>

            {/* Language items */}
            <View style={s.sectionCard}>
              {section.data.map((opt, idx) => {
                const selected = locale === opt.value;
                const isLast = idx === section.data.length - 1;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => handleSelect(opt.value)}
                    style={({ pressed }) => [
                      s.row,
                      selected && s.rowSelected,
                      pressed && !selected && { backgroundColor: "#f8fafc" },
                    ]}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    accessibilityLabel={`${opt.label} — ${opt.labelNative}`}
                  >
                    {/* Left accent bar */}
                    {selected ? <View style={s.rowAccent} /> : <View style={s.rowAccentPlaceholder} />}

                    {/* Text */}
                    <View style={s.rowBody}>
                      <Text style={[s.rowNative, selected && s.rowNativeSelected]}>
                        {opt.label}
                      </Text>
                      <Text style={[s.rowLabel, selected && s.rowLabelSelected]}>
                        {opt.labelNative}
                      </Text>
                    </View>

                    {/* Checkmark */}
                    {selected ? (
                      <View style={s.checkCircle}>
                        <Check size={12} color="#fff" strokeWidth={3} />
                      </View>
                    ) : null}

                    {/* Divider */}
                    {!isLast && !selected ? <View style={s.divider} /> : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
        style={s.list}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SECTION_BG,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: BG,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BG,
  },
  headerText: {
    alignItems: "center",
    gap: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: TEXT,
    letterSpacing: -0.2,
  },
  headerSub: {
    fontSize: 9,
    fontWeight: "700",
    color: MUTED,
    letterSpacing: 1.0,
    textTransform: "uppercase",
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: BG,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
    color: TEXT,
    padding: 0,
  },
  list: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  sectionDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  sectionCard: {
    backgroundColor: BG,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingRight: 14,
    backgroundColor: BG,
    minHeight: 56,
    position: "relative",
  },
  rowSelected: {
    backgroundColor: "#eef2ff",
  },
  rowAccent: {
    width: 3,
    alignSelf: "stretch",
    backgroundColor: ACCENT,
    marginRight: 12,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },
  rowAccentPlaceholder: {
    width: 3,
    marginRight: 12,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  rowNative: {
    fontSize: 14,
    fontWeight: "600",
    color: TEXT,
    lineHeight: 20,
  },
  rowNativeSelected: {
    color: ACCENT,
    fontWeight: "700",
  },
  rowLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: MUTED,
    lineHeight: 17,
  },
  rowLabelSelected: {
    color: "#818cf8",
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  divider: {
    position: "absolute",
    bottom: 0,
    left: 15,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: BORDER,
  },
});
