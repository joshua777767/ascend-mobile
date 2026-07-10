import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

type Props = {
  label: string;
  value: string | number;
  unit?: string;
  color?: string;
};

export function StatCard({ label, value, unit, color }: Props) {
  const colors = useColors();
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.value, { color: color ?? colors.primary }]}>
        {value}
        {unit ? <Text style={[styles.unit, { color: colors.mutedForeground }]}> {unit}</Text> : null}
      </Text>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    alignItems: "center",
    gap: 4,
  },
  value: {
    fontSize: 22,
    fontFamily: "SpaceMono_700Bold",
  },
  unit: {
    fontSize: 12,
    fontFamily: "SpaceMono_400Regular",
  },
  label: {
    fontSize: 11,
    fontFamily: "SpaceMono_400Regular",
    textAlign: "center",
  },
});
