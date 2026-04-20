import joblib
import os
import numpy as np
import math

class MLPredictor:
    def __init__(self, model_dir: str = "app/ml_models"):
        self.model_dir = model_dir
        self.skill_model = self._load_model("skill_model.pkl")
        self.rating_model = self._load_model("contest_model.pkl")

    def _load_model(self, filename: str):
        path = os.path.join(self.model_dir, filename)
        if os.path.exists(path):
            return joblib.load(path)
        return None

    # ------------------------------------------------------------------ #
    #  HELPERS                                                             #
    # ------------------------------------------------------------------ #

    @staticmethod
    def _sigmoid_scale(x: float, midpoint: float, steepness: float = 0.03) -> float:
        """
        Maps any positive value to (0, 100) via a sigmoid curve.
        - midpoint: raw score where the output is ~50
        - steepness: how quickly it climbs (lower = more gradual)
        """
        return 100 / (1 + math.exp(-steepness * (x - midpoint)))

    @staticmethod
    def _diminishing(count: int, weight: float, cap: int) -> float:
        """
        Applies log-diminishing returns so grinding one difficulty
        doesn't dominate the score.
          - cap: problem count where gains become negligible
        """
        if count <= 0:
            return 0.0
        return weight * math.log1p(min(count, cap) / cap * (math.e - 1)) * cap

    # ------------------------------------------------------------------ #
    #  HEURISTIC                                                           #
    # ------------------------------------------------------------------ #

    def heuristic_skill_score(self, stats: dict) -> float:
        """
        Multi-signal heuristic skill score (0–100).

        Signals used
        ────────────
        1. Volume score      – weighted problem counts with diminishing returns
        2. Quality score     – acceptance rate & hard-problem ratio
        3. Contest score     – contest rating (optional)
        4. Consistency score – streak & submission spread (optional)

        Each signal is normalised to 0-100 then blended via fixed weights
        that sum to 1.0.
        """

        # ── raw counts ──────────────────────────────────────────────────
        easy   = max(0, stats.get('easy_solved',   0))
        medium = max(0, stats.get('medium_solved', 0))
        hard   = max(0, stats.get('hard_solved',   0))
        total  = easy + medium + hard

        # ── 1. VOLUME  (weight 0.40) ────────────────────────────────────
        # Diminishing returns per tier so grinding easy ≠ free points.
        # Caps: easy@300, medium@200, hard@100  (reasonable power-user ceiling)
        vol_raw = (
            self._diminishing(easy,   weight=1.0, cap=300) +
            self._diminishing(medium, weight=3.5, cap=200) +
            self._diminishing(hard,   weight=7.0, cap=100)
        )
        # Sigmoid centred at raw≈500 (a solid all-rounder profile)
        volume_score = self._sigmoid_scale(vol_raw, midpoint=500, steepness=0.006)

        # ── 2. QUALITY  (weight 0.30) ────────────────────────────────────
        # 2a. Acceptance rate (global avg ~45 %) — reward being above avg
        acceptance_rate = float(stats.get('acceptance_rate', 45.0))
        acceptance_score = min(100.0, max(0.0, (acceptance_rate / 75.0) * 100))

        # 2b. Hard ratio — % of solved problems that are Hard
        hard_ratio = (hard / total * 100) if total > 0 else 0.0
        # Sigmoid: 15 % hard ratio → ~50 pts  (top coders sit around 20-30 %)
        hard_ratio_score = self._sigmoid_scale(hard_ratio, midpoint=15, steepness=0.15)

        quality_score = (acceptance_score * 0.5) + (hard_ratio_score * 0.5)

        # ── 3. CONTEST  (weight 0.20) ────────────────────────────────────
        # LeetCode ratings: ~1500 start, ~2000 = top 5 %, ~2500 = top 0.5 %
        contest_rating = float(stats.get('contest_rating', 0.0))
        if contest_rating > 0:
            # Sigmoid: 1800 → ~50 pts
            contest_score = self._sigmoid_scale(
                contest_rating, midpoint=1800, steepness=0.006
            )
        else:
            # No contest data → use volume+quality as a soft proxy (penalise slightly)
            contest_score = (volume_score * 0.6 + quality_score * 0.4) * 0.75

        # ── 4. CONSISTENCY  (weight 0.10) ────────────────────────────────
        streak         = int(stats.get('max_streak_days', 0))
        active_days    = int(stats.get('active_days',     0))
        total_submissions = int(stats.get('total_submissions', total))

        streak_score = self._sigmoid_scale(streak, midpoint=30, steepness=0.08)

        # Attempt ratio: ideally you submit ~2-4 times per problem (not 20×)
        if total > 0:
            attempt_ratio = min(total_submissions / total, 10.0)  # cap at 10×
            # Sweet spot ~2–3 attempts per problem → penalise both extremes
            attempt_score = max(0.0, 100 - abs(attempt_ratio - 2.5) * 12)
        else:
            attempt_score = 0.0

        active_score = self._sigmoid_scale(active_days, midpoint=60, steepness=0.04)

        consistency_score = (
            streak_score   * 0.40 +
            attempt_score  * 0.30 +
            active_score   * 0.30
        )

        # ── BLEND ────────────────────────────────────────────────────────
        final = (
            volume_score      * 0.40 +
            quality_score     * 0.30 +
            contest_score     * 0.20 +
            consistency_score * 0.10
        )

        return round(min(100.0, max(0.0, final)), 1)

    # ------------------------------------------------------------------ #
    #  PUBLIC API                                                          #
    # ------------------------------------------------------------------ #

    def predict_skill(self, features: dict) -> float:
        """
        Attempts ML prediction first, falls back to heuristic.
        """
        if not self.skill_model or features.get('total_solved', 0) < 5:
            return self.heuristic_skill_score(features)

        try:
            # Feature ordering must match model_training.py exactly.
            # TODO: replace with FeatureEngineer.transform(features)
            x   = np.array([list(features.values())])
            pred = self.skill_model.predict(x)
            return round(float(pred[0]), 1)
        except Exception:
            return self.heuristic_skill_score(features)


ml_predictor = MLPredictor()