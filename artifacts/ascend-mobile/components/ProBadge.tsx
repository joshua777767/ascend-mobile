import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

export function ProBadge() {
  const colors = useColors();
  return (
    <View style={[styles.badge, { backgroundColor: colors.primary }]}>
      <Text style={[styles.text, { color: colors.primaryForeground }]}>PRO</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  text: {
    fontSize: 10,
    fontFamily: "SpaceMono_700Bold",
    letterSpacing: 0.8,
  },
});
