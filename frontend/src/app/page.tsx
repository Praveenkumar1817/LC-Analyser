"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Zap, Trophy, Target, Cpu, ArrowRight, Github, ChevronRight } from "lucide-react";
import axios from "axios";
import ProfileDashboard from "../components/ProfileDashboard";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1",
});

const FEATURES = [
  {
    icon: Cpu,
    label: "Skill Score",
    desc: "A unified 0–100 score computed from volume, quality, contest rating, and consistency — fully transparent, no black boxes.",
    color: "#5b6ef5",
  },
  {
    icon: Target,
    label: "Weakness Mapping",
    desc: "Pinpoint exactly which algorithm topics need targeted practice to level-up fastest.",
    color: "#a855f7",
  },
  {
    icon: Trophy,
    label: "Company Readiness",
    desc: "See your readiness score for Google, Meta, Amazon, Microsoft, and Startups with a prioritised gap plan.",
    color: "#22d3ee",
  },
];

const EXAMPLE_USERS = ["tourist", "neal_wu", "jiangly", "Um_nik"];

export default function Home() {
  const [username, setUsername] = useState("");
  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const u = username.trim();
    if (!u) return;
    setLoading(true);
    setError("");
    setProfileData(null);
    try {
      const res = await api.get(`/users/profile/${u}`);
      setProfileData(res.data);
    } catch (err: any) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail;
      if (status === 404) setError(typeof detail === "string" ? detail : "User not found on LeetCode.");
      else if (status === 503) setError(typeof detail === "string" ? detail : "LeetCode API temporarily unavailable. Try again shortly.");
      else if (status === 422) setError(typeof detail === "string" ? detail : "Could not parse this profile — it may be private.");
      else setError(typeof detail === "string" ? detail : "Request failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const tryUser = (u: string) => {
    setUsername(u);
  };

  if (profileData) {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key="dashboard"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
        >
          <ProfileDashboard data={profileData} onBack={() => setProfileData(null)} />
        </motion.div>
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.main
        key="landing"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}
      >
        {/* ── Top nav ── */}
        <nav style={{ borderBottom: "1px solid var(--border)", padding: "0 2rem" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 32, height: 32,
                background: "linear-gradient(135deg, var(--primary) 0%, var(--purple) 100%)",
                borderRadius: 9,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Zap size={16} color="#fff" fill="#fff" />
              </div>
              <span style={{ fontWeight: 700, fontSize: 15, color: "var(--text-1)", letterSpacing: "-0.01em" }}>
                LC<span style={{ color: "var(--primary-light)" }}>Analyzer</span>
              </span>
            </div>
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              style={{
                display: "flex", alignItems: "center", gap: 6,
                color: "var(--text-2)", fontSize: 13, fontWeight: 600,
                textDecoration: "none", transition: "color .2s",
              }}
              onMouseEnter={e => (e.currentTarget.style.color = "var(--text-1)")}
              onMouseLeave={e => (e.currentTarget.style.color = "var(--text-2)")}
            >
              <Github size={16} />
              GitHub
            </a>
          </div>
        </nav>

        {/* ── Hero ── */}
        <section style={{
          flex: 1, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          padding: "5rem 1.5rem 3rem",
          textAlign: "center",
          maxWidth: 760, margin: "0 auto", width: "100%",
        }}>
          {/* Pill */}
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <span className="pill-primary" style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "5px 14px", borderRadius: 99,
              fontSize: 12, fontWeight: 700, letterSpacing: "0.08em",
              textTransform: "uppercase", marginBottom: "2rem",
            }}>
              <Zap size={12} fill="currentColor" />
              ML-Powered · Free · Open Source
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            style={{
              fontSize: "clamp(2.4rem, 5vw, 4rem)",
              fontWeight: 700,
              lineHeight: 1.12,
              letterSpacing: "-0.03em",
              color: "var(--text-1)",
              margin: "0 0 1.25rem",
            }}
          >
            Know exactly where you{" "}
            <span className="grad-text-primary" style={{ fontWeight: 800 }}>
              stand on LeetCode
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            style={{
              color: "var(--text-2)", fontSize: "clamp(1rem, 2.5vw, 1.15rem)",
              lineHeight: 1.7, maxWidth: 560, margin: "0 auto 2.5rem",
            }}
          >
            Enter any LeetCode username to get a deep skill score, topic weakness map,
            company readiness report, and an AI-generated practice roadmap — in seconds.
          </motion.p>

          {/* Search */}
          <motion.form
            onSubmit={handleSearch}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            style={{ width: "100%", maxWidth: 540, position: "relative" }}
          >
            <div style={{
              display: "flex",
              alignItems: "center",
              background: "var(--bg-surface)",
              border: `1px solid ${error ? "rgba(244,63,94,0.4)" : "var(--border-mid)"}`,
              borderRadius: 14,
              padding: "4px 4px 4px 18px",
              boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
              gap: 10,
              transition: "border-color .2s, box-shadow .2s",
            }}
            onFocus={() => {}}
            >
              <Search size={18} color="var(--text-3)" style={{ flexShrink: 0 }} />
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Enter LeetCode username…"
                autoComplete="off"
                autoFocus
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: "var(--text-1)",
                  fontSize: 15,
                  fontWeight: 500,
                  fontFamily: "inherit",
                  padding: "10px 0",
                }}
              />
              <button
                type="submit"
                disabled={loading}
                style={{
                  display: "flex", alignItems: "center", gap: 7,
                  padding: "10px 22px",
                  background: "linear-gradient(135deg, var(--primary) 0%, var(--purple) 100%)",
                  border: "none",
                  borderRadius: 10,
                  color: "#fff",
                  fontFamily: "inherit",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.7 : 1,
                  transition: "opacity .2s, transform .15s",
                  whiteSpace: "nowrap",
                }}
                onMouseEnter={e => { if (!loading) e.currentTarget.style.transform = "scale(1.03)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}
              >
                {loading ? (
                  <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }}>
                    <Zap size={15} fill="currentColor" />
                  </motion.span>
                ) : (
                  <ArrowRight size={15} />
                )}
                {loading ? "Analyzing…" : "Analyze"}
              </button>
            </div>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  style={{
                    marginTop: 10, padding: "9px 14px",
                    background: "rgba(244,63,94,0.08)",
                    border: "1px solid rgba(244,63,94,0.25)",
                    borderRadius: 10,
                    color: "#f43f5e",
                    fontSize: 13,
                    fontWeight: 600,
                    textAlign: "left",
                  }}
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.form>

          {/* Try examples */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "center" }}
          >
            <span style={{ color: "var(--text-3)", fontSize: 12, fontWeight: 600 }}>Try:</span>
            {EXAMPLE_USERS.map(u => (
              <button
                key={u}
                onClick={() => tryUser(u)}
                style={{
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  padding: "3px 10px",
                  color: "var(--text-2)",
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: "inherit",
                  cursor: "pointer",
                  transition: "color .15s, border-color .15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.color = "var(--primary-light)"; e.currentTarget.style.borderColor = "var(--primary)"; }}
                onMouseLeave={e => { e.currentTarget.style.color = "var(--text-2)"; e.currentTarget.style.borderColor = "var(--border)"; }}
              >
                {u}
              </button>
            ))}
          </motion.div>
        </section>

        {/* ── Features ── */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          style={{
            padding: "3rem 1.5rem 5rem",
            maxWidth: 1100, margin: "0 auto", width: "100%",
          }}
        >
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "1rem",
          }}>
            {FEATURES.map((f, i) => (
              <FeatureCard key={i} {...f} index={i} />
            ))}
          </div>
        </motion.section>
      </motion.main>
    </AnimatePresence>
  );
}

function FeatureCard({ icon: Icon, label, desc, color, index }: {
  icon: any; label: string; desc: string; color: string; index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.55 + index * 0.08 }}
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: 16,
        padding: "1.5rem",
        cursor: "default",
      }}
    >
      <div style={{
        width: 40, height: 40,
        background: `${color}18`,
        border: `1px solid ${color}30`,
        borderRadius: 10,
        display: "flex", alignItems: "center", justifyContent: "center",
        marginBottom: "0.9rem",
      }}>
        <Icon size={19} color={color} />
      </div>
      <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text-1)", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.65 }}>{desc}</div>
      <div style={{ marginTop: "1rem", display: "flex", alignItems: "center", gap: 4, color: color, fontSize: 12, fontWeight: 700 }}>
        <span>Learn more</span>
        <ChevronRight size={13} />
      </div>
    </motion.div>
  );
}
