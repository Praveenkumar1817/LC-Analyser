import React from 'react';
import { Trophy, Code2, Sparkles, Target, Activity } from 'lucide-react';

interface PortfolioCardPreviewProps {
  data: any;
}

export default function PortfolioCardPreview({ data }: PortfolioCardPreviewProps) {
  const {
    stats = {}, username, real_name,
    skill_score: rootSkillScore
  } = data || {};

  const mySkillScore = typeof rootSkillScore === "number" ? rootSkillScore : Number(rootSkillScore) || 0;
  
  // Format top 3 skills
  const tagCounts: Record<string, number> = data?.topics?.topic_data || {};
  const topTopics = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(x => x[0]);

  return (
    <div 
      id="portfolio-card-canvas" 
      style={{
        width: 800,
        height: 420,
        background: "radial-gradient(circle at top right, #1e1b4b 0%, #0B1120 100%)",
        border: "1px solid rgba(139, 92, 246, 0.2)",
        borderRadius: 24,
        padding: 40,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        fontFamily: "'Inter', sans-serif, -apple-system, BlinkMacSystemFont",
        color: "white",
        boxSizing: "border-box",
        position: "relative",
        overflow: "hidden"
      }}
    >
      {/* Background graphical elements */}
      <div style={{ position: "absolute", top: -100, right: -100, width: 400, height: 400, background: "rgba(139, 92, 246, 0.25)", filter: "blur(100px)", borderRadius: "50%" }} />
      <div style={{ position: "absolute", bottom: -100, left: -100, width: 350, height: 350, background: "rgba(56, 189, 248, 0.15)", filter: "blur(80px)", borderRadius: "50%" }} />

      <div style={{ zIndex: 10, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 36, fontWeight: 900, letterSpacing: "-0.02em", color: "#f8fafc" }}>{real_name || username}</h1>
          <p style={{ margin: "4px 0 0 0", fontSize: 18, color: "#a855f7", fontWeight: 600 }}>@{username}</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(255,255,255,0.05)", padding: "10px 20px", borderRadius: 100, border: "1px solid rgba(255,255,255,0.1)" }}>
            <Sparkles size={20} color="#38bdf8" />
            <span style={{ fontSize: 24, fontWeight: 800, color: "white" }}>{mySkillScore.toFixed(1)}</span>
            <span style={{ fontSize: 14, color: "#94a3b8", fontWeight: 600 }}>Skill Score</span>
          </div>
        </div>
      </div>

      <div style={{ zIndex: 10, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, margin: "30px 0" }}>
        <div style={{ background: "rgba(0,0,0,0.4)", padding: 20, borderRadius: 16, border: "1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#cbd5e1", marginBottom: 12 }}>
            <Code2 size={16} color="#818cf8" /> <span style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Total Solved</span>
          </div>
          <div style={{ fontSize: 36, fontWeight: 800, color: "#f8fafc" }}>{stats.total_solved || 0}</div>
        </div>

        <div style={{ background: "rgba(0,0,0,0.4)", padding: 20, borderRadius: 16, border: "1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#cbd5e1", marginBottom: 12 }}>
            <Trophy size={16} color="#fbbf24" /> <span style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Global Rank</span>
          </div>
          <div style={{ fontSize: 36, fontWeight: 800, color: "#fcd34d" }}>
            {stats.global_rank ? `#${stats.global_rank.toLocaleString()}` : "N/A"}
          </div>
        </div>

        <div style={{ background: "rgba(0,0,0,0.4)", padding: 20, borderRadius: 16, border: "1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#cbd5e1", marginBottom: 12 }}>
            <Activity size={16} color="#34d399" /> <span style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Contest Rating</span>
          </div>
          <div style={{ fontSize: 36, fontWeight: 800, color: "#6ee7b7" }}>
            {Math.round(stats.contest_rating || 0)}
          </div>
        </div>
      </div>

      <div style={{ zIndex: 10, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h3 style={{ margin: "0 0 12px 0", fontSize: 13, color: "#cbd5e1", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>Top Specialties</h3>
          <div style={{ display: "flex", gap: 12 }}>
            {topTopics.length > 0 ? topTopics.map(t => (
              <span key={t} style={{ background: "rgba(168, 85, 247, 0.2)", color: "#e9d5ff", padding: "6px 14px", borderRadius: 8, fontSize: 14, fontWeight: 700, border: "1px solid rgba(168, 85, 247, 0.4)" }}>
                {t}
              </span>
            )) : <span style={{ color: "#94a3b8", fontSize: 14 }}>No topics mapped</span>}
          </div>
        </div>
        
        <div style={{ display: "flex", alignItems: "center", gap: 8, opacity: 0.7 }}>
          <Target size={16} color="#a855f7" />
          <span style={{ fontSize: 12, fontWeight: 800, color: "#94a3b8" }}>Analyzed by LeetCode Profiler</span>
        </div>
      </div>
    </div>
  );
}
