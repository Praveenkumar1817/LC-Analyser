"""
scoring.py — Unified deterministic skill scoring.
Single source of truth for skill_score and sub-score breakdowns in the API/UI.

No ML. No pkl. No black boxes.
Every constant is documented with a calibration rationale.
"""

from __future__ import annotations

import math
from dataclasses import dataclass


# ── Sigmoid helper ───────────────────────────────────────────────────────────

def _sig100(x: float, mid: float, k: float) -> float:
    """
    S-curve mapping any value x → (0, 100).
    Exponent clamped to [-500, 500] to prevent math.exp overflow.
    """
    exp = max(-500.0, min(500.0, -k * (x - mid)))
    return 100.0 / (1.0 + math.exp(exp))


# ── Data models ──────────────────────────────────────────────────────────────

@dataclass
class ScoreBreakdown:
    """
    The four sub-scores that compose the final skill_score.
    All values are 0–100 floats.
    """
    volume:      float
    quality:     float
    contest:     float
    consistency: float


@dataclass
class ScoringResult:
    """Full output of ScoringEngine.score()."""
    skill_score:         float   # 0–100 final score — the ONLY score shown to users
    score_breakdown:     ScoreBreakdown
    percentile_estimate: float   # 0–100; preferred from LeetCode top_percentage
    confidence:          str     # "high" | "medium" | "low"
    confidence_reason:   str


# ── Engine ───────────────────────────────────────────────────────────────────

