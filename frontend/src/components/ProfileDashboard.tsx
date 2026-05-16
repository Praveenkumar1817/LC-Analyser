"use client";

import { toPng } from 'html-to-image';
import PortfolioCardPreview from './PortfolioCardPreview';
import React, { useMemo, useState, useCallback, useEffect } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Cell,
  LineChart, Line, CartesianGrid, Legend,
} from "recharts";
import {
  Activity, Trophy, Zap, Code2, Target, Hash,
  Loader2, CheckCircle2, User, Flame, Calendar, Star, Sparkles,
  Filter, ArrowRightLeft, Building2, CheckCircle, ArrowLeft,
  ChevronRight, TrendingUp, Award, BarChart2, Layers, BrainCircuit, HelpCircle
} from "lucide-react";

/* ─── Helpers ───────────────────────────────────────────────────────── */

function fmtInt(n: number | undefined | null) {
  if (n === null || n === undefined || !Number.isFinite(n)) return "N/A";
  return Math.round(n).toLocaleString();
}

function pct(n: number | undefined | null, digits = 1) {
  if (n === null || n === undefined || !Number.isFinite(n)) return "N/A";
  return `${n.toFixed(digits)}%`;
}

/* ─── Topic mapping ──────────────────────────────────────────────── */

const MAJOR_TOPIC_ORDER = [
  "Arrays & Hashing", "Two Pointers", "Sliding Window", "Stack",
  "Binary Search", "Linked List", "Trees", "Tries",
  "Heap / Priority Queue", "Backtracking", "Graphs",
  "Dynamic Programming", "Greedy", "Intervals", "Math",
  "Bit Manipulation", "Strings",
] as const;

function tagToMajorTopic(tag: string): (typeof MAJOR_TOPIC_ORDER)[number] | null {
  const t = (tag || "").trim().toLowerCase();
  if (t === "array" || t === "hash table" || t === "hashmap" || t === "hashing") return "Arrays & Hashing";
  if (t === "two pointers") return "Two Pointers";
  if (t === "sliding window") return "Sliding Window";
  if (t === "stack" || t === "monotonic stack") return "Stack";
  if (t === "binary search") return "Binary Search";
  if (t === "linked list") return "Linked List";
  if (t === "tree" || t === "binary tree" || t === "binary search tree" || t === "n-ary tree") return "Trees";
  if (t === "trie") return "Tries";
  if (t === "heap (priority queue)" || t === "priority queue" || t === "heap") return "Heap / Priority Queue";
  if (t === "backtracking") return "Backtracking";
  if (t === "graph" || t === "graphs" || t === "union find" || t === "minimum spanning tree" || t === "topological sort" || t === "shortest path") return "Graphs";
  if (t === "dynamic programming") return "Dynamic Programming";
  if (t === "greedy") return "Greedy";
  if (t === "intervals" || t === "line sweep") return "Intervals";
  if (t === "math" || t === "number theory" || t === "geometry" || t === "combinatorics") return "Math";
  if (t === "bit manipulation" || t === "bitmask") return "Bit Manipulation";
  if (t === "string" || t === "strings") return "Strings";
  return null;
}

function aggregateMajorTopicsFromTopics(topics: any) {
  const tagCounts: Record<string, number> = topics?.topic_data || {};
  const tagSkills: Record<string, number> = topics?.topic_skills || {};
  const majorTopicCounts: Record<string, number> = {};
  for (const [tag, count] of Object.entries(tagCounts)) {
    const major = tagToMajorTopic(tag);
    if (!major) continue;
    majorTopicCounts[major] = (majorTopicCounts[major] || 0) + (count || 0);
  }
  const acc: Record<string, number[]> = {};
  for (const [tag, score] of Object.entries(tagSkills)) {
    const major = tagToMajorTopic(tag);
    if (!major) continue;
    (acc[major] ||= []).push(score || 0);
  }
  const majorTopicSkills: Record<string, number> = {};
  for (const major of MAJOR_TOPIC_ORDER) {
    const arr = acc[major] || [];
    if (arr.length === 0) continue;
    majorTopicSkills[major] = Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
  }
  return { majorTopicCounts, majorTopicSkills };
}

/* ─── Section types ─────────────────────────────────────────────── */

type SectionId = "overview" | "problem_solving" | "competitive" | "comparison" | "company_readiness" | "recommendations";

const SECTIONS: { id: SectionId; label: string; icon: React.ElementType; shortLabel: string }[] = [
  { id: "overview",          label: "Overview",               shortLabel: "Overview",    icon: BarChart2 },
  { id: "problem_solving",   label: "Problem Solving",         shortLabel: "Problems",    icon: Code2 },
  { id: "competitive",       label: "Competitive",             shortLabel: "Competitive", icon: Trophy },
  { id: "comparison",        label: "Compare Users",          shortLabel: "Compare",     icon: ArrowRightLeft },
  { id: "company_readiness", label: "Company Readiness",      shortLabel: "Companies",   icon: Building2 },
  { id: "recommendations",   label: "AI Recommendations",     shortLabel: "AI Roadmap",  icon: BrainCircuit },
];

/* ─── Sub-components ────────────────────────────────────────────── */

function Divider() {
  return <div style={{ height: 1, background: "var(--border)", margin: "0" }} />;
}

function MetaKV({ label, value, mono = false, tooltip }: { label: string; value: React.ReactNode; mono?: boolean; tooltip?: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-3)", marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
        {label}
        {tooltip && (
          <span title={tooltip} style={{ cursor: "help", display: "inline-flex", alignItems: "center" }}>
            <HelpCircle size={10} color="var(--text-3)" />
          </span>
        )}
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-1)", fontFamily: mono ? "'JetBrains Mono', monospace" : "inherit" }}>{value}</div>
    </div>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "3px 10px", borderRadius: 99,
      fontSize: 11, fontWeight: 700, letterSpacing: "0.06em",
      background: `${color}18`, color, border: `1px solid ${color}30`,
    }}>
      {label}
    </span>
  );
}

function ProgressBar({ value, max = 100, color = "var(--primary)" }: { value: number; max?: number; color?: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="progress-track" style={{ height: 6, width: "100%" }}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 1.2, ease: [0.25, 1, 0.5, 1] }}
        style={{
          height: "100%", borderRadius: 99,
          background: `linear-gradient(90deg, ${color} 0%, ${color}88 100%)`,
        }}
      />
    </div>
  );
}

function ScoreRing({ score, size = 120 }: { score: number; size?: number }) {
  const r = (size / 2) - 10;
  const circ = 2 * Math.PI * r;
  const dash = circ * Math.min(1, score / 100);
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={10} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke="url(#ringGrad)"
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - dash }}
          transition={{ duration: 1.5, ease: [0.25, 1, 0.5, 1], delay: 0.3 }}
        />
        <defs>
          <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#5b6ef5" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
        </defs>
      </svg>
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
      }}>
        <span style={{ fontSize: size * 0.22, fontWeight: 800, color: "var(--text-1)", lineHeight: 1 }}>
          {Number.isFinite(score) ? score.toFixed(1) : "—"}
        </span>
        <span style={{ fontSize: size * 0.095, fontWeight: 600, color: "var(--text-3)", letterSpacing: "0.05em" }}>/ 100</span>
      </div>
    </div>
  );
}

function ScoreBreakdownBars({ breakdown }: { breakdown: { volume: number; quality: number; contest: number; consistency: number } }) {
  const rows = [
    { k: "Volume",      v: breakdown.volume,      color: "#5b6ef5" },
    { k: "Quality",     v: breakdown.quality,      color: "#a855f7" },
    { k: "Contest",     v: breakdown.contest,      color: "#22d3ee" },
    { k: "Consistency", v: breakdown.consistency,  color: "#10b981" },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {rows.map(r => (
        <div key={r.k}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)" }}>{r.k}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-1)", fontFamily: "'JetBrains Mono', monospace" }}>{r.v.toFixed(1)}</span>
          </div>
          <ProgressBar value={r.v} color={r.color} />
        </div>
      ))}
    </div>
  );
}

function StatTile({ label, value, icon: Icon, accent, tooltip }: { label: string; value: string | number; icon: React.ElementType; accent: string; tooltip?: string }) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: 16,
        padding: "1.25rem 1.5rem",
        display: "flex", flexDirection: "column", gap: 12,
      }}
    >
      <div style={{
        width: 36, height: 36,
        background: `${accent}18`,
        border: `1px solid ${accent}25`,
        borderRadius: 10,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icon size={17} color={accent} />
      </div>
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-3)", marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
          {label}
          {tooltip && (
            <span title={tooltip} style={{ cursor: "help", display: "inline-flex", alignItems: "center" }}>
              <HelpCircle size={11} color="var(--text-3)" />
            </span>
          )}
        </div>
        <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text-1)", letterSpacing: "-0.02em" }}>{value}</div>
      </div>
    </motion.div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--text-1)", letterSpacing: "-0.02em", margin: 0 }}>{title}</h2>
      {subtitle && <p style={{ fontSize: 13, color: "var(--text-2)", marginTop: 4, lineHeight: 1.6 }}>{subtitle}</p>}
    </div>
  );
}

