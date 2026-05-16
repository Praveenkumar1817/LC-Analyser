"""
gap_analyzer.py — Company-specific interview readiness analysis.

No ML. Curated domain knowledge encoded as deterministic rules.
Answers the question: "What do I need to do to get a job at {company}?"

COMPANY_PROFILES encode:
  required_tags    — core algorithm topics tested in phone/onsite rounds
  min_hard_ratio   — minimum fraction of problems that should be Hard
  min_total        — minimum total solved before applying
  rating_target    — target LeetCode contest rating (0 = not evaluated)
  description      — human-readable rationale

Sources:
  Blind 75, Neetcode 150, company-specific Glassdoor/Leetcode Discuss reports,
  and publicly available interview preparation guides (2023-2024).
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Literal


# ── Company knowledge base ───────────────────────────────────────────────────

COMPANY_PROFILES: dict[str, dict] = {
    "fintech": {
        "required_tags": [
            "Dynamic Programming", "Graphs", "Trees",
            "Math", "Bit Manipulation", "Two Pointers",
        ],
        "min_hard_ratio": 0.25,
        "min_total":      120,
        "rating_target":  1950,
        "weights":        {"topics": 0.25, "volume": 0.15, "hard": 0.25, "contest": 0.35},
        "description":    "Fintech companies value low-latency, mathematical problem-solving, and optimization. High contest ratings and hard problem fluency are critical.",
    },
    "product_tier_1": {
        "required_tags": [
            "Dynamic Programming", "Graphs", "Trees",
            "Binary Search", "String Manipulation", "Backtracking",
        ],
        "min_hard_ratio": 0.20,
        "min_total":      150,
        "rating_target":  1850,
        "weights":        {"topics": 0.40, "volume": 0.20, "hard": 0.20, "contest": 0.20},
        "description":    "Tier 1 Product Companies (FAANG, top tech) expect exceptional algorithmic thinking and deep pattern knowledge. Optimal complexity and strong core topics are required.",
    },
    "product_tier_2": {
        "required_tags": [
            "Arrays", "Trees", "Dynamic Programming",
            "Hash Table", "Sliding Window", "Graphs",
        ],
        "min_hard_ratio": 0.10,
        "min_total":      100,
        "rating_target":  1650,
        "weights":        {"topics": 0.45, "volume": 0.30, "hard": 0.15, "contest": 0.10},
        "description":    "Tier 2 Product Companies (Unicorns, mid-tier) prioritize solid problem-solving fundamentals and clean code over obscure algorithms. Broad coverage of medium problems is key.",
    },
    "service_based": {
        "required_tags": [
            "Arrays", "Hash Table", "String Manipulation", "Two Pointers", "Sorting",
        ],
        "min_hard_ratio": 0.05,
        "min_total":      80,
        "rating_target":  0,
        "weights":        {"topics": 0.60, "volume": 0.30, "hard": 0.10, "contest": 0.00},
        "description":    "Service-Based companies test practical coding skills and standard patterns. A broad coverage of foundational data structures is much more important than hard problems or contest ratings.",
    },
}


# ── Data models ──────────────────────────────────────────────────────────────

@dataclass
class TopicGap:
    """A specific topic where the user is below the target company threshold."""
    tag:      str
    solved:   int
    needed:   int                              # estimated additional problems needed
    priority: Literal["critical", "high", "medium"]
    reason:   str


@dataclass
class ReadinessReport:
    """Full readiness output from GapAnalyzer.analyze()."""
    readiness_score: float          # 0–100
    is_ready:        bool           # True if ≥75 and no critical gaps
    estimated_weeks: int            # at 25 problems/week pace
    strengths:       list[str]
    action_plan:     list[str]
    description:     str            # Company description from COMPANY_PROFILES
    gaps:            list[TopicGap] = field(default_factory=list)


# ── Topic fuzzy-matching ─────────────────────────────────────────────────────

def _norm(s: str) -> str:
    return (s or "").strip().lower()


# Aliases handle cases where LeetCode tag names diverge from our profile names.
_ALIASES: dict[str, tuple[str, ...]] = {
    "graphs":             ("graph", "graphs"),
    "graph":              ("graph", "graphs"),
    "string manipulation":("string", "strings", "string manipulation"),
    "arrays":             ("array", "arrays"),
    "array":              ("array", "arrays"),
    "hash table":         ("hash table", "hash map", "hashing"),
    "sliding window":     ("sliding window",),
    "dynamic programming":("dynamic programming", "dp"),
    "binary search":      ("binary search",),
    "trees":              ("tree", "trees", "binary tree", "binary search tree"),
    "tree":               ("tree", "trees"),
    "two pointers":       ("two pointers",),
    "heap":               ("heap (priority queue)", "priority queue", "heap"),
    "math":               ("math", "mathematics"),
    "bit manipulation":   ("bit manipulation", "bitmask"),
}


def _resolve_topic(
    required: str,
    topic_skills: dict[str, int],
    topic_distribution: dict[str, int],
) -> tuple[str, int, int]:
    """
    Fuzzy-match a required tag name to the user's topic_skills dict.
    Returns (matched_key, skill_0_100, solved_count).
    Falls back to (required, 0, 0) when no match is found.
    """
    req     = _norm(required)
    needles = {req} | set(_ALIASES.get(req, ()))

    def _matches(key_lower: str) -> bool:
        if key_lower == req:
            return True
        for n in needles:
            if len(n) >= 2 and (n in key_lower or key_lower in n):
                return True
        return False

    best_k, best_skill = None, -1
    for k, sk in topic_skills.items():
        if _matches(_norm(k)) and sk > best_skill:
            best_k, best_skill = k, sk

    if best_k is None:
        return required, 0, 0
    return best_k, best_skill, topic_distribution.get(best_k, 0)


# ── Analyzer ─────────────────────────────────────────────────────────────────

class GapAnalyzer:
    """
    Deterministic company-readiness gap analysis.

    Algorithm:
      1. For each required topic, check the user's skill score (0-100).
         ≥70 → strength.  <70 → gap (prioritised critical/high/medium).
      2. Check total solve volume vs company minimum.
      3. Check hard-problem ratio vs company minimum.
      4. Check contest rating vs company target (when applicable).
      5. Average all component scores → readiness_score (0-100).
      6. is_ready := readiness_score ≥ 75 AND no critical gaps.
      7. Estimate weeks to close all gaps at 25 problems/week.
    """

    def analyze(self, features: dict, target_company: str = "product_tier_1") -> ReadinessReport:
        """
        Produce a ReadinessReport for the given features against target_company.
        features must come from FeatureEngineer.extract_features().
        """
        target = (target_company or "product_tier_1").strip().lower()
        if target not in COMPANY_PROFILES:
            target = "product_tier_1"

        prof             = COMPANY_PROFILES[target]
        topic_skills     = dict(features.get("topic_skills",       {}) or {})
        topic_dist       = dict(features.get("topic_distribution", {}) or {})
        total            = int(features.get("total_solved",        0)  or 0)
        hard             = int(features.get("hard_solved",         0)  or 0)
        rating           = float(features.get("contest_rating",   0.0) or 0.0)
        hard_ratio       = (hard / total) if total > 0 else 0.0
        min_total        = int(prof["min_total"])
        min_hard         = float(prof["min_hard_ratio"])
        rating_target    = float(prof["rating_target"])

        topic_scores: list[float] = []
        strengths:        list[str]   = []
        gaps:             list[TopicGap] = []

        # ── 1. Topic analysis ─────────────────────────────────────────
        for req_tag in prof["required_tags"]:
            _mk, skill, solved = _resolve_topic(req_tag, topic_skills, topic_dist)
            comp = min(1.0, skill / 70.0)   # 70 = "good enough" threshold
            topic_scores.append(comp)

            if skill >= 70:
                strengths.append(f"{req_tag} (skill {skill})")
            else:
                needed   = max(1, math.ceil((70 - skill) / 100.0 * 40))
                priority = (
                    "critical" if skill < 20 else
                    "high"     if skill < 45 else
                    "medium"
                )
                messages = {
                    "critical": f"{req_tag} barely touched — core interview topic. Start immediately.",
                    "high":     f"{req_tag} needs more reps. Interviewers expect fluency, not familiarity.",
                    "medium":   f"{req_tag} is progressing — a focused week will close this gap.",
                }
                gaps.append(TopicGap(
                    tag=req_tag,
                    solved=solved,
                    needed=needed,
                    priority=priority,
                    reason=messages[priority],
                ))
                
        topic_score_avg = sum(topic_scores) / max(1, len(topic_scores))

        # ── 2. Volume check ───────────────────────────────────────────
        vol_score = min(1.0, total / max(min_total, 1))

        # ── 3. Hard-ratio check ───────────────────────────────────────
        hard_score = (
            min(1.0, hard_ratio / max(min_hard, 1e-6))
            if min_hard > 0 else 1.0
        )

        # ── 4. Contest check ──────────────────────────────────────────
        if rating_target > 0:
            # 0.25 proxy for non-contestants (we don't fully penalise absence)
            contest_score = min(1.0, rating / rating_target) if rating > 0 else 0.25
        else:
            contest_score = 1.0   # rating not evaluated for startups

        # ── 5. Composite readiness (Weighted) ─────────────────────────
        w = prof.get("weights", {"topics": 0.25, "volume": 0.25, "hard": 0.25, "contest": 0.25})
        raw_score = (
            topic_score_avg * w["topics"] +
            vol_score * w["volume"] +
            hard_score * w["hard"] +
            contest_score * w["contest"]
        )

        has_critical = any(g.priority == "critical" for g in gaps)
        penalty = 0.8 if has_critical else 1.0  # 20% penalty for missing critical topics
        
        readiness_score = round(raw_score * penalty * 100.0, 1)

        # ── 6. Ready gate ─────────────────────────────────────────────
        is_ready     = readiness_score >= 75.0 and not has_critical

        # ── 7. Time estimate ──────────────────────────────────────────
        # 25 problems/week = 5 problems/day × 5 days (realistic, sustainable pace)
        problems_needed = sum(g.needed for g in gaps)
        if total < min_total:
            problems_needed += min_total - total
        estimated_weeks = max(1, math.ceil(problems_needed / 25)) if problems_needed else 0

        # ── 8. Action plan ────────────────────────────────────────────
        action_plan = self._build_action_plan(
            gaps, total, hard_ratio, rating,
            prof, vol_score < 1.0, hard_score < 1.0,
        )

        return ReadinessReport(
            readiness_score=readiness_score,
            is_ready=is_ready,
            estimated_weeks=estimated_weeks,
            strengths=strengths,
            action_plan=action_plan,
            description=prof["description"],
            gaps=sorted(gaps, key=lambda g: {"critical": 0, "high": 1, "medium": 2}[g.priority]),
        )

    # ── Action plan builder ──────────────────────────────────────────────────

    @staticmethod
    def _build_action_plan(
        gaps: list[TopicGap],
        total: int,
        hard_ratio: float,
        rating: float,
        prof: dict,
        needs_volume: bool,
        needs_harder: bool,
    ) -> list[str]:
        """
        Generate a prioritised, numbered action plan.
        Items ordered: critical topics first, then volume, then difficulty, then high topics, then contests.
        """
        plan: list[str] = []

        critical = [g for g in gaps if g.priority == "critical"]
        high     = [g for g in gaps if g.priority == "high"]
        min_total    = int(prof["min_total"])
        rating_target = float(prof["rating_target"])
        target_pct   = int(prof["min_hard_ratio"] * 100)

        plan.append(
            f"📊 Baseline: {total} total solves, {hard_ratio:.0%} hard ratio — "
            f"target tier requires ≥{min_total} solves and ≥{prof['min_hard_ratio']:.0%} hard."
        )

        if critical:
            tags = " and ".join(g.tag for g in critical[:2])
            plan.append(
                f"🔴 Start today: Do 15+ problems in {tags}. These are your biggest blockers."
            )

        if needs_volume:
            needed = min_total - total
            plan.append(
                f"📈 Solve {needed} more problems to reach the {min_total}-problem minimum for this tier. "
                f"Focus on Mediums."
            )

        if needs_harder:
            plan.append(
                f"💪 Increase your Hard ratio to {target_pct}%. "
                f"Attempt at least 2 Hards per week."
            )

        if high:
            tags = ", ".join(g.tag for g in high[:3])
            plan.append(
                f"🟡 Build depth in: {tags}. Aim for 70+ skill score per topic."
            )

        if rating_target > 0 and rating < rating_target:
            plan.append(
                f"🏆 Enter weekly contests. Target rating: {rating_target:.0f}. "
                f"Consistency beats cramming."
            )

        plan.append("📅 Re-run this gap report every 2 weeks to track progress.")
        return plan


# Module-level singleton used by API routes.
gap_analyzer = GapAnalyzer()