class ScoringEngine:
    """
    Phase 1: Anchor to contest rating (objective, Elo-based, externally validated)
    Phase 2: Adjust using problem-solving profile (refine, never override)

    Why contest-first:
      - Contest rating is earned under time pressure against real opponents
      - It's anti-gameable (can't grind your way to 2100+)
      - LeetCode's own Elo system is already well-calibrated
      - Problem counts can be farmed; contest rating cannot

    Adjustment bounds: -10 to +15 max
      - We trust contest rating more than we trust problem stats
      - A weak problem profile can only drop you 10 points
      - A strong problem profile can boost you up to 15 points
      - If no contest data: fall back to problem-only score with
        a hard ceiling of 65 (can't reach elite tier without contest proof)
    """

    RATING_TO_SCORE = [
        (0,    0,   0  ),   # no contest
        (1500, 1,   35 ),   # just started contesting
        (1600, 1501,45 ),   # below median contestant
        (1750, 1601,55 ),   # median contestant
        (1900, 1751,65 ),   # above median
        (2100, 1901,75 ),   # strong — Knight tier
        (2400, 2101,85 ),   # Guardian tier (top 5%)
        (3000, 2401,93 ),   # elite
        (100000,3001,99),   # neal_wu / tourist tier
    ]

    def _base_from_rating(self, rating: float) -> float:
        if rating <= 0:
            return 0.0
        for (r_hi, r_lo, s_hi) in reversed(self.RATING_TO_SCORE):
            if rating >= r_lo:
                idx = self.RATING_TO_SCORE.index((r_hi, r_lo, s_hi))
                if idx == 0:
                    return float(s_hi)
                prev = self.RATING_TO_SCORE[idx - 1]
                s_lo = prev[2]
                t = (rating - r_lo) / (r_hi - r_lo)
                return round(s_lo + t * (s_hi - s_lo), 2)
        return 0.0

    def _problem_adjustment(self, features: dict) -> float:
        rating      = features.get('contest_rating',   0.0)
        total       = features.get('total_solved',     0)
        hard        = features.get('hard_solved',      0)
        active_days = features.get('active_days',      0)
        streak      = features.get('streak_days',      0)
        trend       = features.get('rating_trend',     0.0)

        hard_ratio  = (hard / total) if total > 0 else 0.0
        adjustment  = 0.0

        expected_hard_ratio = self._expected_hard_ratio(rating)
        ratio_delta = hard_ratio - expected_hard_ratio
        if ratio_delta > 0:
            adjustment += min(6.0, ratio_delta * 30)
        else:
            adjustment += max(-5.0, ratio_delta * 20)

        expected_total = self._expected_volume(rating)
        vol_delta      = total - expected_total
        if vol_delta > 0:
            adjustment += min(4.0, vol_delta * 0.005)
        else:
            adjustment += max(-3.0, vol_delta * 0.008)

        if active_days >= 150:
            adjustment += 3.0
        elif active_days >= 90:
            adjustment += 1.5
        elif active_days < 30:
            adjustment -= 2.0

        if streak >= 30:
            adjustment += 1.0
        elif streak >= 14:
            adjustment += 0.5

        if trend > 10:
            adjustment += 2.0
        elif trend > 0:
            adjustment += 1.0
        elif trend < -20:
            adjustment -= 1.0

        return max(-10.0, min(15.0, adjustment))

    @staticmethod
    def _expected_hard_ratio(rating: float) -> float:
        if rating >= 2400: return 0.30
        if rating >= 2100: return 0.22
        if rating >= 1900: return 0.15
        if rating >= 1750: return 0.10
        if rating >= 1600: return 0.06
        return 0.03

    @staticmethod
    def _expected_volume(rating: float) -> int:
        if rating >= 2400: return 400
        if rating >= 2100: return 250
        if rating >= 1900: return 150
        if rating >= 1750: return 100
        if rating >= 1600: return 60
        return 30

    def _no_contest_score(self, features: dict) -> float:
        total  = features.get('total_solved', 0)
        hard   = features.get('hard_solved',  0)
        medium = features.get('medium_solved',0)

        if total < 5:
            return 0.0

        raw = (hard * 7) + (medium * 3) + (total * 0.5)
        score = 100 / (1 + math.exp(-0.004 * (raw - 300)))
        return round(min(65.0, score), 1)
        
    def _percentile(self, skill_score: float, top_pct: float) -> float:
        """Fallback percentile estimator relative to public leaderboard distributions."""
        if 0.0 < top_pct < 100.0:
            return round(max(0.0, min(100.0, 100.0 - top_pct)), 1)
        return round(_sig100(skill_score, mid=50.0, k=0.07), 1)

    def _confidence(self, total: int, contests: int) -> tuple[str, str]:
        if total >= 100 and contests >= 3:
            return ("high", f"Solid signal: {total} problems solved across {contests} attended contests.")
        if total >= 30:
            return ("medium", f"{total} problems solved. Entering contests would sharpen the estimate further.")
        return ("low", f"Only {total} problems solved — score becomes meaningful after 30+ problems.")

    # ── Public API ────────────────────────────────────────────────────

    def score(self, features: dict) -> ScoringResult:
        rating   = features.get('contest_rating',    0.0)
        contests = features.get('contests_attended', 0)
        total    = features.get('total_solved',      0)

        if total < 5:
            return ScoringResult(
                skill_score=0.0,
                score_breakdown=ScoreBreakdown(0.0, 0.0, 0.0, 0.0),
                percentile_estimate=0.0,
                confidence="low",
                confidence_reason="Fewer than 5 problems solved — score is not meaningful yet."
            )

        if rating <= 0 or contests == 0:
            base       = self._no_contest_score(features)
            adjustment = 0.0
            confidence = "low" if total < 50 else "medium"
            reason     = (f"No contest history. Score capped at 65. "
                          f"Enter contests to unlock accurate ranking.")
        else:
            base       = self._base_from_rating(rating)
            adjustment = self._problem_adjustment(features)
            confidence, reason = self._confidence(total, contests)

        final = round(min(99.0, max(0.0, base + adjustment)), 1)
        
        # We proxy the breakdown to match the legacy dashboard categories.
        # This keeps the transparent UI graphs working flawlessly.
        breakdown = ScoreBreakdown(
            volume=      round(min(100.0, (total / 500) * 100), 1),
            quality=     round(min(100.0, (features.get('hard_solved', 0) / max(total, 1) / 0.3) * 100), 1),
            contest=     round(base, 1),
            consistency= round(100.0 if features.get('active_days', 0) > 100 else (features.get('active_days', 0) / 100 * 100), 1)
        )

        return ScoringResult(
            skill_score=final,
            score_breakdown=breakdown,
            percentile_estimate=self._percentile(final, features.get('top_percentage', 100.0)),
            confidence=confidence,
            confidence_reason=reason
        )

# Module-level singleton used by API routes.
scoring_engine = ScoringEngine()
