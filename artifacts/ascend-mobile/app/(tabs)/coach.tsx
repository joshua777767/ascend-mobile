import { Feather } from "@expo/vector-icons";
import { fetch } from "expo/fetch";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useGetChatHistory, useSendChatMessage } from "@workspace/api-client-react";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export default function CoachScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isPro } = useSubscription();

  const { data: historyData } = useGetChatHistory();
  const sendMessage = useSendChatMessage();

  const history: Message[] = ((historyData as any) ?? []).map((m: any, i: number) => ({
    id: String(i),
    role: m.role,
    content: m.content,
  }));

  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  const allMessages: Message[] = localMessages.length > 0 ? localMessages : history;

  const send = useCallback(async () => {
    if (!input.trim() || isStreaming) return;
    const currentInput = input.trim();
    const userMsg: Message = { id: Date.now().toString(), role: "user", content: currentInput };
    setInput("");
    setLocalMessages((prev) => [...(prev.length > 0 ? prev : history), userMsg]);
    setIsStreaming(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const assistantId = (Date.now() + 1).toString();
    setLocalMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }]);

    try {
      const base = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
      const res = await fetch(`${base}/api/chat`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: currentInput }),
      });

      let full = "";

      if (res.ok && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split("\n")) {
            if (line.startsWith("data: ")) {
              const text = line.slice(6);
              if (text === "[DONE]") continue;
              try {
                const delta = JSON.parse(text)?.choices?.[0]?.delta?.content ?? "";
                if (delta) {
                  full += delta;
                  setLocalMessages((prev) =>
                    prev.map((m) => (m.id === assistantId ? { ...m, content: full } : m))
                  );
                }
              } catch {}
            }
          }
        }
      }

      if (!full) {
        const result = await sendMessage.mutateAsync({ data: { message: currentInput } });
        const reply = (result as any)?.message ?? (result as any)?.response ?? "I'm here to help!";
        setLocalMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: reply } : m))
        );
      }
    } catch {
      setLocalMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: "Sorry, I couldn't respond right now. Please try again." }
            : m
        )
      );
    } finally {
      setIsStreaming(false);
    }
  }, [input, isStreaming, history, sendMessage]);

  if (!isPro) {
    return (
      <View style={[styles.gateRoot, { backgroundColor: colors.background }]}>
        <View style={[styles.gateCard, { backgroundColor: colors.card, borderColor: colors.primary + "44" }]}>
          <View style={[styles.gateCrown, { backgroundColor: colors.primary + "1A" }]}>
            <Feather name="lock" size={32} color={colors.primary} />
          </View>
          <Text style={[styles.gateTitle, { color: colors.foreground }]}>Coach Chat is Pro</Text>
          <Text style={[styles.gateText, { color: colors.mutedForeground }]}>
            Unlock unlimited AI coaching conversations with Ascend Pro.
          </Text>
          <TouchableOpacity
            style={[styles.gateBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push("/paywall")}
          >
            <Text style={[styles.gateBtnText, { color: colors.primaryForeground }]}>Upgrade to Pro</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior="padding"
      keyboardVerticalOffset={0}
    >
      <View style={[styles.header, { paddingTop: insets.top + 12, borderBottomColor: colors.border }]}>
        <View style={[styles.avatarDot, { backgroundColor: colors.primary + "22" }]}>
          <Feather name="cpu" size={18} color={colors.primary} />
        </View>
        <View>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Coach</Text>
          <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>AI-powered · always adapting</Text>
        </View>
      </View>

      <FlatList
        data={[...allMessages].reverse()}
        keyExtractor={(item) => item.id}
        inverted
        contentContainerStyle={[styles.list, { paddingBottom: 16 }]}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          isStreaming && allMessages[allMessages.length - 1]?.role !== "assistant" ? (
            <View style={[styles.typingBubble, { backgroundColor: colors.card }]}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={[styles.bubbleRow, item.role === "user" ? styles.userRow : styles.assistantRow]}>
            {item.role === "assistant" && (
              <View style={[styles.avatarSmall, { backgroundColor: colors.primary + "22" }]}>
                <Feather name="cpu" size={12} color={colors.primary} />
              </View>
            )}
            <View
              style={[
                styles.bubble,
                item.role === "user"
                  ? { backgroundColor: colors.primary }
                  : { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 },
              ]}
            >
              <Text
                style={[
                  styles.bubbleText,
                  { color: item.role === "user" ? colors.primaryForeground : colors.foreground },
                ]}
              >
                {item.content || (isStreaming ? "…" : "")}
              </Text>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyChat}>
            <Text style={[styles.emptyChatText, { color: colors.mutedForeground }]}>
              Say hello to your AI coach
            </Text>
          </View>
        }
      />

      <View style={[styles.inputBar, { borderTopColor: colors.border, paddingBottom: insets.bottom + 12 }]}>
        <TextInput
          style={[
            styles.chatInput,
            { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground },
          ]}
          placeholder="Ask your coach anything…"
          placeholderTextColor={colors.mutedForeground}
          value={input}
          onChangeText={setInput}
          multiline
          returnKeyType="send"
          onSubmitEditing={send}
        />
        <TouchableOpacity
          style={[
            styles.sendBtn,
            { backgroundColor: input.trim() ? colors.primary : colors.muted },
          ]}
          onPress={send}
          disabled={!input.trim() || isStreaming}
          activeOpacity={0.85}
        >
          <Feather
            name="send"
            size={16}
            color={input.trim() ? colors.primaryForeground : colors.mutedForeground}
          />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  gateRoot: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  gateCard: { borderRadius: 20, borderWidth: 1.5, padding: 32, alignItems: "center", gap: 16, width: "100%" },
  gateCrown: { width: 72, height: 72, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  gateTitle: { fontSize: 22, fontFamily: "Inter_700Bold" },
  gateText: { fontSize: 15, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 22 },
  gateBtn: { paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14, marginTop: 4 },
  gateBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1 },
  avatarDot: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular" },
  list: { paddingHorizontal: 16, paddingTop: 16 },
  bubbleRow: { flexDirection: "row", alignItems: "flex-end", marginBottom: 10, gap: 8 },
  userRow: { justifyContent: "flex-end" },
  assistantRow: { justifyContent: "flex-start" },
  avatarSmall: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  bubble: { maxWidth: "78%", borderRadius: 16, padding: 12 },
  bubbleText: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 22 },
  typingBubble: { borderRadius: 16, padding: 14, alignSelf: "flex-start", marginBottom: 10 },
  emptyChat: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80 },
  emptyChatText: { fontSize: 15, fontFamily: "Inter_400Regular" },
  inputBar: { flexDirection: "row", alignItems: "flex-end", gap: 10, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1 },
  chatInput: { flex: 1, borderRadius: 20, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, fontFamily: "Inter_400Regular", maxHeight: 100 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
});
