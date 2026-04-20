from pydantic import BaseModel
from typing import Optional, Dict, List


class ScoreBreakdown(BaseModel):
    """
    The four sub-scores backing the overall skill_score.
    All values are 0–100 floats. Shown in the UI for transparency only — never
    arithmetically combined on the frontend.
    """
    volume:      float
    quality:     float
    contest:     float
    consistency: float


class UserStatsBase(BaseModel):
    total_solved:       int   = 0
    easy_solved:        int   = 0
    medium_solved:      int   = 0
    hard_solved:        int   = 0
    acceptance_rate:    float = 0.0
    contest_rating:     float = 0.0
    contests_attended:  int   = 0
    avg_contest_rank:   int   = 0
    global_rank:        int   = 0
    active_days:        int   = 0
    streak_days:        int   = 0
    consistency_ratio:  float = 0.0
    top_percentage:     float = 100.0
    best_contest_rank:  int   = 0


class TopicDifficulty(BaseModel):
    easy: int
    medium: int
    hard: int


class UserTopicsBase(BaseModel):
    topic_data:   Dict[str, int]
    topic_skills: Dict[str, int]
    topic_difficulty: Optional[Dict[str, TopicDifficulty]] = None


class ContestHistoryItem(BaseModel):
    title: str
    startTime: int
    rating: float
    ranking: int


class UserProfileResponse(BaseModel):
    username:    str
    real_name:   Optional[str] = None
    avatar_url:  Optional[str] = None
    stats:       Optional[UserStatsBase]  = None
    topics:      Optional[UserTopicsBase] = None

    # ── Scoring ────────────────────────────────────────────────────────
    skill_score:          float          = 0.0   # 0-100; the only score shown to users
    score_breakdown:      ScoreBreakdown         # sub-score transparency
    percentile_estimate:  float          = 0.0   # 0-100
    confidence:           str            = "low"
    confidence_reason:    str            = ""

    # ── Advanced feature signals ───────────────────────────────────────
    rating_trend:      float = 0.0   # slope of rating over last 5 contests
    specialisation:    float = 0.0   # normalised entropy: 0=spread, 1=single topic
    submission_cv:     float = 1.0   # coeff. of variation of daily submissions
    platform_coverage: float = 0.0   # fraction of all LeetCode problems solved

    # ── Full History ───────────────────────────────────────────────────
    contest_history:   List[ContestHistoryItem] = []

    class Config:
        from_attributes = True


class TopicGapResponse(BaseModel):
    tag:      str
    solved:   int
    needed:   int
    priority: str    # "critical" | "high" | "medium"
    reason:   str


class GapReportResponse(BaseModel):
    username:        str
    target_company:  str
    readiness_score: float
    is_ready:        bool
    estimated_weeks: int
    strengths:       List[str]
    action_plan:     List[str]
    gaps:            List[TopicGapResponse]
    description:     str = ""    # Company interview description
