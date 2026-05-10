import { Link } from "wouter";
import { useListCheckIns, useGetDashboardSummary, useGetDashboardTrends } from "@workspace/api-client-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export default function Dashboard() {
  const { data: summary } = useGetDashboardSummary();
  const { data: trends } = useGetDashboardTrends();

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <h1 className="text-3xl font-serif text-foreground">Insights</h1>
      
      <div className="grid md:grid-cols-3 gap-6">
        <div className="bg-card border border-border p-6 rounded-xl text-center">
          <p className="text-sm text-muted-foreground">Check-ins</p>
          <p className="text-3xl font-serif mt-2">{summary?.checkInCount || 0}</p>
        </div>
        <div className="bg-card border border-border p-6 rounded-xl text-center">
          <p className="text-sm text-muted-foreground">Journal Entries</p>
          <p className="text-3xl font-serif mt-2">{summary?.journalCount || 0}</p>
        </div>
        <div className="bg-card border border-border p-6 rounded-xl text-center">
          <p className="text-sm text-muted-foreground">Conversations</p>
          <p className="text-3xl font-serif mt-2">{summary?.sessionCount || 0}</p>
        </div>
      </div>

      <div className="bg-card border border-border p-6 rounded-xl space-y-6">
        <h2 className="text-xl font-serif">Your Path Over Time</h2>
        <div className="h-64">
          {trends?.points && trends.points.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trends.points}>
                <XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} domain={[0, 10]} />
                <Tooltip />
                <Line type="monotone" dataKey="distress" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="meaning" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
              Not enough data to show trends yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}