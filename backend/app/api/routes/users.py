"""
users.py — API routes for LeetCode profile analysis.

Endpoints:
  GET  /profile/{username}         — Full profile with deterministic skill score
  GET  /gap/{username}?target=...  — Company-specific readiness gap report
  POST /recommendations/{username} — Gemini AI practice roadmap

All scoring is handled by ScoringEngine (scoring.py).
No ML dependencies. No mock data. Precise error codes.
"""

from fastapi import APIRouter, HTTPException, Query

from app.db import schemas
from app.services.leetcode import leetcode_service
from app.services.feature_engineering import FeatureEngineer
from app.services.scoring import scoring_engine
from app.services.recommender import recommender_service
from app.services.gap_analyzer import gap_analyzer
from app.core.cache import cache

router = APIRouter()
fe     = FeatureEngineer()

# Valid companies — mirrors COMPANY_PROFILES in gap_analyzer.py
VALID_COMPANIES = {"fintech", "product_tier_1", "product_tier_2", "service_based"}


# ── Shared profile-building helper ────────────────────────────────────────────

def _build_profile_response(username: str, raw_data: dict) -> schemas.UserProfileResponse:
    """
    Engineer features, score them, and assemble the full profile response.
    Raises 422 if feature extraction fails (private/corrupt profile).
    """
    features = fe.extract_features(raw_data)
    if not features:
        raise HTTPException(
            status_code=422,
            detail=f"Could not parse profile for '{username}'. The account may be private.",
        )

    scored   = scoring_engine.score(features)
    bd       = scored.score_breakdown

    stats = schemas.UserStatsBase(
        total_solved=      features.get("total_solved",      0),
        easy_solved=       features.get("easy_solved",       0),
        medium_solved=     features.get("medium_solved",     0),
        hard_solved=       features.get("hard_solved",       0),
        acceptance_rate=   features.get("acceptance_rate",   0.0),
        contest_rating=    features.get("contest_rating",    0.0),
        contests_attended= features.get("contests_attended", 0),
        avg_contest_rank=  features.get("avg_contest_rank",  0),
        global_rank=       features.get("global_rank",       0),
        active_days=       features.get("active_days",       0),
        streak_days=       features.get("streak_days",       0),
        consistency_ratio= features.get("consistency_ratio", 0.0),
        top_percentage=    features.get("top_percentage",    100.0),
        best_contest_rank= features.get("best_contest_rank", 999999),
    )

    topics = schemas.UserTopicsBase(
        topic_data=   features.get("topic_distribution", {}),
        topic_skills= features.get("topic_skills",       {}),
        topic_difficulty= features.get("topic_difficulty_matrix", {})
    )

    profile_data = raw_data.get("profile", {}).get("profile", {})
    
    raw_history = raw_data.get("contest", {}).get("userContestRankingHistory", [])
    history_arr = []
    for h in raw_history:
        if h.get("attended"):
            c = h.get("contest", {})
            history_arr.append(
                schemas.ContestHistoryItem(
                    title=c.get("title", ""),
                    startTime=c.get("startTime", 0),
                    rating=h.get("rating", 0.0),
                    ranking=h.get("ranking", 0)
                )
            )

    return schemas.UserProfileResponse(
        username=   username,
        real_name=  profile_data.get("realName", username),
        avatar_url= profile_data.get(
            "userAvatar",
            "https://assets.leetcode.com/users/default_avatar.jpg",
        ),
        stats=  stats,
        topics= topics,
        skill_score=         scored.skill_score,
        score_breakdown=     schemas.ScoreBreakdown(
            volume=      bd.volume,
            quality=     bd.quality,
            contest=     bd.contest,
            consistency= bd.consistency,
        ),
        percentile_estimate= scored.percentile_estimate,
        confidence=          scored.confidence,
        confidence_reason=   scored.confidence_reason,
        rating_trend=        features.get("rating_trend",      0.0),
        specialisation=      features.get("specialisation",    0.0),
        submission_cv=       features.get("submission_cv",     1.0),
        platform_coverage=   features.get("platform_coverage", 0.0),
        contest_history=     history_arr,
    )


# ── GET /profile/{username} ───────────────────────────────────────────────────

@router.get("/profile/{username}", response_model=schemas.UserProfileResponse)
async def get_user_profile(username: str):
    """
    Fetch a LeetCode profile, engineer features, compute deterministic skill
    score, and return the full analysis.

    Cache key: lc_profile_v2_{username}  (v2 busts old ML-scored cached data)
    """
    cache_key = f"lc_profile_v2_{username}"
    try:
        cached = await cache.get(cache_key)
        if cached:
            return schemas.UserProfileResponse(**cached)
    except Exception:
        pass

    # ── Fetch from LeetCode ───────────────────────────────────────────
    try:
        raw_data = await leetcode_service.get_user_full_stats(username)
    except Exception:
        raise HTTPException(
            status_code=503,
            detail="LeetCode API is temporarily unavailable. Try again in a few minutes.",
        )

    if raw_data.get("__upstream_error__"):
        raise HTTPException(
            status_code=503,
            detail="LeetCode API is temporarily unavailable. Try again in a few minutes.",
        )
    if raw_data.get("__not_found__") or not raw_data.get("profile"):
        raise HTTPException(
            status_code=404,
            detail=f"LeetCode user '{username}' not found.",
        )

    # ── Build, cache, and return ──────────────────────────────────────
    try:
        response = _build_profile_response(username, raw_data)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=422,
            detail=f"Could not parse profile for '{username}'. The account may be private.",
        )

    try:
        await cache.set(cache_key, response.model_dump(), expire_seconds=900)
    except Exception:
        pass

    return response


