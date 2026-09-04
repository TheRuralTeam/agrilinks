import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface WorkSessionStats {
  totalSessions: number;
  totalMinutes: number;
  avgSessionMinutes: number;
}

export const useWorkSession = (userId: string | null, isSupportAgent: boolean) => {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [stats, setStats] = useState<WorkSessionStats | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Start a work session
  const startSession = useCallback(async () => {
    if (!userId || !isSupportAgent || sessionId) return;

    try {
      const { data, error } = await supabase
        .from('work_sessions')
        .insert({
          user_id: userId,
          started_at: new Date().toISOString(),
          is_active: true
        })
        .select('id')
        .single();

      if (error) throw error;

      setSessionId(data.id);
      setSessionStartTime(new Date());
      setElapsedSeconds(0);

      // Start the timer
      intervalRef.current = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);

    } catch (error) {
      console.error('Error starting work session:', error);
    }
  }, [userId, isSupportAgent, sessionId]);

  // End a work session
  const endSession = useCallback(async () => {
    if (!sessionId) return;

    try {
      const { error } = await supabase
        .from('work_sessions')
        .update({
          ended_at: new Date().toISOString(),
          is_active: false
        })
        .eq('id', sessionId);

      if (error) throw error;

      // Stop the timer
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      setSessionId(null);
      setSessionStartTime(null);
      setElapsedSeconds(0);

    } catch (error) {
      console.error('Error ending work session:', error);
    }
  }, [sessionId]);

  // Fetch session stats
  const fetchStats = useCallback(async () => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .rpc('get_work_session_stats', { p_user_id: userId });

      if (error) throw error;

      if (data && data[0]) {
        setStats({
          totalSessions: data[0].total_sessions || 0,
          totalMinutes: data[0].total_minutes || 0,
          avgSessionMinutes: data[0].avg_session_minutes || 0
        });
      }
    } catch (error) {
      console.error('Error fetching work session stats:', error);
    }
  }, [userId]);

  // Auto-start session when support agent logs in
  useEffect(() => {
    if (userId && isSupportAgent) {
      startSession();
      fetchStats();
    }

    // Cleanup on unmount or logout
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [userId, isSupportAgent, startSession, fetchStats]);

  // End session on page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (sessionId) {
        // Use sendBeacon for reliable session end
        const url = `${import.meta.env.VITE_SUPABASE_URL || 'https://oqcrfqtlfqwrxxmsjpaf.supabase.co'}/rest/v1/work_sessions?id=eq.${sessionId}`;
        const body = JSON.stringify({
          ended_at: new Date().toISOString(),
          is_active: false
        });
        
        navigator.sendBeacon(url, body);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [sessionId]);

  // Format elapsed time
  const formatElapsedTime = () => {
    const hours = Math.floor(elapsedSeconds / 3600);
    const minutes = Math.floor((elapsedSeconds % 3600) / 60);
    const seconds = elapsedSeconds % 60;

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return {
    sessionId,
    sessionStartTime,
    elapsedSeconds,
    elapsedTimeFormatted: formatElapsedTime(),
    stats,
    startSession,
    endSession,
    fetchStats,
    isSessionActive: !!sessionId
  };
};
