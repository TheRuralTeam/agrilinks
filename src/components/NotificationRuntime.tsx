import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../integrations/supabase/client";

function playBell() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const start = () => {
      const now = ctx.currentTime;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.16, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(660, now + 0.42);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.43);
      window.setTimeout(() => void ctx.close(), 600);
    };
    if (ctx.state === "suspended") {
      void ctx.resume().then(start).catch(() => void ctx.close());
    } else {
      start();
    }
  } catch {
    // O som é complementar; a notificação persistida e o Web Push continuam activos.
  }
}

export default function NotificationRuntime() {
  const { user } = useAuth();
  const seen = useRef(new Set<string>());

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`runtime-notifications-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const notification = payload.new as {
            id: string;
            title?: string | null;
            message?: string | null;
          };
          if (!notification.id || seen.current.has(notification.id)) return;
          seen.current.add(notification.id);
          if (seen.current.size > 100) {
            const first = seen.current.values().next().value;
            if (first) seen.current.delete(first);
          }

          playBell();
          toast(notification.title || "Nova notificação", {
            description: notification.message || "Tem uma nova atualização na AgriLink.",
            duration: 5000,
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user]);

  return null;
}
