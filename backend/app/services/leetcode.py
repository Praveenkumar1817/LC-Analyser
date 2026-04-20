import httpx
import asyncio
import logging
from app.core.cache import cache

logger = logging.getLogger(__name__)

class LeetCodeService:
    BASE_URL = "https://leetcode.com/graphql"
    HEADERS = {
        'User-Agent': 'Mozilla/5.0 LeetCode-SaaS/1.0',
        'Content-Type': 'application/json',
        'Referer': 'https://leetcode.com',
        'Origin': 'https://leetcode.com',
    }

    def __init__(self, timeout: int = 15):
        self.timeout = timeout

    async def _query(self, client: httpx.AsyncClient, query: str, variables: dict) -> dict:
        try:
            response = await client.post(
                self.BASE_URL,
                json={'query': query, 'variables': variables},
                headers=self.HEADERS,
            )
            response.raise_for_status()
            data = response.json()
            if 'errors' in data:
                logger.error(f"[LeetCodeService] GraphQL errors: {data['errors']}")
                return {}
            return data
        except Exception as e:
            logger.error(f"[LeetCodeService] Request failed: {e}")
            return {}

    async def get_user_full_stats(self, username: str) -> dict:
        cache_key = f"lc_profile_v2_{username}"
        try:
             cached_data = await cache.get(cache_key)
             if cached_data:
                  return cached_data
        except Exception as e:
             logger.warning(f"Redis cache miss/error: {e}")

        # The 4 queries from original leetcode_api
        q_profile = """
        query getUserProfile($username: String!) {
          matchedUser(username: $username) {
            username
            profile { realName, ranking, userAvatar, countryName }
            submitStats {
              acSubmissionNum { difficulty, count, submissions }
              totalSubmissionNum { difficulty, count, submissions }
            }
            userCalendar { streak, totalActiveDays, submissionCalendar }
          }
        }
        """
        
        q_contest = """
        query getUserContestRanking($username: String!) {
          userContestRanking(username: $username) {
            attendedContestsCount, rating, globalRanking, topPercentage
          }
          userContestRankingHistory(username: $username) {
            attended, rating, ranking
            contest { title, startTime }
          }
        }
        """
        
        q_tags = """
        query skillStats($username: String!) {
          matchedUser(username: $username) {
            tagProblemCounts {
              advanced { tagName, problemsSolved }
              intermediate { tagName, problemsSolved }
              fundamental { tagName, problemsSolved }
            }
          }
        }
        """
        
        q_all = """
        query allQuestionsCount {
          allQuestionsCount { difficulty, count }
        }
        """

        async with httpx.AsyncClient(timeout=self.timeout) as client:
             # Run all 4 queries concurrently
             results = await asyncio.gather(
                 self._query(client, q_profile, {"username": username}),
                 self._query(client, q_contest, {"username": username}),
                 self._query(client, q_tags, {"username": username}),
                 self._query(client, q_all, {})
             )

        profile_resp, contest_resp, tags_resp, all_q_resp = results

        # Distinguish upstream failure (empty response) vs valid "user not found" (matchedUser: null)
        if not profile_resp:
            return {"__upstream_error__": True}
        pr_data = profile_resp.get("data")
        if pr_data is None:
            return {"__upstream_error__": True}
        matched_user = pr_data.get("matchedUser")
        if not matched_user:
            return {"__not_found__": True}
             
        contest_data = contest_resp.get('data', {})
        tags_user = tags_resp.get('data', {}).get('matchedUser', {})
        
        # Structure it exactly like the original get_user_full_stats so FeatureEngineer works seamlessly
        final_data = {
            "profile": matched_user,
            "contest": {
                "userContestRanking": contest_data.get('userContestRanking'),
                "userContestRankingHistory": contest_data.get('userContestRankingHistory', []),
            },
            "all_questions_count": all_q_resp.get('data', {}).get('allQuestionsCount', []),
            "tags": tags_user,
        }

        try:
             await cache.set(cache_key, final_data, expire_seconds=3600)
        except Exception:
             pass
             
        return final_data

leetcode_service = LeetCodeService()
