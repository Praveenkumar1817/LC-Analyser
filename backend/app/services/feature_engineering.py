import json
import math
import time
import numpy as np


def _sigmoid_unit(x: float, midpoint: float, steepness: float) -> float:
    """0-100 sigmoid; clamps exponent to [-500, 500]."""
    exponent = -steepness * (x - midpoint)
    exponent = max(-500.0, min(500.0, exponent))
    return 100.0 / (1.0 + math.exp(exponent))


class FeatureEngineer:
    """
    Transforms raw LeetCode API response data into a flat feature dict.

    Expected raw_data shape: (see class docstring in original design — profile, contest, tags, all_questions_count)
    """

    TOPIC_SATURATION = {"fundamental": 80, "intermediate": 40, "advanced": 20}
    LEVEL_RANK = {"fundamental": 0, "intermediate": 1, "advanced": 2}

    DIFF_WEIGHTS = {"easy": 1, "medium": 3, "hard": 7}

    def _compute_topic_skill(self, easy: int, medium: int, hard: int) -> int:
        total = easy + medium + hard
        if total == 0:
            return 0

        # Difficulty weighted score
        weighted = easy * 1 + medium * 3 + hard * 7

        # Normalization using sigmoid (prevents farming)
        norm_score = _sigmoid_unit(weighted, midpoint=50.0, steepness=0.08) / 100.0

        # Difficulty dominance boost
        hard_ratio   = hard / total
        medium_ratio = medium / total
        easy_ratio   = easy / total

        difficulty_boost = (
            hard_ratio * 0.6 +
            medium_ratio * 0.3 +
            easy_ratio * 0.1
        )

        # Final score
        final_score = norm_score * (0.7 + 0.6 * difficulty_boost)
        return int(min(100.0, final_score * 100.0))

    def extract_features(self, raw_data: dict) -> dict | None:
        if not raw_data:
            return None

        profile = raw_data.get("profile", {})
        contest = raw_data.get("contest", {})
        all_q = raw_data.get("all_questions_count", [])
        tags = raw_data.get("tags", {})

        ac_stats = profile.get("submitStats", {}).get("acSubmissionNum", [])
        solved_map = {item["difficulty"]: item["count"] for item in ac_stats}

        total_solved = solved_map.get("All", 0)
        easy_solved = solved_map.get("Easy", 0)
        medium_solved = solved_map.get("Medium", 0)
        hard_solved = solved_map.get("Hard", 0)

        total_counts = {item["difficulty"]: item["count"] for item in all_q}
        total_problems_on_platform = total_counts.get("All", 3000)

        total_sub_stats = profile.get("submitStats", {}).get("totalSubmissionNum", [])
        total_sub_map = {item["difficulty"]: item["submissions"] for item in total_sub_stats}
        ac_sub_map = {item["difficulty"]: item["submissions"] for item in ac_stats}

        total_submissions = total_sub_map.get("All", 0)
        accepted_submissions = ac_sub_map.get("All", 0)
        acceptance_rate = (
            round(accepted_submissions / total_submissions * 100, 2) if total_submissions > 0 else 0.0
        )

        ranking = contest.get("userContestRanking") or {}
        contests_attended = ranking.get("attendedContestsCount", 0)
        contest_rating = ranking.get("rating", 0.0)
        global_rank = ranking.get("globalRanking", 99999)
        top_percentage = ranking.get("topPercentage", 100.0)

        history = contest.get("userContestRankingHistory") or []
        attended_history = [h for h in history if h.get("attended", False)]
        ranks = [h["ranking"] for h in attended_history if h.get("ranking", 0) > 0]

        best_contest_rank = min(ranks) if ranks else global_rank
        avg_contest_rank = int(np.mean(ranks)) if ranks else global_rank

        # Last 5 contest ratings (attended) for trend
        attended_ratings = [
            float(h["rating"]) for h in attended_history if h.get("rating") is not None
        ]
        recent_ratings = attended_ratings[-5:] if len(attended_ratings) > 5 else attended_ratings
        if len(recent_ratings) >= 2:
            x = np.arange(len(recent_ratings), dtype=float)
            rating_trend = float(np.polyfit(x, np.array(recent_ratings), 1)[0])
        else:
            rating_trend = 0.0

        calendar = profile.get("userCalendar", {}) or {}
        streak_days = calendar.get("streak", 0)
        active_days = calendar.get("totalActiveDays", 0)

        sub_calendar_str = calendar.get("submissionCalendar", "{}")
        submission_cv = 1.0
        try:
            sub_calendar = json.loads(sub_calendar_str)
            counts = [int(v) for v in sub_calendar.values()]
            if len(counts) >= 2:
                arr = np.array(counts, dtype=float)
                mean_c = float(np.mean(arr))
                std_c = float(np.std(arr))
                submission_cv = (std_c / mean_c) if mean_c > 0 else 1.0
        except Exception:
            submission_cv = 1.0

        joined_ts = profile.get("joinedTimestamp")
        if joined_ts:
            total_days_since_joined = max(1, int((time.time() - joined_ts) / 86400))
        else:
            try:
                sub_calendar = json.loads(sub_calendar_str)
                timestamps = [int(k) for k in sub_calendar.keys()]
                if len(timestamps) >= 2:
                    span_secs = max(timestamps) - min(timestamps)
                    total_days_since_joined = max(1, span_secs // 86400)
                else:
                    total_days_since_joined = max(active_days, 1)
            except Exception:
                total_days_since_joined = max(active_days, 1)

        # Global fallback ratios for topic difficulty
        ts = max(1, total_solved)
        global_easy_ratio   = easy_solved   / ts
        global_medium_ratio = medium_solved / ts
        global_hard_ratio   = hard_solved   / ts

        topic_stats = tags.get("tagProblemCounts", {}) if tags else {}
        tag_highest_level: dict[str, str] = {}
        topic_distribution: dict[str, int] = {}

        for level in ["fundamental", "intermediate", "advanced"]:
            for tag in topic_stats.get(level, []):
                name = tag.get("tagName", "").strip()
                count = int(tag.get("problemsSolved", 0))
                if not name:
                    continue
                topic_distribution[name] = topic_distribution.get(name, 0) + count
                if name not in tag_highest_level or self.LEVEL_RANK[level] > self.LEVEL_RANK.get(
                    tag_highest_level[name], 0
                ):
                    tag_highest_level[name] = level

        topic_difficulty_split = tags.get("topic_difficulty_split", {})
        topic_skills: dict[str, int] = {}
        topic_difficulty_matrix: dict[str, dict[str, int]] = {}
        for name, count in topic_distribution.items():
            if name in topic_difficulty_split:
                easy   = topic_difficulty_split[name].get("easy", 0)
                medium = topic_difficulty_split[name].get("medium", 0)
                hard   = topic_difficulty_split[name].get("hard", 0)
            else:
                easy   = int(count * global_easy_ratio)
                medium = int(count * global_medium_ratio)
                hard   = int(count * global_hard_ratio)

            topic_difficulty_matrix[name] = {"easy": easy, "medium": medium, "hard": hard}
            topic_skills[name] = self._compute_topic_skill(easy, medium, hard)

        topics_touched = sum(1 for c in topic_distribution.values() if c > 0)

        counts_pos = [v for v in topic_distribution.values() if v > 0]
        if len(counts_pos) > 1:
            total_c = sum(counts_pos)
            probs = np.array(counts_pos, dtype=float) / total_c
            entropy = float(-np.sum(probs * np.log(probs + 1e-15)))
            specialisation = float(1.0 - entropy / math.log(len(counts_pos)))
        else:
            specialisation = 1.0

        weighted_score = (
            easy_solved * self.DIFF_WEIGHTS["easy"]
            + medium_solved * self.DIFF_WEIGHTS["medium"]
            + hard_solved * self.DIFF_WEIGHTS["hard"]
        )

        hard_ratio = hard_solved / total_solved if total_solved > 0 else 0.0
        medium_ratio = medium_solved / total_solved if total_solved > 0 else 0.0
        easy_ratio = easy_solved / total_solved if total_solved > 0 else 0.0

        attempt_ratio = total_submissions / max(total_solved, 1)
        platform_coverage = (
            total_solved / total_problems_on_platform if total_problems_on_platform > 0 else 0.0
        )

        best_rank_score = 1 / (best_contest_rank + 1) * 10_000
        avg_rank_score = 1 / (avg_contest_rank + 1) * 10_000
        global_rank_score = 1 / (global_rank + 1) * 10_000

        contest_rate = (
            contests_attended / (total_days_since_joined / 7) if total_days_since_joined > 0 else 0.0
        )

        consistency_ratio = active_days / total_days_since_joined
        streak_score = float(np.log1p(streak_days))

        normalised_weighted = _sigmoid_unit(weighted_score, 400.0, 0.005) / 100.0
        avg_rank_score_01 = 1.0 - (math.log1p(avg_contest_rank) / math.log1p(100001))
        avg_rank_score_01 = max(0.0, min(1.0, avg_rank_score_01))
        skill_index = (
            normalised_weighted * 0.35
            + avg_rank_score_01 * 0.30
            + consistency_ratio * 0.15
            + hard_ratio * 0.20
        )

        avg_difficulty = (
            (easy_solved * 1 + medium_solved * 2 + hard_solved * 3) / total_solved
            if total_solved > 0
            else 0.0
        )

        return {
            "easy_solved": easy_solved,
            "medium_solved": medium_solved,
            "hard_solved": hard_solved,
            "total_solved": total_solved,
            "total_submissions": total_submissions,
            "contests_attended": contests_attended,
            "best_contest_rank": best_contest_rank,
            "global_rank": global_rank,
            "avg_contest_rank": avg_contest_rank,
            "total_problems_on_platform": total_problems_on_platform,
            "streak_days": streak_days,
            "active_days": active_days,
            "total_days_since_joined": total_days_since_joined,
            "weighted_score": round(weighted_score, 4),
            "hard_ratio": round(hard_ratio, 4),
            "medium_ratio": round(medium_ratio, 4),
            "easy_ratio": round(easy_ratio, 4),
            "attempt_ratio": round(attempt_ratio, 6),
            "platform_coverage": round(platform_coverage, 6),
            "best_rank_score": round(best_rank_score, 4),
            "avg_rank_score": round(avg_rank_score, 4),
            "global_rank_score": round(global_rank_score, 4),
            "contest_rate": round(contest_rate, 4),
            "consistency_ratio": round(consistency_ratio, 4),
            "streak_score": round(streak_score, 4),
            "skill_index": round(skill_index, 6),
            "acceptance_rate": acceptance_rate,
            "contest_rating": round(contest_rating, 2),
            "avg_difficulty": round(avg_difficulty, 4),
            "top_percentage": top_percentage,
            "topics_touched": topics_touched,
            "topic_distribution": topic_distribution,
            "topic_skills": topic_skills,
            "topic_difficulty_matrix": topic_difficulty_matrix,
            "submission_cv": round(submission_cv, 4),
            "rating_trend": round(rating_trend, 4),
            "specialisation": round(specialisation, 4),
        }