# ── GET /gap/{username} ────────────────────────────────────────────────────────

@router.get("/gap/{username}", response_model=schemas.GapReportResponse)
async def get_gap_analysis(
    username: str,
    target: str = Query(
        default="product_tier_1",
        description="Target company: fintech | product_tier_1 | product_tier_2 | service_based",
    ),
):
    """
    Company-specific readiness gap report.

    Returns an analysis of which topics, volume, and difficulty the user
    needs to improve before interviewing at the chosen company.

    Cache key: lc_gap_v1_{username}_{target}  (30-minute TTL)
    """
    t = (target or "product_tier_1").strip().lower()
    if t not in VALID_COMPANIES:
        t = "product_tier_1"

    cache_key = f"lc_gap_v1_{username}_{t}"
    try:
        cached = await cache.get(cache_key)
        if cached:
            return schemas.GapReportResponse(**cached)
    except Exception:
        pass

    # ── Fetch from LeetCode ───────────────────────────────────────────
    try:
        raw_data = await leetcode_service.get_user_full_stats(username)
    except Exception:
        raise HTTPException(
            status_code=503,
            detail="LeetCode API is temporarily unavailable. Try again in a few minutes.",
        )

    if raw_data.get("__upstream_error__"):
        raise HTTPException(
            status_code=503,
            detail="LeetCode API is temporarily unavailable. Try again in a few minutes.",
        )
    if raw_data.get("__not_found__") or not raw_data.get("profile"):
        raise HTTPException(
            status_code=404,
            detail=f"LeetCode user '{username}' not found.",
        )

    features = fe.extract_features(raw_data)
    if not features:
        raise HTTPException(
            status_code=422,
            detail=f"Could not parse profile for '{username}'. The account may be private.",
        )

    # ── Analyze and respond ───────────────────────────────────────────
    report = gap_analyzer.analyze(features, t)
    gaps   = [
        schemas.TopicGapResponse(
            tag=g.tag, solved=g.solved, needed=g.needed,
            priority=g.priority, reason=g.reason,
        )
        for g in report.gaps
    ]

    out = schemas.GapReportResponse(
        username=        username,
        target_company=  t,
        readiness_score= report.readiness_score,
        is_ready=        report.is_ready,
        estimated_weeks= report.estimated_weeks,
        strengths=       report.strengths,
        action_plan=     report.action_plan,
        gaps=            gaps,
        description=     report.description,
    )

    try:
        await cache.set(cache_key, out.model_dump(), expire_seconds=1800)
    except Exception:
        pass

    return out


# ── POST /recommendations/{username} ──────────────────────────────────────────

@router.post("/recommendations/{username}")
async def get_user_recommendations(username: str):
    """
    Generate a Gemini AI practice roadmap for the given user.

    Input to recommender: topic_distribution (raw solved counts) — NOT topic_skills.
    Reason: get_rule_based_weaknesses sorts by count to find weak topics.
    Raw counts and skill scores sort differently; counts are the correct input
    for weakness detection.
    """
    cache_key = f"lc_profile_v2_{username}"
    raw_data  = None
    try:
        raw_data = await cache.get(cache_key)
    except Exception:
        pass

    if not raw_data:
        try:
            raw_data = await leetcode_service.get_user_full_stats(username)
        except Exception:
            raise HTTPException(
                status_code=503,
                detail="LeetCode API is temporarily unavailable. Try again in a few minutes.",
            )
        if raw_data.get("__upstream_error__"):
            raise HTTPException(
                status_code=503,
                detail="LeetCode API is temporarily unavailable. Try again in a few minutes.",
            )
        if raw_data.get("__not_found__") or not raw_data.get("profile"):
            raise HTTPException(
                status_code=404,
                detail=f"LeetCode user '{username}' not found.",
            )

    features = fe.extract_features(raw_data) or {}
    user_stats = {
        "total_solved":  features.get("total_solved",  0),
        "easy_solved":   features.get("easy_solved",   0),
        "medium_solved": features.get("medium_solved", 0),
        "hard_solved":   features.get("hard_solved",   0),
    }

    # Pass topic_distribution (raw counts), NOT topic_skills (0-100 scores).
    topic_distribution = features.get("topic_distribution", {})

    recommendation = await recommender_service.generate_recommendations(
        user_stats, topic_distribution
    )
    return {"username": username, "recommendation_markdown": recommendation}
