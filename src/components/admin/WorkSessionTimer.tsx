import React from "react";
import { Card, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Clock, Play, Pause, Timer, TrendingUp } from "lucide-react";

interface WorkSessionTimerProps {
  elapsedTimeFormatted: string;
  isSessionActive: boolean;
  stats: {
    totalSessions: number;
    totalMinutes: number;
    avgSessionMinutes: number;
  } | null;
  onEndSession: () => void;
}

const formatMinutes = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
};

const WorkSessionTimer: React.FC<WorkSessionTimerProps> = ({
  elapsedTimeFormatted,
  isSessionActive,
  stats,
  onEndSession,
}) => {
  return (
    <Card className="border-0 shadow-sm bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20">
      <CardContent className="py-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Timer Display */}
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl ${isSessionActive ? "bg-green-100 dark:bg-green-800/50" : "bg-gray-100 dark:bg-gray-800"}`}>
              {isSessionActive ? (
                <Clock className="h-6 w-6 text-green-600 dark:text-green-400 animate-pulse" />
              ) : (
                <Pause className="h-6 w-6 text-gray-500" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-mono font-bold text-foreground">
                  {elapsedTimeFormatted}
                </span>
                {isSessionActive && (
                  <Badge className="bg-green-100 text-green-700 dark:bg-green-800 dark:text-green-300">
                    <Play className="h-3 w-3 mr-1" />
                    Ativo
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Tempo de trabalho atual
              </p>
            </div>
          </div>

          {/* Stats */}
          {stats && (
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Timer className="h-4 w-4" />
                  <span className="text-sm">Total Sessões</span>
                </div>
                <p className="text-lg font-semibold">{stats.totalSessions}</p>
              </div>
              <div className="text-center">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span className="text-sm">Tempo Total</span>
                </div>
                <p className="text-lg font-semibold">{formatMinutes(stats.totalMinutes)}</p>
              </div>
              <div className="text-center">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-sm">Média</span>
                </div>
                <p className="text-lg font-semibold">{formatMinutes(stats.avgSessionMinutes)}</p>
              </div>
            </div>
          )}

          {/* End Session Button */}
          {isSessionActive && (
            <Button
              variant="outline"
              size="sm"
              onClick={onEndSession}
              className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              <Pause className="h-4 w-4 mr-1" /> Encerrar Turno
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default WorkSessionTimer;