/* ─── Main dashboard ────────────────────────────────────────────── */

export default function ProfileDashboard({ data, onBack }: { data: any; onBack: () => void }) {
  const [activeSection, setActiveSection] = useState<SectionId>("overview");
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [recommendation, setRecommendation] = useState<string | null>(null);

  const [extraTopicsOpen, setExtraTopicsOpen] = useState(false);
  const [selectedExtraTopics, setSelectedExtraTopics] = useState<string[]>([]);

  const [compareUsername, setCompareUsername] = useState("");
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [compareData, setCompareData] = useState<any>(null);

  const [gapTarget, setGapTarget] = useState<"fintech" | "product_tier_1" | "product_tier_2" | "service_based">("product_tier_1");
  const [gapLoading, setGapLoading] = useState(false);
  const [gapError, setGapError] = useState<string | null>(null);
  const [gapReport, setGapReport] = useState<any>(null);

  const {
    stats, username, avatar_url, real_name, topics,
    skill_score: rootSkillScore, score_breakdown,
    percentile_estimate, confidence: confRaw,
    confidence_reason: confReasonRaw, rating_trend,
    specialisation, submission_cv, platform_coverage,
  } = data;

  const confidence = confRaw ?? "low";
  const confidence_reason = confReasonRaw ?? "";
  const mySkillScore = typeof rootSkillScore === "number" ? rootSkillScore : Number(rootSkillScore) || 0;
  const breakdown = score_breakdown || { volume: 0, quality: 0, contest: 0, consistency: 0 };

  const api = useMemo(
    () => axios.create({ baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1" }),
    []
  );

  const tagCounts: Record<string, number> = topics?.topic_data || {};
  const tagSkills: Record<string, number> = topics?.topic_skills || {};

  const majorTopicCounts = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const [tag, count] of Object.entries(tagCounts)) {
      const major = tagToMajorTopic(tag);
      if (!major) continue;
      acc[major] = (acc[major] || 0) + (count || 0);
    }
    return acc;
  }, [tagCounts]);

  const majorTopicSkills = useMemo(() => {
    const acc: Record<string, number[]> = {};
    for (const [tag, score] of Object.entries(tagSkills)) {
      const major = tagToMajorTopic(tag);
      if (!major) continue;
      (acc[major] ||= []).push(score || 0);
    }
    const out: Record<string, number> = {};
    for (const major of MAJOR_TOPIC_ORDER) {
      const arr = acc[major] || [];
      if (!arr.length) continue;
      out[major] = Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
    }
    return out;
  }, [tagSkills]);

  const defaultMajorTopics = useMemo(() => {
    const scored = MAJOR_TOPIC_ORDER
      .map(t => ({ t, count: majorTopicCounts[t] || 0 }))
      .filter(x => x.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
      .map(x => x.t);
    return scored.length > 0 ? scored : ["Dynamic Programming", "Graphs", "Trees"];
  }, [majorTopicCounts]);

  const mutualContests = useMemo(() => {
    if (!data?.contest_history || !compareData?.contest_history) return [];
    
    // index by title
    const map = new Map<string, any>();
    for (const h of data.contest_history) {
      map.set(h.title, { title: h.title, startTime: h.startTime, u1Rating: h.rating, u1Rank: h.ranking });
    }
    
    const result = [];
    for (const h of compareData.contest_history) {
      if (map.has(h.title)) {
        const entry = map.get(h.title);
        const dateStr = new Date(h.startTime * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric" });
        
        const u1R = entry.u1Rating;
        const u2R = h.rating;
        const u1Diff = Math.abs(u1R - u2R).toFixed(1);
        
        // Find winner contextually? If absolute rating is plotted, the winner of the contest is the one with highest rank, not rating, but rating is ok to say who is currently higher
        const winner = u1R > u2R ? username : compareData.username;
        
        result.push({
          title: h.title,
          date: dateStr,
          startTime: h.startTime,
          u1Rating: u1R,
          u2Rating: u2R,
          u1Rank: entry.u1Rank,
          u2Rank: h.ranking,
          winner,
          u1Diff
        });
      }
    }
    // Sort by timestamp chronologically
    result.sort((a, b) => a.startTime - b.startTime);
    return result;
  }, [data, compareData, username]);

  const radarMajorData = useMemo(() =>
    defaultMajorTopics.map(subject => ({ subject, A: majorTopicSkills[subject] ?? 0, fullMark: 100 })),
    [defaultMajorTopics, majorTopicSkills]
  );

  const extraTopicOptions = useMemo(() =>
    Object.keys(tagCounts)
      .sort((a, b) => (tagCounts[b] || 0) - (tagCounts[a] || 0)),
    [tagCounts]
  );

  const extraTopicBarData = useMemo(() =>
    selectedExtraTopics
      .filter(t => tagCounts[t] !== undefined)
      .map(name => ({ name, solved: tagCounts[name] || 0 })),
    [selectedExtraTopics, tagCounts]
  );

  const topicDifficultyMap = data.topics?.topic_difficulty || {};
  const stackedBarData = useMemo(() => {
    return MAJOR_TOPIC_ORDER
      .filter(t => (majorTopicCounts[t] || 0) > 0)
      .map(t => {
        const diff = topicDifficultyMap[t] || { easy: 0, medium: 0, hard: 0 };
        return {
          name: t,
          total: majorTopicCounts[t],
          Easy: diff.easy || 0,
          Medium: diff.medium || 0,
          Hard: diff.hard || 0,
        };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [majorTopicCounts, topicDifficultyMap]);

  const coachingInsights = useMemo(() => {
    const insights = [];
    if (submission_cv > 1.5) {
      insights.push({ title: "Erratic Execution", text: "Your daily submission variance is very high. You tend to burst-solve on specific days rather than maintaining consistency.", type: "warning", icon: Flame });
    } else {
      insights.push({ title: "Consistent Builder", text: "You maintain a steady, disciplined daily solving rhythm with low variance.", type: "success", icon: Zap });
    }

    if (specialisation > 0.6) {
      insights.push({ title: "Deep Specialist", text: "Your solves are heavily skewed towards a few specific algorithms. Consider broadening your execution range to prevent blind spots.", type: "warning", icon: BrainCircuit });
    } else {
      insights.push({ title: "Balanced Generalist", text: "You have a mathematically well-distributed algorithmic execution pattern without over-reliance on a single topic.", type: "success", icon: Target });
    }

    const activeMajorTopics = MAJOR_TOPIC_ORDER.filter(t => majorTopicSkills[t] !== undefined);
    if (activeMajorTopics.length >= 2) {
      let topTopic = activeMajorTopics[0];
      let bottomTopic = activeMajorTopics[0];
      for (const t of activeMajorTopics) {
        if (majorTopicSkills[t] > majorTopicSkills[topTopic]) topTopic = t;
        if (majorTopicSkills[t] < majorTopicSkills[bottomTopic]) bottomTopic = t;
      }
      insights.push({ title: "Subject Mastery", text: `Your mathematically strongest measured domain is ${topTopic}. Your weakest is ${bottomTopic} (focus here).`, type: "info", icon: Award });
    }

    return insights;
  }, [submission_cv, specialisation, majorTopicSkills]);

  const compareAggregates = useMemo(() =>
    compareData?.topics ? aggregateMajorTopicsFromTopics(compareData.topics) : null,
    [compareData]
  );

  const compareSkillScore = useMemo(() => {
    if (!compareData) return null;
    const v = compareData.skill_score;
    if (v === undefined || v === null) return null;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : null;
  }, [compareData]);

  const majorTopicDeltaRows = useMemo(() => {
    if (!compareAggregates) return [];
    const bCounts = compareAggregates.majorTopicCounts;
    const bSkills = compareAggregates.majorTopicSkills;
    const keys = new Set<string>([...Object.keys(majorTopicCounts), ...Object.keys(bCounts)]);
    const rows = Array.from(keys).map(topic => ({
      topic,
      countA: majorTopicCounts[topic] || 0,
      countB: bCounts[topic] || 0,
      delta: (bCounts[topic] || 0) - (majorTopicCounts[topic] || 0),
      skillA: majorTopicSkills[topic],
      skillB: bSkills[topic],
    }));
    rows.sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta) || y.countA + y.countB - (x.countA + x.countB));
    return rows.filter(r => r.countA > 0 || r.countB > 0);
  }, [compareAggregates, majorTopicCounts, majorTopicSkills]);

  const comparisonVerdict = useMemo(() => {
    if (!compareData || compareSkillScore === null) return null;
    const s2 = compareData.stats || {};
    let u1 = 0, u2 = 0;
    const metrics: { label: string; leader: "a" | "b" | "tie"; detail: string }[] = [];
    const push = (label: string, a: number, b: number, detail: string) => {
      if (a > b) { u1++; metrics.push({ label, leader: "a", detail }); }
      else if (b > a) { u2++; metrics.push({ label, leader: "b", detail }); }
      else metrics.push({ label, leader: "tie", detail: "—" });
    };
    push("Skill score", mySkillScore, compareSkillScore, `+${Math.abs(mySkillScore - compareSkillScore).toFixed(1)}`);
    push("Total solved", stats.total_solved || 0, s2.total_solved || 0, `+${Math.abs((stats.total_solved || 0) - (s2.total_solved || 0))}`);
    const r1 = Number(stats.contest_rating || 0), r2 = Number(s2.contest_rating || 0);
    if (r1 > 0 && r2 > 0) push("Contest rating", r1, r2, `+${Math.round(Math.abs(r1 - r2))}`);
    const tp1 = Number(stats.top_percentage ?? 100), tp2 = Number(s2.top_percentage ?? 100);
    push("Contest top % (lower=better)", tp2, tp1, "better position");
    let majorWinsA = 0, majorWinsB = 0;
    if (compareAggregates) {
      for (const topic of MAJOR_TOPIC_ORDER) {
        const ca = majorTopicCounts[topic] || 0, cb = compareAggregates.majorTopicCounts[topic] || 0;
        if (ca > cb) majorWinsA++; else if (cb > ca) majorWinsB++;
      }
      if (majorWinsA > majorWinsB) { u1++; metrics.push({ label: "Topic breadth", leader: "a", detail: `${majorWinsA} vs ${majorWinsB}` }); }
      else if (majorWinsB > majorWinsA) { u2++; metrics.push({ label: "Topic breadth", leader: "b", detail: `${majorWinsB} vs ${majorWinsA}` }); }
      else metrics.push({ label: "Topic breadth", leader: "tie", detail: "—" });
    }

    const rt1 = typeof rating_trend === "number" ? rating_trend : 0;
    const rt2 = typeof compareData.rating_trend === "number" ? compareData.rating_trend : 0;
    if (rt1 !== 0 || rt2 !== 0) {
      push("Rating Momentum", rt1, rt2, `+${Math.abs(rt1 - rt2).toFixed(2)} trend`);
    }

    const cv1 = typeof submission_cv === "number" ? submission_cv : 1;
    const cv2 = typeof compareData.submission_cv === "number" ? compareData.submission_cv : 1;
    // Lower CV means more consistent daily problem solving
    if (cv1 !== cv2) {
      push("Daily Consistency (Lower CV)", cv2, cv1, "more consistent");
    }
    const headline = u1 > u2 ? username : u2 > u1 ? compareData.username : "Even";
    return { u1, u2, metrics, headline, majorWinsA, majorWinsB };
  }, [compareData, compareAggregates, compareSkillScore, mySkillScore, stats, username, majorTopicCounts]);

  const loadGapReport = useCallback(async () => {
    setGapLoading(true); setGapError(null);
    try {
      const res = await api.get(`/users/gap/${username}`, { params: { target: gapTarget } });
      setGapReport(res.data);
    } catch (err: any) {
      setGapError(err?.response?.data?.detail || "Failed to load readiness report");
      setGapReport(null);
    } finally { setGapLoading(false); }
  }, [api, username, gapTarget]);

  useEffect(() => {
    if (activeSection === "company_readiness") loadGapReport();
  }, [activeSection, gapTarget, loadGapReport]);

  const handleCompare = async (e: React.FormEvent) => {
    e.preventDefault();
    const u2 = compareUsername.trim();
    if (!u2) return;
    setCompareLoading(true); setCompareError(null); setCompareData(null);
    try {
      const res = await api.get(`/users/profile/${u2}`);
      setCompareData(res.data);
    } catch (err: any) {
      setCompareError(err?.response?.data?.detail || "Failed to load second user");
    } finally { setCompareLoading(false); }
  };

  const handleGenerateRoadmap = async () => {
    setLoadingRecs(true);
    try {
      const res = await api.post(`/users/recommendations/${username}`);
      setRecommendation(res.data.recommendation_markdown);
    } catch {
      setRecommendation("Failed to generate recommendations. Ensure the backend is running and Gemini API key is configured.");
    } finally { setLoadingRecs(false); }
  };

  const [exportingCard, setExportingCard] = useState(false);

  const handleExportCard = useCallback(async () => {
    const node = document.getElementById('portfolio-card-canvas');
    if (!node) return;
    setExportingCard(true);
    try {
      // Short timeout to ensure DOM is ready
      await new Promise(r => setTimeout(r, 100));
      const dataUrl = await toPng(node, { quality: 1, backgroundColor: "#0B1120" });
      const link = document.createElement('a');
      link.download = `${username}-leetcode-portfolio.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to export card', err);
    } finally {
      setExportingCard(false);
    }
  }, [username]);

  const difficultyData = [
    { name: "Easy",   count: stats.easy_solved,   fill: "#10b981" },
    { name: "Medium", count: stats.medium_solved,  fill: "#f59e0b" },
    { name: "Hard",   count: stats.hard_solved,    fill: "#f43f5e" },
  ];

  /* confidence styling */
  const confStyle = confidence === "high"
    ? { background: "rgba(16,185,129,0.1)", color: "#10b981", border: "1px solid rgba(16,185,129,0.25)" }
    : confidence === "medium"
    ? { background: "rgba(245,158,11,0.1)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.25)" }
    : { background: "rgba(244,63,94,0.1)", color: "#f43f5e", border: "1px solid rgba(244,63,94,0.25)" };
  const confLabel = confidence === "high" ? "High Confidence" : confidence === "medium" ? "Medium Confidence" : "Low – need more data";

  /* ─── Layout ── */
  return (
    <div style={{ display: "flex", minHeight: "100vh", flexDirection: "column" }}>

      <div style={{ position: "absolute", left: "-9999px", top: "-9999px" }}>
        <PortfolioCardPreview data={data} />
      </div>

      {/* ── Top bar ── */}
      <header style={{
        position: "sticky", top: 0, zIndex: 40,
        background: "rgba(7,11,20,0.85)",
        backdropFilter: "blur(20px)",
        borderBottom: "1px solid var(--border)",
        padding: "0 1.5rem",
      }}>
        <div style={{
          maxWidth: 1400, margin: "0 auto", height: 56,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
        }}>
          {/* Logo + back */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <button
              onClick={onBack}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                background: "var(--bg-elevated)", border: "1px solid var(--border)",
                borderRadius: 9, padding: "5px 12px",
                color: "var(--text-2)", fontSize: 13, fontWeight: 600,
                cursor: "pointer", fontFamily: "inherit",
                transition: "color .15s, border-color .15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.color = "var(--text-1)"; e.currentTarget.style.borderColor = "var(--border-mid)"; }}
              onMouseLeave={e => { e.currentTarget.style.color = "var(--text-2)"; e.currentTarget.style.borderColor = "var(--border)"; }}
            >
              <ArrowLeft size={14} />
              Back
            </button>
            <div style={{ width: 1, height: 20, background: "var(--border)" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{
                width: 28, height: 28,
                background: "linear-gradient(135deg, var(--primary) 0%, var(--purple) 100%)",
                borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Zap size={13} color="#fff" fill="#fff" />
              </div>
              <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text-1)" }}>
                LC<span style={{ color: "var(--primary-light)" }}>Analyzer</span>
              </span>
            </div>
          </div>

          {/* Profile pill */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {avatar_url && (
              <img src={avatar_url} alt={username}
                style={{ width: 30, height: 30, borderRadius: 8, objectFit: "cover", border: "1px solid var(--border)" }} />
            )}
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)" }}>{username}</span>
            <span style={{
              fontSize: 11, fontWeight: 800, letterSpacing: "0.05em",
              padding: "2px 10px", borderRadius: 99,
              background: "linear-gradient(135deg, var(--primary) 0%, var(--purple) 100%)",
              color: "#fff",
            }}>
              {Number.isFinite(mySkillScore) ? mySkillScore.toFixed(1) : "—"}&nbsp;/&nbsp;100
            </span>
          </div>
        </div>
      </header>

      {/* ── Body (sidebar + content) ── */}
      <div style={{ display: "flex", flex: 1, maxWidth: 1400, margin: "0 auto", width: "100%", padding: "0" }}>

        {/* ── Sidebar ── */}
        <aside style={{
          width: 220,
          flexShrink: 0,
          borderRight: "1px solid var(--border)",
          padding: "1.5rem 0",
          display: "flex",
          flexDirection: "column",
          gap: 4,
          position: "sticky",
          top: 56,
          height: "calc(100vh - 56px)",
          overflowY: "auto",
        }}>
          {SECTIONS.map(s => {
            const active = activeSection === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "9px 20px",
                  background: active ? "var(--primary-dim)" : "transparent",
                  borderLeft: `3px solid ${active ? "var(--primary)" : "transparent"}`,
                  borderTop: "none", borderRight: "none", borderBottom: "none",
                  color: active ? "var(--primary-light)" : "var(--text-2)",
                  fontSize: 13, fontWeight: active ? 700 : 500,
                  cursor: "pointer", fontFamily: "inherit",
                  textAlign: "left", width: "100%",
                  transition: "background .15s, color .15s, border-color .15s",
                }}
                onMouseEnter={e => { if (!active) { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.color = "var(--text-1)"; } }}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-2)"; } }}
              >
                <s.icon size={15} />
                {s.label}
              </button>
            );
          })}

          {/* Profile summary in sidebar */}
          <div style={{ marginTop: "auto", padding: "1.5rem 20px", borderTop: "1px solid var(--border)" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {avatar_url && (
                <img src={avatar_url} alt={username}
                  style={{ width: 44, height: 44, borderRadius: 12, objectFit: "cover", border: "1px solid var(--border)" }} />
              )}
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-1)" }}>{real_name || username}</div>
                <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>@{username}</div>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: "rgba(245,158,11,0.12)", color: "#f59e0b" }}>
                  🔥 {stats.streak_days}d streak
                </span>
                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: "rgba(34,211,238,0.1)", color: "#22d3ee" }}>
                  {stats.active_days} active days
                </span>
              </div>
            </div>
            
            <button
              onClick={handleExportCard}
              disabled={exportingCard}
              style={{
                width: "100%", marginTop: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "10px", background: "rgba(139, 92, 246, 0.15)", color: "#c4b5fd",
                border: "1px solid rgba(139, 92, 246, 0.3)", borderRadius: 10, fontSize: 12, fontWeight: 700,
                cursor: exportingCard ? "wait" : "pointer", transition: "all 0.2s"
              }}
              onMouseEnter={e => { if (!exportingCard) { e.currentTarget.style.background = "rgba(139, 92, 246, 0.25)"; } }}
              onMouseLeave={e => { if (!exportingCard) { e.currentTarget.style.background = "rgba(139, 92, 246, 0.15)"; } }}
            >
              {exportingCard ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Trophy size={14} />}
              {exportingCard ? "Generating..." : "Export Portfolio Card"}
            </button>
          </div>
        </aside>

        {/* ── Main content ── */}
        <main style={{ flex: 1, padding: "2rem", overflowX: "hidden", minWidth: 0 }}>
          <AnimatePresence mode="wait">

            {/* ── OVERVIEW ── */}
            {activeSection === "overview" && (
              <motion.div
                key="overview"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                {/* Profile hero */}
                <div style={{
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 20,
                  padding: "2rem",
                  marginBottom: "1.5rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "2rem",
                  flexWrap: "wrap",
                  position: "relative",
                  overflow: "hidden",
                }}>
                  {/* Decorative blob */}
                  <div style={{
                    position: "absolute", right: -60, top: -60,
                    width: 240, height: 240,
                    background: "radial-gradient(circle, rgba(91,110,245,0.12) 0%, transparent 70%)",
                    pointerEvents: "none",
                  }} />

                  <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", zIndex: 1 }}>
                    {avatar_url && (
                      <div style={{ position: "relative" }}>
                        <img src={avatar_url} alt={username}
                          style={{ width: 72, height: 72, borderRadius: 18, objectFit: "cover", border: "2px solid var(--border-mid)" }} />
                        <div style={{
                          position: "absolute", bottom: -4, right: -4,
                          width: 20, height: 20, borderRadius: 99,
                          background: "#10b981",
                          border: "2px solid var(--bg-base)",
                        }} />
                      </div>
                    )}
                    <div>
                      <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-1)", letterSpacing: "-0.02em", margin: "0 0 4px" }}>
                        {real_name || username}
                      </h1>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-3)", fontSize: 13, marginBottom: 10 }}>
                        <User size={13} />
                        <span>@{username}</span>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <Badge label={`Top ${pct(stats.top_percentage, 1)}`} color="#f59e0b" />
                        <Badge label={`${stats.active_days} Active Days`} color="#22d3ee" />
                        <Badge label={`${stats.streak_days}d Streak`} color="#f97316" />
                      </div>
                    </div>
                  </div>

                  {/* Skill score ring */}
                  <div style={{ display: "flex", alignItems: "center", gap: "2.5rem", zIndex: 1, flexWrap: "wrap" }}>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-3)", marginBottom: 6 }}>Contest Rating</div>
                      <div style={{ fontSize: 28, fontWeight: 800, color: "var(--text-1)" }}>
                        {stats.contest_rating > 0 ? stats.contest_rating.toFixed(0) : "—"}
                      </div>
                    </div>
                    <div style={{ width: 1, height: 60, background: "var(--border)" }} />
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--primary-light)", marginBottom: 10 }}>Skill Score</div>
                      <ScoreRing score={mySkillScore} size={110} />
                    </div>
                  </div>
                </div>

                {/* Stat tiles */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
                  <StatTile label="Total Solved"        value={stats.total_solved}                                                                    icon={Code2}       accent="#5b6ef5" />
                  <StatTile label="Acceptance Rate"     value={`${stats.acceptance_rate?.toFixed(1)}%`}                                               icon={Target}      accent="#a855f7" />
                  <StatTile label="Best Contest Rank"   value={stats.best_contest_rank && stats.best_contest_rank < 999999 ? `#${fmtInt(stats.best_contest_rank)}` : "N/A"} icon={Hash} accent="#22d3ee" />
                  <StatTile label="Consistency"         value={pct((stats.consistency_ratio || 0) * 100, 0)}                                          icon={Activity}    accent="#10b981" />
                </div>

                {/* Score breakdown + confidence */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
                  <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "1.5rem" }}>
                    <SectionHeader title="Score Breakdown" subtitle="Unified 0–100 model: volume · quality · contest · consistency" />
                    <ScoreBreakdownBars breakdown={breakdown} />
                  </div>
                  <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "1.5rem" }}>
                    <SectionHeader title="Confidence & Standing" />
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-3)", marginBottom: 8 }}>Model Confidence</div>
                        <span style={{ display: "inline-flex", alignItems: "center", padding: "5px 14px", borderRadius: 99, fontSize: 12, fontWeight: 700, ...confStyle }}>
                          {confLabel}
                        </span>
                        <p style={{ fontSize: 12, color: "var(--text-2)", marginTop: 8, lineHeight: 1.6 }}>{confidence_reason}</p>
                      </div>
                      {(confidence === "medium" || confidence === "high") && typeof percentile_estimate === "number" && (
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-3)", marginBottom: 6 }}>Estimated Standing</div>
                          <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-1)" }}>
                            Top&nbsp;
                            <span className="grad-text-primary">
                              {Math.max(0, Math.min(100, Math.round(100 - percentile_estimate)))}%
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Charts */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  {/* Difficulty bar chart */}
                  <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "1.5rem" }}>
                    <SectionHeader title="Problem Difficulty" subtitle="Distribution across Easy, Medium, Hard" />
                    <div style={{ height: 220 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={difficultyData} barSize={48} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontWeight: 700, fontSize: 12 }} dy={8} />
                          <Tooltip cursor={{ fill: "rgba(255,255,255,0.03)", radius: 8 }} />
                          <Bar dataKey="count" radius={[10, 10, 0, 0]} animationBegin={200} animationDuration={1200}>
                            {difficultyData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Radar chart */}
                  <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "1.5rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
                      <SectionHeader title="Topic Skill Radar" subtitle="Top 8 major categories by problems solved" />
                      <button
                        onClick={() => setExtraTopicsOpen(true)}
                        style={{
                          display: "flex", alignItems: "center", gap: 5,
                          background: "var(--bg-elevated)", border: "1px solid var(--border)",
                          borderRadius: 8, padding: "5px 12px",
                          color: "var(--text-2)", fontSize: 11, fontWeight: 700,
                          cursor: "pointer", fontFamily: "inherit",
                          whiteSpace: "nowrap", flexShrink: 0,
                        }}
                      >
                        <Filter size={12} /> Filter
                      </button>
                    </div>
                    <div style={{ height: 220 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarMajorData}>
                          <PolarGrid stroke="rgba(255,255,255,0.07)" />
                          <PolarAngleAxis dataKey="subject" tick={{ fill: "#64748b", fontSize: 10, fontWeight: 700 }} />
                          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                          <Radar name="Skill" dataKey="A" stroke="#5b6ef5" strokeWidth={2.5} fill="#5b6ef5" fillOpacity={0.18} animationBegin={400} />
                          <Tooltip />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── PROBLEM SOLVING ── */}
            {activeSection === "problem_solving" && (
              <motion.div
                key="problem_solving"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <SectionHeader title="Problem Solving" subtitle="Major topic coverage with counts aggregated into core algorithm buckets." />

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                  {coachingInsights.map((insight, idx) => {
                    const bgColor = insight.type === "warning" ? "rgba(244,63,94,0.1)" : insight.type === "success" ? "rgba(16,185,129,0.1)" : "rgba(34,211,238,0.1)";
                    const textColor = insight.type === "warning" ? "#f43f5e" : insight.type === "success" ? "#10b981" : "#22d3ee";
                    return (
                      <div key={idx} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "1.2rem", display: "flex", gap: "1rem", alignItems: "flex-start" }}>
                        <div style={{ background: bgColor, color: textColor, padding: 10, borderRadius: 12 }}>
                          <insight.icon size={20} />
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text-1)", marginBottom: 4 }}>{insight.title}</div>
                          <div style={{ fontSize: 12, lineHeight: 1.5, color: "var(--text-2)" }}>{insight.text}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  {/* Major topics Stacked BarChart */}
                  <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "1.5rem" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-3)", marginBottom: 16 }}>Major Topics Distribution</div>
                    <div style={{ height: 400, marginLeft: "-1.5rem", marginTop: "-1rem" }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart layout="vertical" data={stackedBarData} margin={{ top: 20, right: 30, left: 35, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} horizontal={false} />
                          <XAxis type="number" stroke="#64748b" tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} axisLine={false} />
                          <YAxis dataKey="name" type="category" stroke="#64748b" tick={{ fill: "var(--text-2)", fontSize: 11, fontWeight: 600 }} tickLine={false} axisLine={false} width={100} />
                          <Tooltip 
                            cursor={{ fill: "rgba(255,255,255,0.02)" }}
                            contentStyle={{ background: "#0B1120", border: "1px solid #1e293b", borderRadius: 8 }}
                          />
                          <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                          <Bar dataKey="Easy" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                          <Bar dataKey="Medium" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} />
                          <Bar dataKey="Hard" stackId="a" fill="#f43f5e" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Extra topics picker panel */}
                  <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "1.5rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-3)" }}>Other Topics</div>
                        <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 3 }}>Select niche tags to inspect</div>
                      </div>
                      <button
                        onClick={() => setExtraTopicsOpen(true)}
                        style={{
                          display: "flex", alignItems: "center", gap: 5,
                          background: "var(--bg-elevated)", border: "1px solid var(--border)",
                          borderRadius: 8, padding: "6px 14px",
                          color: "var(--text-2)", fontSize: 12, fontWeight: 700,
                          cursor: "pointer", fontFamily: "inherit",
                        }}
                      >
                        <Filter size={13} /> Select
                      </button>
                    </div>
                    {extraTopicBarData.length === 0 ? (
                      <div style={{
                        display: "flex", flexDirection: "column", alignItems: "center",
                        justifyContent: "center", height: 180,
                        color: "var(--text-3)", fontSize: 13, gap: 8,
                      }}>
                        <Filter size={24} />
                        <span>No topics selected yet</span>
                        <button
                          onClick={() => setExtraTopicsOpen(true)}
                          style={{
                            marginTop: 4,
                            background: "var(--primary-dim)", border: "1px solid rgba(91,110,245,0.3)",
                            borderRadius: 8, padding: "6px 14px",
                            color: "var(--primary-light)", fontSize: 12, fontWeight: 700,
                            cursor: "pointer", fontFamily: "inherit",
                          }}
                        >
                          Pick topics →
                        </button>
                      </div>
                    ) : (
                      <div style={{ height: 220 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={extraTopicBarData} margin={{ top: 10, right: 10, left: -20, bottom: 30 }}>
                            <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 11, fontWeight: 700 }} interval={0} angle={-20} textAnchor="end" height={50} />
                            <YAxis tick={{ fill: "#4e6080", fontSize: 11 }} />
                            <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                            <Bar dataKey="solved" fill="#5b6ef5" radius={[8, 8, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── COMPETITIVE ── */}
            {activeSection === "competitive" && (
              <motion.div
                key="competitive"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <SectionHeader title="Competitive Programming" subtitle="Contest performance metrics and unified skill assessment." />

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
                  <StatTile label="Contest Rating"    value={stats.contest_rating > 0 ? fmtInt(stats.contest_rating) : "N/A"}                                                        icon={Star}     accent="#f59e0b" />
                  <StatTile label="Contests Attended" value={stats.contests_attended ? fmtInt(stats.contests_attended) : "N/A"}                                                      icon={Trophy}   accent="#5b6ef5" />
                  <StatTile label="Best Rank"         value={stats.best_contest_rank && stats.best_contest_rank < 999999 ? `#${fmtInt(stats.best_contest_rank)}` : "N/A"}           icon={Hash}     accent="#22d3ee" />
                  <StatTile label="Avg Rank"          value={stats.avg_contest_rank ? `#${fmtInt(stats.avg_contest_rank)}` : "N/A"}                                                 icon={Activity} accent="#a855f7" />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
                  <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "1.5rem" }}>
                    <SectionHeader title="Ranking Signals" />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                      <MetaKV label="Contest Top %" value={pct(stats.top_percentage, 1)} tooltip="Percentage rank among all LeetCode users in contests (Lower is better)." />
                      <MetaKV label="Global Rank" value={stats.global_rank ? `#${fmtInt(stats.global_rank)}` : "N/A"} tooltip="Overall worldwide leaderboard ranking on LeetCode." />
                      <MetaKV label="Skill Score" value={`${mySkillScore.toFixed(1)} / 100`} mono tooltip="A holistic 0-100 skill score deterministically calculated combining volume, quality, consistency and contest ratings." />
                      <MetaKV label="Rating Trend" value={typeof rating_trend === "number" ? rating_trend.toFixed(2) : "—"} mono tooltip="Trajectory (slope) of the user's contest rating over recent contests. Positive means improving." />
                    </div>
                  </div>
                  <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "1.5rem" }}>
                    <SectionHeader title="Advanced Signals" />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                      <MetaKV label="Topic Specialisation" value={typeof specialisation === "number" ? specialisation.toFixed(2) : "—"} mono tooltip="0 = Generalist (Evenly spread topics). 1 = Pointed Specialist (Grinding a single topic)." />
                      <MetaKV label="Submission CV" value={typeof submission_cv === "number" ? submission_cv.toFixed(2) : "—"} mono tooltip="Coefficient of Variation for daily submissions. Higher means bursty activity, lower means consistent daily practice." />
                      <MetaKV label="Platform Coverage" value={typeof platform_coverage === "number" ? `${(platform_coverage * 100).toFixed(1)}%` : "—"} mono tooltip="Percentage of the total available problem set solved by the user." />
                      <MetaKV label="Active Days" value={stats.active_days ?? "N/A"} tooltip="Total number of days this user was active on the platform." />
                      <MetaKV label="Streak" value={`${stats.streak_days ?? 0} days`} tooltip="Current continuous streak of daily submissions/activity." />
                    </div>
                  </div>
                </div>

                {/* Skill score ring featured */}
                <div style={{
                  background: "linear-gradient(135deg, var(--bg-surface) 0%, var(--bg-elevated) 100%)",
                  border: "1px solid var(--border-mid)", borderRadius: 16, padding: "2rem",
                  display: "flex", alignItems: "center", gap: "3rem", flexWrap: "wrap",
                  position: "relative", overflow: "hidden",
                }}>
                  <div style={{
                    position: "absolute", right: -40, top: -40,
                    width: 200, height: 200,
                    background: "radial-gradient(circle, rgba(91,110,245,0.15) 0%, transparent 70%)",
                    pointerEvents: "none",
                  }} />
                  <ScoreRing score={mySkillScore} size={140} />
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-1)", marginBottom: 8 }}>Unified Skill Score</div>
                    <p style={{ fontSize: 13, color: "var(--text-2)", maxWidth: 360, lineHeight: 1.65, marginBottom: 16 }}>
                      Computed from problem volume, solution quality, contest performance, and submission consistency. Same model used across all sections.
                    </p>
                    <span style={{ display: "inline-flex", alignItems: "center", padding: "5px 14px", borderRadius: 99, fontSize: 12, fontWeight: 700, ...confStyle }}>
                      {confLabel}
                    </span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── COMPARISON ── */}
            {activeSection === "comparison" && (
              <motion.div
                key="comparison"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <SectionHeader title="Compare Users" subtitle="Match the current profile against any other LeetCode username." />

                {/* Search form */}
                <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "1.5rem", marginBottom: "1.5rem" }}>
                  <form onSubmit={handleCompare} style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 220 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-3)", marginBottom: 6 }}>Second Username</div>
                      <input
                        value={compareUsername}
                        onChange={e => setCompareUsername(e.target.value)}
                        placeholder="e.g. tourist"
                        style={{
                          width: "100%", background: "var(--bg-elevated)",
                          border: "1px solid var(--border-mid)", borderRadius: 10,
                          padding: "9px 14px", color: "var(--text-1)",
                          fontSize: 14, fontWeight: 500, fontFamily: "inherit",
                          outline: "none",
                        }}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={compareLoading}
                      style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "9px 20px", marginTop: 20,
                        background: "linear-gradient(135deg, var(--primary) 0%, var(--purple) 100%)",
                        border: "none", borderRadius: 10,
                        color: "#fff", fontSize: 13, fontWeight: 700,
                        cursor: compareLoading ? "not-allowed" : "pointer",
                        opacity: compareLoading ? 0.7 : 1,
                        fontFamily: "inherit",
                      }}
                    >
                      {compareLoading ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : <ArrowRightLeft size={15} />}
                      Compare
                    </button>
                  </form>
                  {compareError && (
                    <div style={{ marginTop: 12, padding: "8px 12px", background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)", borderRadius: 8, color: "#f43f5e", fontSize: 13 }}>
                      {compareError}
                    </div>
                  )}
                </div>

                {compareData && compareSkillScore !== null && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    {/* Verdict banner */}
                    {comparisonVerdict && (
                      <div style={{
                        background: "linear-gradient(135deg, rgba(91,110,245,0.1) 0%, rgba(168,85,247,0.08) 100%)",
                        border: "1px solid rgba(91,110,245,0.2)", borderRadius: 16, padding: "1.5rem",
                      }}>
                        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-3)", marginBottom: 8 }}>Verdict</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text-1)", marginBottom: 6 }}>
                          {comparisonVerdict.headline === "Even"
                            ? <>Metrics are <span style={{ color: "var(--primary-light)" }}>evenly matched</span></>
                            : <><span style={{ color: "var(--primary-light)" }}>{comparisonVerdict.headline}</span> leads on more metrics ({comparisonVerdict.u1} vs {comparisonVerdict.u2})</>
                          }
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8, marginTop: 12 }}>
                          {comparisonVerdict.metrics.map(m => (
                            <div key={m.label} style={{
                              display: "flex", justifyContent: "space-between",
                              background: "rgba(0,0,0,0.2)", border: "1px solid var(--border)",
                              borderRadius: 10, padding: "8px 12px",
                            }}>
                              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)" }}>{m.label}</span>
                              <span style={{ fontSize: 12, fontWeight: 700, color: m.leader === "tie" ? "var(--text-3)" : m.leader === "a" ? "var(--primary-light)" : "#a855f7" }}>
                                {m.leader === "tie" ? "Tie" : m.leader === "a" ? username : compareData.username}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Side by side stat tiles */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                      <StatTile label={`${username} Solved`}          value={stats.total_solved}                              icon={Code2}     accent="#5b6ef5" />
                      <StatTile label={`${compareData.username} Solved`} value={compareData.stats?.total_solved ?? 0}       icon={Code2}     accent="#a855f7" />
                      <StatTile label={`${username} Skill`}           value={mySkillScore.toFixed(1)}                        icon={Sparkles}  accent="#22d3ee" />
                      <StatTile label={`${compareData.username} Skill`} value={compareSkillScore.toFixed(1)}                icon={Sparkles}  accent="#f59e0b" />
                    </div>

                    {/* Score breakdown side by side */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "1.5rem" }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: "var(--primary-light)", marginBottom: 16 }}>{username}</div>
                        <ScoreBreakdownBars breakdown={breakdown} />
                      </div>
                      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "1.5rem" }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: "#a855f7", marginBottom: 16 }}>{compareData.username}</div>
                        <ScoreBreakdownBars breakdown={compareData.score_breakdown || { volume: 0, quality: 0, contest: 0, consistency: 0 }} />
                      </div>
                    </div>

                    {/* Comprehensive Stats & Signals side by side */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "1.5rem" }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: "var(--primary-light)", marginBottom: 16 }}>{username} Stats & Signals</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                          <MetaKV label="Active Days" value={stats.active_days ?? "N/A"} />
                          <MetaKV label="Current Streak" value={stats.streak_days ? `${stats.streak_days} days` : "N/A"} />
                          <MetaKV label="Contest Avg Rank" value={stats.avg_contest_rank ? `#${fmtInt(stats.avg_contest_rank)}` : "N/A"} />
                          <MetaKV label="Contest Top %" value={pct(stats.top_percentage, 1)} />
                          <MetaKV label="Acceptance Rate" value={stats.acceptance_rate ? `${stats.acceptance_rate.toFixed(1)}%` : "N/A"} />
                          <MetaKV label="Rating Trend" value={typeof rating_trend === "number" ? rating_trend.toFixed(2) : "—"} mono tooltip="Trajectory (slope) of the user's contest rating over recent contests. Positive means improving." />
                          <MetaKV label="Analysis Entropy" value={typeof specialisation === "number" ? specialisation.toFixed(2) : "—"} mono tooltip="0 = Generalist. 1 = Narrow Specialist." />
                          <MetaKV label="Submission CV" value={typeof submission_cv === "number" ? submission_cv.toFixed(2) : "—"} mono tooltip="Coefficient of Variation for daily submissions (Lower means more consistent)." />
                          <MetaKV label="Platform Coverage" value={typeof platform_coverage === "number" ? `${(platform_coverage * 100).toFixed(1)}%` : "—"} mono />
                        </div>
                      </div>
                      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "1.5rem" }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: "#a855f7", marginBottom: 16 }}>{compareData.username} Stats & Signals</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                          <MetaKV label="Active Days" value={compareData.stats?.active_days ?? "N/A"} />
                          <MetaKV label="Current Streak" value={compareData.stats?.streak_days ? `${compareData.stats.streak_days} days` : "N/A"} />
                          <MetaKV label="Contest Avg Rank" value={compareData.stats?.avg_contest_rank ? `#${fmtInt(compareData.stats.avg_contest_rank)}` : "N/A"} />
                          <MetaKV label="Contest Top %" value={pct(compareData.stats?.top_percentage, 1)} />
                          <MetaKV label="Acceptance Rate" value={compareData.stats?.acceptance_rate ? `${compareData.stats.acceptance_rate.toFixed(1)}%` : "N/A"} />
                          <MetaKV label="Rating Trend" value={typeof compareData.rating_trend === "number" ? compareData.rating_trend.toFixed(2) : "—"} mono />
                          <MetaKV label="Analysis Entropy" value={typeof compareData.specialisation === "number" ? compareData.specialisation.toFixed(2) : "—"} mono />
                          <MetaKV label="Submission CV" value={typeof compareData.submission_cv === "number" ? compareData.submission_cv.toFixed(2) : "—"} mono />
                          <MetaKV label="Platform Coverage" value={typeof compareData.platform_coverage === "number" ? `${(compareData.platform_coverage * 100).toFixed(1)}%` : "—"} mono />
                        </div>
                      </div>
                    </div>

                    {/* Head to Head Chart */}
                    {mutualContests.length > 0 && (
                      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "1.5rem", overflowX: "auto" }}>
                        <SectionHeader title="Head-to-Head Performance Timeline" subtitle="Direct absolute rating comparison in contests both users participated in" />
                        <div style={{ height: 350, marginTop: "1.5rem", marginLeft: "-1.5rem" }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={mutualContests} margin={{ top: 20, right: 30, left: 0, bottom: 10 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} vertical={false} />
                              <XAxis dataKey="date" stroke="#64748b" tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} axisLine={false} />
                              <YAxis domain={['auto', 'auto']} stroke="#64748b" tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(val) => Math.round(Number(val)).toString()} />
                              <Tooltip
                                content={({ active, payload, label }) => {
                                  if (active && payload && payload.length >= 2) {
                                    const rawData = payload[0].payload;
                                    const u1 = payload.find((p: any) => p.dataKey === "u1Rating");
                                    const u2 = payload.find((p: any) => p.dataKey === "u2Rating");
                                    const winner = rawData.u1Rank < rawData.u2Rank ? username : compareData.username;
                                    const diff = Math.abs(rawData.u1Rank - rawData.u2Rank);
                                    
                                    return (
                                      <div style={{ background: "#0B1120", border: "1px solid #1e293b", borderRadius: 8, padding: "12px 16px", color: "white", boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5)", zIndex: 100 }}>
                                        <p style={{ fontWeight: 800, fontSize: 13, color: "var(--text-1)", marginBottom: 4 }}>{rawData.title}</p>
                                        <p style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 12 }}>{label}</p>
                                        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
                                          <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                                            <span style={{ color: u1?.color, fontSize: 12, fontWeight: 700 }}>{username}:</span>
                                            <span style={{ color: u1?.color, fontSize: 12, fontWeight: 700, fontFamily: "monospace" }}>{Math.round(u1?.value || 0)}</span>
                                          </div>
                                          <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
                                            <span style={{ color: u2?.color, fontSize: 12, fontWeight: 700 }}>{compareData.username}:</span>
                                            <span style={{ color: u2?.color, fontSize: 12, fontWeight: 700, fontFamily: "monospace" }}>{Math.round(u2?.value || 0)}</span>
                                          </div>
                                        </div>
                                        <div style={{ paddingTop: 8, borderTop: "1px solid #1e293b", fontSize: 11, color: "var(--text-2)" }}>
                                          <span style={{ color: winner === username ? "#22d3ee" : "#f43f5e", fontWeight: "bold" }}>Winner: {winner}</span>
                                        </div>
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                                cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1 }}
                              />
                              <Legend wrapperStyle={{ fontSize: 12, fontWeight: 600, paddingTop: 10 }} />
                              <Line type="monotone" dataKey="u1Rating" name={username} stroke="#22d3ee" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                              <Line type="monotone" dataKey="u2Rating" name={compareData.username} stroke="#f43f5e" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}

                    {/* Topic delta table */}
                    {majorTopicDeltaRows.length > 0 && (
                      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "1.5rem", overflowX: "auto" }}>
                        <SectionHeader title="Major Topics — Side by Side" subtitle={`Delta = ${compareData.username} minus ${username}`} />
                        <table style={{ width: "100%", minWidth: 540, borderCollapse: "collapse", fontSize: 13 }}>
                          <thead>
                            <tr style={{ borderBottom: "1px solid var(--border)" }}>
                              {["Topic", username, compareData.username, "Δ Solved", "Skill Avg"].map(h => (
                                <th key={h} style={{ paddingBottom: 10, paddingRight: 14, textAlign: "left", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-3)" }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {majorTopicDeltaRows.map(row => (
                              <tr key={row.topic} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                                <td style={{ padding: "9px 14px 9px 0", fontWeight: 700, color: "var(--text-1)" }}>{row.topic}</td>
                                <td style={{ paddingRight: 14, color: "var(--text-2)", fontWeight: 600 }}>{fmtInt(row.countA)}</td>
                                <td style={{ paddingRight: 14, color: "var(--text-2)", fontWeight: 600 }}>{fmtInt(row.countB)}</td>
                                <td style={{ paddingRight: 14, fontWeight: 800, color: row.delta === 0 ? "var(--text-3)" : row.delta > 0 ? "#10b981" : "#f43f5e" }}>
                                  {row.delta > 0 ? `+${row.delta}` : row.delta}
                                </td>
                                <td style={{ color: "var(--text-3)", fontFamily: "'JetBrains Mono', monospace" }}>
                                  {row.skillA != null || row.skillB != null ? `${row.skillA ?? "—"} vs ${row.skillB ?? "—"}` : "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {/* ── COMPANY READINESS ── */}
            {activeSection === "company_readiness" && (
              <motion.div
                key="company_readiness"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <SectionHeader title="Company Readiness" subtitle="Target role coverage vs. your topic profile and volume." />

                {/* Target selector */}
                <div style={{ display: "flex", gap: 10, marginBottom: "1.5rem", flexWrap: "wrap" }}>
                  {(["fintech", "product_tier_1", "product_tier_2", "service_based"] as const).map(c => {
                    const displayNames: Record<string, string> = {
                      fintech: "Fintech",
                      product_tier_1: "Product Based Tier 1",
                      product_tier_2: "Product Based Tier 2",
                      service_based: "Service Based"
                    };
                    return (
                    <button
                      key={c}
                      onClick={() => setGapTarget(c)}
                      style={{
                        padding: "8px 20px",
                        background: gapTarget === c ? "var(--primary-dim)" : "var(--bg-surface)",
                        border: `1px solid ${gapTarget === c ? "rgba(91,110,245,0.4)" : "var(--border)"}`,
                        borderRadius: 10,
                        color: gapTarget === c ? "var(--primary-light)" : "var(--text-2)",
                        fontSize: 13, fontWeight: 700,
                        cursor: "pointer", fontFamily: "inherit",
                        textTransform: "capitalize",
                        transition: "all .2s",
                      }}
                    >
                      {displayNames[c]}
                    </button>
                  )})}
                  <button
                    onClick={loadGapReport}
                    disabled={gapLoading}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "8px 18px",
                      background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 10,
                      color: "var(--text-2)", fontSize: 13, fontWeight: 700,
                      cursor: gapLoading ? "not-allowed" : "pointer", fontFamily: "inherit",
                      opacity: gapLoading ? 0.6 : 1,
                    }}
                  >
                    {gapLoading ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> : <TrendingUp size={13} />}
                    Refresh
                  </button>
                </div>

                {gapError && (
                  <div style={{ marginBottom: 16, padding: "10px 14px", background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)", borderRadius: 10, color: "#f43f5e", fontSize: 13 }}>
                    {gapError}
                  </div>
                )}

                {gapLoading && !gapReport && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "4rem", color: "var(--text-2)" }}>
                    <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} />
                    Loading readiness report…
                  </div>
                )}

                {gapReport && (
                  <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: "1rem" }}>
                    {/* Score ring panel */}
                    <div style={{
                      background: "var(--bg-surface)", border: "1px solid var(--border)",
                      borderRadius: 16, padding: "1.5rem",
                      display: "flex", flexDirection: "column", alignItems: "center", gap: 14, justifyContent: "center",
                    }}>
                      <div style={{
                        position: "relative", width: 140, height: 140,
                        background: `conic-gradient(from 0deg, #5b6ef5 ${gapReport.readiness_score * 3.6}deg, rgba(255,255,255,0.07) 0deg)`,
                        borderRadius: "50%",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <div style={{
                          width: 110, height: 110, borderRadius: "50%",
                          background: "var(--bg-base)",
                          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                        }}>
                          <span style={{ fontSize: 28, fontWeight: 800, color: "var(--text-1)" }}>{gapReport.readiness_score.toFixed(0)}</span>
                          <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>readiness</span>
                        </div>
                      </div>
                      <span style={{
                        fontSize: 12, fontWeight: 700, padding: "4px 16px", borderRadius: 99,
                        ...(gapReport.is_ready ? { background: "rgba(16,185,129,0.12)", color: "#10b981", border: "1px solid rgba(16,185,129,0.25)" }
                          : { background: "rgba(245,158,11,0.12)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.25)" }),
                      }}>
                        {gapReport.is_ready ? "✓ Ready" : "Not Ready Yet"}
                      </span>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Est. weeks to bridge</div>
                        <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text-1)" }}>{gapReport.estimated_weeks}</div>
                      </div>
                    </div>

                    {/* Details */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                      {/* Company description */}
                      {gapReport.description && (
                        <div style={{ background: "var(--primary-dim)", border: "1px solid rgba(91,110,245,0.2)", borderRadius: 12, padding: "0.9rem 1.1rem", fontSize: 13, color: "var(--text-2)", lineHeight: 1.6 }}>
                          <span style={{ color: "var(--primary-light)", fontWeight: 700, marginRight: 6 }}>&#8505;</span>
                          {gapReport.description}
                        </div>
                      )}
                      {/* Strengths */}
                      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "1.25rem" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-3)", marginBottom: 10 }}>Strengths</div>
                        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                          {(gapReport.strengths || []).map((s: string, i: number) => (
                            <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: "#10b981", fontWeight: 600 }}>
                              <CheckCircle size={15} style={{ flexShrink: 0, marginTop: 2 }} />
                              {s}
                            </li>
                          ))}
                          {(!gapReport.strengths || gapReport.strengths.length === 0) && (
                            <li style={{ color: "var(--text-3)", fontSize: 13 }}>No strengths at target threshold — see gaps below.</li>
                          )}
                        </ul>
                      </div>

                      {/* Gaps table */}
                      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "1.25rem", overflowX: "auto" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-3)", marginBottom: 10 }}>Gap Analysis</div>
                        <table style={{ width: "100%", minWidth: 480, borderCollapse: "collapse", fontSize: 13 }}>
                          <thead>
                            <tr style={{ borderBottom: "1px solid var(--border)" }}>
                              {["Tag", "Solved", "Needed", "Priority", "Reason"].map(h => (
                                <th key={h} style={{ paddingBottom: 8, paddingRight: 12, textAlign: "left", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-3)" }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {(gapReport.gaps || []).map((g: any, i: number) => (
                              <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                                <td style={{ padding: "8px 12px 8px 0", fontWeight: 700, color: "var(--text-1)" }}>{g.tag}</td>
                                <td style={{ paddingRight: 12, color: "var(--text-2)" }}>{g.solved}</td>
                                <td style={{ paddingRight: 12, color: "var(--text-2)" }}>{g.needed}</td>
                                <td style={{ paddingRight: 12 }}>
                                  <span style={{
                                    fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 6, textTransform: "uppercase",
                                    ...(g.priority === "critical" ? { background: "rgba(244,63,94,0.12)", color: "#f43f5e" }
                                      : g.priority === "high" ? { background: "rgba(245,158,11,0.12)", color: "#f59e0b" }
                                      : { background: "rgba(100,116,139,0.15)", color: "#94a3b8" }),
                                  }}>
                                    {g.priority}
                                  </span>
                                </td>
                                <td style={{ color: "var(--text-3)", fontSize: 12 }}>{g.reason}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Action plan */}
                      {gapReport.action_plan?.length > 0 && (
                        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 16, padding: "1.25rem" }}>
                          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-3)", marginBottom: 10 }}>Action Plan</div>
                          <ol style={{ margin: 0, paddingLeft: "1.25rem", display: "flex", flexDirection: "column", gap: 6 }}>
                            {gapReport.action_plan.map((line: string, i: number) => (
                              <li key={i} style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.65 }}>{line}</li>
                            ))}
                          </ol>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* ── RECOMMENDATIONS ── */}
            {activeSection === "recommendations" && (
              <motion.div
                key="recommendations"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <SectionHeader title="AI Recommendations" subtitle="Gemini-powered personalised practice roadmap based on your profile." />

                {!recommendation ? (
                  <div style={{
                    background: "var(--bg-surface)", border: "1px solid var(--border)",
                    borderRadius: 20, padding: "3rem",
                    display: "flex", flexDirection: "column", alignItems: "center",
                    textAlign: "center", gap: 20,
                    position: "relative", overflow: "hidden",
                  }}>
                    <div style={{
                      position: "absolute", inset: 0,
                      background: "radial-gradient(ellipse 60% 60% at 50% 0%, rgba(91,110,245,0.08) 0%, transparent 70%)",
                      pointerEvents: "none",
                    }} />
                    <div style={{
                      width: 60, height: 60,
                      background: "var(--primary-dim)",
                      border: "1px solid rgba(91,110,245,0.3)",
                      borderRadius: 16,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <BrainCircuit size={28} color="var(--primary-light)" />
                    </div>
                    <div>
                      <h3 style={{ fontSize: 20, fontWeight: 800, color: "var(--text-1)", margin: "0 0 8px" }}>Generate Your Roadmap</h3>
                      <p style={{ fontSize: 14, color: "var(--text-2)", lineHeight: 1.65, maxWidth: 440, margin: 0 }}>
                        Analyzes your solved distribution, topic skills, and score breakdown to create
                        a tailored practice plan with specific next steps.
                      </p>
                    </div>
                    <button
                      onClick={handleGenerateRoadmap}
                      disabled={loadingRecs}
                      style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "12px 28px",
                        background: loadingRecs ? "var(--bg-elevated)" : "linear-gradient(135deg, var(--primary) 0%, var(--purple) 100%)",
                        border: "none", borderRadius: 12,
                        color: "#fff", fontSize: 15, fontWeight: 700,
                        cursor: loadingRecs ? "not-allowed" : "pointer",
                        fontFamily: "inherit",
                        boxShadow: loadingRecs ? "none" : "0 4px 24px rgba(91,110,245,0.35)",
                        transition: "all .2s",
                      }}
                      onMouseEnter={e => { if (!loadingRecs) e.currentTarget.style.transform = "translateY(-2px)"; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; }}
                    >
                      {loadingRecs
                        ? <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} />
                        : <Zap size={18} fill="currentColor" />
                      }
                      {loadingRecs ? "Generating…" : "Generate Plan"}
                    </button>
                  </div>
                ) : (
                  <AnimatePresence>
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#10b981", fontWeight: 700, fontSize: 14 }}>
                          <CheckCircle2 size={18} />
                          Plan generated
                        </div>
                        <button
                          onClick={() => setRecommendation(null)}
                          style={{
                            background: "var(--bg-elevated)", border: "1px solid var(--border)",
                            borderRadius: 8, padding: "5px 12px",
                            color: "var(--text-2)", fontSize: 12, fontWeight: 600,
                            cursor: "pointer", fontFamily: "inherit",
                          }}
                        >
                          Regenerate
                        </button>
                      </div>
                      <div className="prose-lc" style={{
                        background: "var(--bg-surface)", border: "1px solid var(--border)",
                        borderRadius: 16, padding: "1.75rem",
                        minHeight: 300,
                      }}>
                        <ReactMarkdown>{recommendation}</ReactMarkdown>
                      </div>
                    </motion.div>
                  </AnimatePresence>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* ── Extra Topics Modal ── */}
      <AnimatePresence>
        {extraTopicsOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setExtraTopicsOpen(false)}
            style={{
              position: "fixed", inset: 0, zIndex: 50,
              background: "rgba(0,0,0,0.65)",
              backdropFilter: "blur(8px)",
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: "1rem",
            }}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.98, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              style={{
                width: "100%", maxWidth: 680,
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-mid)",
                borderRadius: 20,
                padding: "1.5rem",
                maxHeight: "80vh",
                display: "flex", flexDirection: "column",
                boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: "var(--text-1)" }}>Other Topics</div>
                  <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 3 }}>Select tags to inspect without cluttering the main dashboard.</div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button
                    onClick={() => setSelectedExtraTopics([])}
                    style={{
                      background: "transparent", border: "1px solid var(--border)",
                      borderRadius: 8, padding: "4px 12px",
                      color: "var(--text-3)", fontSize: 11, fontWeight: 700,
                      cursor: "pointer", fontFamily: "inherit",
                    }}
                  >
                    Clear
                  </button>
                  <button
                    onClick={() => setExtraTopicsOpen(false)}
                    style={{
                      background: "var(--bg-overlay)", border: "1px solid var(--border)",
                      borderRadius: 8, padding: "5px 14px",
                      color: "var(--text-2)", fontSize: 12, fontWeight: 700,
                      cursor: "pointer", fontFamily: "inherit",
                    }}
                  >
                    Done
                  </button>
                </div>
              </div>

              <div style={{
                overflowY: "auto", flex: 1,
                display: "grid", gridTemplateColumns: "1fr 1fr",
                gap: 8,
              }}>
                {extraTopicOptions.slice(0, 60).map(t => {
                  const checked = selectedExtraTopics.includes(t);
                  return (
                    <label
                      key={t}
                      style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        background: checked ? "var(--primary-dim)" : "rgba(255,255,255,0.03)",
                        border: `1px solid ${checked ? "rgba(91,110,245,0.3)" : "var(--border)"}`,
                        borderRadius: 10, padding: "10px 14px",
                        cursor: "pointer", transition: "background .15s, border-color .15s",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)" }}>{t}</div>
                        <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>{fmtInt(tagCounts[t] || 0)} solved</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => setSelectedExtraTopics(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])}
                        style={{ accentColor: "var(--primary)", width: 16, height: 16, cursor: "pointer" }}
                      />
                    </label>
                  );
                })}
              </div>

              <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)", fontSize: 12, color: "var(--text-3)" }}>
                {selectedExtraTopics.length} selected · shown in Problem Solving and Overview tabs
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
