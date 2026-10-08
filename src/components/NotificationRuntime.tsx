import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { getNotificationTargetPath } from "../lib/notificationNavigation";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../integrations/supabase/client";

function getAudioContext() {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  return AudioContextClass ? new AudioContextClass() : null;
}

function playBell(context: AudioContext) {
  try {
    if (context.state === "suspended") return;
    const now = context.currentTime;
    const master = context.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.12, now + 0.015);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
    master.connect(context.destination);

    const frequencies = [880, 1175];
    frequencies.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      oscillator.type = index === 0 ? "sine" : "triangle";
      oscillator.frequency.setValueAtTime(frequency, now + index * 0.045);
      oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.72, now + 0.48);
      oscillator.connect(master);
      oscillator.start(now + index * 0.045);
      oscillator.stop(now + 0.5);
    });
  } catch {
    // Notification persistence/toast continues when browser audio is unavailable.
  }
}

export default function NotificationRuntime() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const audioContextRef = useRef<AudioContext | null>(null);
  const seen = useRef(new Set<string>());

  useEffect(() => {
    const unlock = async () => {
      if (!audioContextRef.current) audioContextRef.current = getAudioContext();
      if (audioContextRef.current?.state === "suspended") {
        await audioContextRef.current.resume().catch(() => undefined);
      }
    };

    window.addEventListener("pointerdown", unlock, { capture: true });
    window.addEventListener("keydown", unlock, { capture: true });
    window.addEventListener("touchstart", unlock, { capture: true });

    return () => {
      window.removeEventListener("pointerdown", unlock, true);
      window.removeEventListener("keydown", unlock, true);
      window.removeEventListener("touchstart", unlock, true);
    };
  }, []);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`runtime-notifications-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          const notification = payload.new as {
            id: string;
            title?: string | null;
            message?: string | null;
            type?: string | null;
            metadata?: Record<string, unknown> | null;
          };

          if (!notification.id || seen.current.has(notification.id)) return;
          seen.current.add(notification.id);
          if (seen.current.size > 200) {
            const first = seen.current.values().next().value;
            if (first) seen.current.delete(first);
          }

          if (!audioContextRef.current) audioContextRef.current = getAudioContext();
          if (audioContextRef.current) {
            if (audioContextRef.current.state === "suspended") {
              await audioContextRef.current.resume().catch(() => undefined);
            }
            if (audioContextRef.current.state === "running") {
              playBell(audioContextRef.current);
            }
          }

          if ("vibrate" in navigator) {
            try { navigator.vibrate([120, 80, 120]); } catch { /* vibration is optional */ }
          }

          const targetPath = getNotificationTargetPath({
            id: notification.id,
            type: notification.type || "system",
            metadata: notification.metadata,
          });

          toast(notification.title || "Nova notificação", {
            description: notification.message || "Tem uma nova atualização na AgriLink.",
            duration: 7000,
            action: {
              label: "Abrir",
              onClick: () => navigate(targetPath),
            },
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, navigate]);

  useEffect(() => () => {
    const context = audioContextRef.current;
    audioContextRef.current = null;
    if (context) void context.close().catch(() => undefined);
  }, []);

  return null;
}
