import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Network from "expo-network";
import type { Session } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "./src/lib/supabase";
import { flushLocationOutbox } from "./src/tracking/outbox";
import {
  isDriverLocationServiceRunning,
  reconcileDriverTracking,
  requestAndStartDriverTracking,
} from "./src/tracking/trackingService";
import { getOutboxStats, type OutboxStats } from "./src/storage/trackingDatabase";

interface ActiveFreightLoad {
  id: string;
  product_name: string;
  status: string;
  origin_label: string;
  destination_label: string;
  in_transit_at: string | null;
}

const EMPTY_STATS: OutboxStats = {
  pending: 0,
  oldestCapturedAt: null,
  failedAttempts: 0,
};

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loads, setLoads] = useState<ActiveFreightLoad[]>([]);
  const [stats, setStats] = useState<OutboxStats>(EMPTY_STATS);
  const [serviceRunning, setServiceRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [notice, setNotice] = useState("");

  const fetchActiveLoads = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("freight_loads")
      .select("id,product_name,status,origin_label,destination_label,in_transit_at")
      .eq("driver_id", userId)
      .eq("status", "in_transit")
      .order("in_transit_at", { ascending: true });

    if (error) throw error;
    return (data ?? []) as ActiveFreightLoad[];
  }, []);

  const refreshStats = useCallback(async () => {
    const nextStats = await getOutboxStats();
    setStats(nextStats);
  }, []);

  const refreshData = useCallback(async () => {
    if (!session?.user.id) return;

    setLoading(true);
    setErrorMessage("");
    try {
      const activeLoads = await fetchActiveLoads(session.user.id);
      setLoads(activeLoads);
      await reconcileDriverTracking(activeLoads.map((load) => load.id));
      setServiceRunning(await isDriverLocationServiceRunning());
      await refreshStats();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível actualizar as entregas e a sincronização.",
      );
      try {
        setServiceRunning(await isDriverLocationServiceRunning());
        await refreshStats();
      } catch {
        // Keep the last known status when local secure storage is unavailable.
      }
    } finally {
      setLoading(false);
    }
  }, [fetchActiveLoads, refreshStats, session?.user.id]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setAuthReady(true);
      return;
    }

    let mounted = true;
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) setErrorMessage("Não foi possível recuperar a sessão segura.");
      setSession(data.session);
      setAuthReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) {
        setLoads([]);
        setServiceRunning(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (session?.user.id) {
      void refreshData();
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  }, [refreshData, session?.user.id]);

  useEffect(() => {
    if (!session?.user.id) return;

    const timer = setInterval(() => {
      if (AppState.currentState === "active") void refreshData();
    }, 30_000);

    const networkSubscription = Network.addNetworkStateListener((state) => {
      if (state.isConnected) {
        void flushLocationOutbox().then(refreshStats).catch(() => undefined);
        void refreshData();
      }
    });

    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        supabase.auth.startAutoRefresh();
        void flushLocationOutbox().then(refreshStats).catch(() => undefined);
        void refreshData();
      } else if (loads.length === 0) {
        supabase.auth.stopAutoRefresh();
      }
    });

    return () => {
      clearInterval(timer);
      networkSubscription.remove();
      appStateSubscription.remove();
    };
  }, [loads.length, refreshData, refreshStats, session?.user.id]);

  const handleSignIn = async () => {
    if (!email.trim() || !password) {
      setErrorMessage("Introduza o e-mail e a palavra-passe da sua conta AgriLink.");
      return;
    }

    setBusy(true);
    setErrorMessage("");
    setNotice("");
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      setPassword("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Não foi possível iniciar sessão.",
      );
    } finally {
      setBusy(false);
    }
  };

  const handleStartTracking = async () => {
    if (!session?.user.id) return;

    setBusy(true);
    setErrorMessage("");
    setNotice("");
    try {
      const latestLoads = await fetchActiveLoads(session.user.id);
      setLoads(latestLoads);
      if (latestLoads.length === 0) {
        throw new Error("Não existem cargas em trânsito atribuídas à sua conta.");
      }

      await requestAndStartDriverTracking(latestLoads.map((load) => load.id));
      setServiceRunning(true);
      setNotice("Rastreamento activo. A localização será sincronizada quando houver rede.");
      await refreshStats();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Não foi possível activar o rastreamento.",
      );
    } finally {
      setBusy(false);
    }
  };

  const handleSync = async () => {
    setBusy(true);
    setErrorMessage("");
    setNotice("");
    try {
      const count = await flushLocationOutbox();
      await refreshStats();
      setNotice(
        count > 0
          ? count + " amostras sincronizadas com a AgriLink."
          : "Fila verificada. Não existem novas amostras confirmadas pelo servidor.",
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "A sincronização não foi concluída.",
      );
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    if (!session?.user.id) return;

    setBusy(true);
    setErrorMessage("");
    try {
      const latestLoads = await fetchActiveLoads(session.user.id);
      if (latestLoads.length > 0) {
        throw new Error(
          "Não pode terminar a sessão enquanto tiver entregas em trânsito. O rastreamento deve permanecer activo.",
        );
      }
      const currentStats = await getOutboxStats();
      if (currentStats.pending > 0) {
        throw new Error(
          "Existem posições por sincronizar. Sincronize a fila antes de terminar a sessão.",
        );
      }

      await reconcileDriverTracking([]);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Não foi possível terminar a sessão.",
      );
    } finally {
      setBusy(false);
    }
  };

  if (!authReady) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator color="#176B45" size="large" />
        <Text style={styles.muted}>A preparar a sessão segura…</Text>
      </SafeAreaView>
    );
  }

  if (!isSupabaseConfigured) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.brand}>AgriLink</Text>
        <Text style={styles.heading}>Configuração necessária</Text>
        <Text style={styles.body}>
          Defina EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY no ficheiro .env e volte a gerar o build.
        </Text>
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar barStyle="dark-content" backgroundColor="#F5F7F4" />
        <View style={styles.loginCard}>
          <Text style={styles.brand}>AgriLink</Text>
          <Text style={styles.eyebrow}>OPERAÇÕES DE TRANSPORTE</Text>
          <Text style={styles.heading}>Acesso do motorista</Text>
          <Text style={styles.body}>
            Entre com a conta AgriLink utilizada para aceitar e executar as suas cargas.
          </Text>

          <Text style={styles.fieldLabel}>E-mail</Text>
          <TextInput
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            placeholder="nome@exemplo.com"
            placeholderTextColor="#87928A"
            style={styles.input}
          />

          <Text style={styles.fieldLabel}>Palavra-passe</Text>
          <TextInput
            secureTextEntry
            autoComplete="password"
            value={password}
            onChangeText={setPassword}
            placeholder="A sua palavra-passe"
            placeholderTextColor="#87928A"
            style={styles.input}
          />

          {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

          <Pressable
            disabled={busy}
            onPress={handleSignIn}
            style={({ pressed }) => [
              styles.primaryButton,
              (pressed || busy) && styles.buttonDimmed,
            ]}
          >
            {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Entrar</Text>}
          </Pressable>
          <Text style={styles.footer}>
            O rastreamento só é activado para cargas atribuídas e em trânsito.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F7F4" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>AgriLink</Text>
            <Text style={styles.eyebrow}>CENTRO DO MOTORISTA</Text>
          </View>
          <View style={styles.statusPill}>
            <View style={[styles.statusDot, serviceRunning ? styles.dotActive : styles.dotIdle]} />
            <Text style={styles.statusText}>
              {serviceRunning ? "Rastreamento activo" : "Rastreamento inactivo"}
            </Text>
          </View>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.cardEyebrow}>ENTREGAS EM EXECUÇÃO</Text>
          <Text style={styles.bigNumber}>{loads.length}</Text>
          <Text style={styles.body}>
            {loads.length === 1
              ? "Uma carga atribuída encontra-se em trânsito."
              : "Cargas atribuídas encontram-se em trânsito."}
          </Text>
        </View>

        {loads.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cargas activas</Text>
            {loads.map((load) => (
              <View key={load.id} style={styles.loadCard}>
                <Text style={styles.loadName}>{load.product_name || "Carga AgriLink"}</Text>
                <Text style={styles.routeText}>{load.origin_label} → {load.destination_label}</Text>
                <Text style={styles.loadId}>Ref. {load.id.slice(0, 8).toUpperCase()}</Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.sectionTitle}>Sem cargas em trânsito</Text>
            <Text style={styles.body}>
              Quando uma carga atribuída passar para “Em trânsito”, aparecerá aqui para acompanhamento GPS.
            </Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Fila offline cifrada</Text>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{stats.pending}</Text>
              <Text style={styles.statLabel}>Por sincronizar</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{stats.failedAttempts}</Text>
              <Text style={styles.statLabel}>Tentativas falhadas</Text>
            </View>
          </View>
          <Text style={styles.smallMuted}>
            {stats.oldestCapturedAt
              ? "Amostra mais antiga: " + new Date(stats.oldestCapturedAt).toLocaleString()
              : "Não existem posições pendentes na fila local."}
          </Text>
        </View>

        {loads.length > 0 && !serviceRunning ? (
          <Pressable
            disabled={busy}
            onPress={handleStartTracking}
            style={({ pressed }) => [
              styles.primaryButton,
              (pressed || busy) && styles.buttonDimmed,
            ]}
          >
            {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Activar rastreamento GPS</Text>}
          </Pressable>
        ) : null}

        <Pressable
          disabled={busy || stats.pending === 0}
          onPress={handleSync}
          style={({ pressed }) => [
            styles.secondaryButton,
            (pressed || busy || stats.pending === 0) && styles.buttonDimmed,
          ]}
        >
          {busy ? <ActivityIndicator color="#176B45" /> : <Text style={styles.secondaryButtonText}>Sincronizar posições agora</Text>}
        </Pressable>

        <Pressable
          disabled={busy}
          onPress={refreshData}
          style={styles.textButton}
        >
          <Text style={styles.textButtonLabel}>{loading ? "A actualizar…" : "Actualizar cargas e estado"}</Text>
        </Pressable>

        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}

        <View style={styles.privacyCard}>
          <Text style={styles.privacyTitle}>Localização e privacidade</Text>
          <Text style={styles.smallMuted}>
            Enquanto existirem entregas em trânsito, a localização é partilhada com o comprador e com a operação AgriLink. O serviço mantém uma notificação visível. Sem GPS ou sem energia não é possível recolher novas posições.
          </Text>
        </View>

        <Pressable disabled={busy} onPress={handleSignOut} style={styles.textButton}>
          <Text style={styles.signOutLabel}>Terminar sessão</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F5F7F4" },
  centered: {
    flex: 1,
    backgroundColor: "#F5F7F4",
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    gap: 14,
  },
  content: { padding: 20, paddingBottom: 40, gap: 18 },
  loginCard: {
    margin: 20,
    marginTop: 48,
    padding: 24,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    gap: 10,
  },
  brand: { color: "#176B45", fontSize: 28, fontWeight: "900", letterSpacing: -1 },
  eyebrow: { color: "#738077", fontSize: 10, fontWeight: "800", letterSpacing: 1.5 },
  heading: { color: "#17251D", fontSize: 23, fontWeight: "800", marginTop: 8 },
  body: { color: "#68766D", fontSize: 13, lineHeight: 20 },
  fieldLabel: { color: "#34443A", fontSize: 12, fontWeight: "800", marginTop: 10 },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#DCE4DE",
    borderRadius: 12,
    paddingHorizontal: 14,
    color: "#17251D",
    backgroundColor: "#FFFFFF",
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: 13,
    backgroundColor: "#176B45",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    marginTop: 8,
  },
  primaryButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  secondaryButton: {
    minHeight: 48,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#176B45",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    backgroundColor: "#FFFFFF",
  },
  secondaryButtonText: { color: "#176B45", fontSize: 13, fontWeight: "800" },
  buttonDimmed: { opacity: 0.55 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#FFFFFF",
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  dotActive: { backgroundColor: "#17945C" },
  dotIdle: { backgroundColor: "#D59A2A" },
  statusText: { color: "#34443A", fontSize: 10, fontWeight: "800" },
  summaryCard: { padding: 20, borderRadius: 18, backgroundColor: "#E7F1EA", gap: 4 },
  cardEyebrow: { color: "#4D705B", fontSize: 10, fontWeight: "900", letterSpacing: 1.2 },
  bigNumber: { color: "#176B45", fontSize: 42, fontWeight: "900" },
  section: { gap: 10 },
  sectionTitle: { color: "#17251D", fontSize: 16, fontWeight: "900" },
  loadCard: { backgroundColor: "#FFFFFF", borderRadius: 14, padding: 15, gap: 5 },
  loadName: { color: "#17251D", fontSize: 14, fontWeight: "800" },
  routeText: { color: "#526158", fontSize: 12, lineHeight: 18 },
  loadId: { color: "#8A968E", fontSize: 10, fontWeight: "700" },
  emptyCard: { padding: 18, backgroundColor: "#FFFFFF", borderRadius: 14, gap: 7 },
  statsRow: { flexDirection: "row", gap: 10 },
  statCard: { flex: 1, backgroundColor: "#FFFFFF", borderRadius: 14, padding: 15, gap: 4 },
  statNumber: { color: "#176B45", fontSize: 24, fontWeight: "900" },
  statLabel: { color: "#738077", fontSize: 10, fontWeight: "700" },
  smallMuted: { color: "#78857D", fontSize: 11, lineHeight: 17 },
  textButton: { minHeight: 40, alignItems: "center", justifyContent: "center" },
  textButtonLabel: { color: "#176B45", fontSize: 12, fontWeight: "800" },
  signOutLabel: { color: "#A04444", fontSize: 12, fontWeight: "800" },
  footer: { color: "#89958D", fontSize: 10, lineHeight: 16, marginTop: 8 },
  privacyCard: { padding: 15, borderRadius: 14, backgroundColor: "#EEF1ED", gap: 6 },
  privacyTitle: { color: "#34443A", fontSize: 12, fontWeight: "900" },
  error: { color: "#A04444", fontSize: 12, lineHeight: 18 },
  notice: { color: "#176B45", fontSize: 12, lineHeight: 18 },
});
