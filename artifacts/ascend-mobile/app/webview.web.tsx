/**
 * Web stub for the WebView screen.
 * The real WebView shell only runs on native (iOS).
 * In the Expo web preview, just show a placeholder.
 */
import React from "react";
import { View, Text, StyleSheet } from "react-native";

export default function WebViewScreen() {
  return (
    <View style={styles.root}>
      <Text style={styles.text}>Ascend runs in the native iOS app.</Text>
      <Text style={styles.sub}>Open with Expo Go on your iPhone to preview.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0B1220" },
  text: { color: "#F8FAFC", fontSize: 18, fontWeight: "700", textAlign: "center", paddingHorizontal: 24 },
  sub: { color: "#64748B", fontSize: 14, marginTop: 8, textAlign: "center", paddingHorizontal: 32 },
});
