import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


class LeetCodeAPI:
    """
    Fetches all LeetCode data needed by FeatureEngineer.extract_features().

    get_user_full_stats(username) → dict with keys:
        profile, contest, all_questions_count, tags
    """

    BASE_URL = "https://leetcode.com/graphql"

    HEADERS = {
        'User-Agent': (
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
            'AppleWebKit/537.36 (KHTML, like Gecko) '
            'Chrome/124.0.0.0 Safari/537.36'
        ),
        'Content-Type':  'application/json',
        'Referer':        'https://leetcode.com',
        'Origin':         'https://leetcode.com',
    }

    def __init__(self, timeout: int = 10, retries: int = 3):
        self.timeout = timeout
        self.session = self._make_session(retries)

    # ------------------------------------------------------------------ #
    # Internal helpers
    # ------------------------------------------------------------------ #

    def _make_session(self, retries: int) -> requests.Session:
        session = requests.Session()
        retry = Retry(
            total=retries,
            backoff_factor=0.5,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["POST"],
        )
        adapter = HTTPAdapter(max_retries=retry)
        session.mount("https://", adapter)
        session.mount("http://",  adapter)
        return session

    def _query(self, query: str, variables: dict) -> dict:
        try:
            response = self.session.post(
                self.BASE_URL,
                json={'query': query, 'variables': variables},
                headers=self.HEADERS,
                timeout=self.timeout,
            )
            response.raise_for_status()
            data = response.json()

            if 'errors' in data:
                print(f"[LeetCodeAPI] GraphQL errors: {data['errors']}")
                return {}

            return data

        except requests.exceptions.Timeout:
            print(f"[LeetCodeAPI] Request timed out after {self.timeout}s")
            return {}
        except requests.exceptions.HTTPError as e:
            print(f"[LeetCodeAPI] HTTP error: {e.response.status_code} — {e.response.text[:200]}")
            return {}
        except requests.exceptions.RequestException as e:
            print(f"[LeetCodeAPI] Request failed: {e}")
            return {}

    # ------------------------------------------------------------------ #
    # Individual queries
    # ------------------------------------------------------------------ #

    def get_user_profile(self, username: str) -> dict:
        """
        Fetches profile + submitStats + userCalendar + joinedTimestamp.
        userCalendar provides streak, totalActiveDays, submissionCalendar.
        """
        query = """
        query getUserProfile($username: String!) {
          matchedUser(username: $username) {
            username
            profile {
              realName
              ranking
              userAvatar
              countryName
            }
            submitStats {
              acSubmissionNum {
                difficulty
                count
                submissions
              }
              totalSubmissionNum {
                difficulty
                count
                submissions
              }
            }
            userCalendar {
              streak
              totalActiveDays
              submissionCalendar
            }
          }
        }
        """
        return self._query(query, {"username": username})

    def get_all_questions_count(self) -> dict:
        query = """
        query allQuestionsCount {
          allQuestionsCount {
            difficulty
            count
          }
        }
        """
        return self._query(query, {})

    def get_user_tags(self, username: str) -> dict:
        query = """
        query skillStats($username: String!) {
          matchedUser(username: $username) {
            tagProblemCounts {
              advanced {
                tagName
                problemsSolved
              }
              intermediate {
                tagName
                problemsSolved
              }
              fundamental {
                tagName
                problemsSolved
              }
            }
          }
        }
        """
        return self._query(query, {"username": username})

    def get_user_contest_info(self, username: str) -> dict:
        """
        Fetches contest ranking + full history with ranking per contest.
        topPercentage and ranking per contest entry are included.
        """
        query = """
        query getUserContestRanking($username: String!) {
          userContestRanking(username: $username) {
            attendedContestsCount
            rating
            globalRanking
            topPercentage
          }
          userContestRankingHistory(username: $username) {
            attended
            rating
            ranking
            contest {
              title
              startTime
            }
          }
        }
        """
        return self._query(query, {"username": username})

    # ------------------------------------------------------------------ #
    # Public combined fetch
    # ------------------------------------------------------------------ #

    def get_user_full_stats(self, username: str) -> dict | None:
        """
        Fetches all data needed by FeatureEngineer.extract_features().

        Returns a dict with keys: profile, contest, all_questions_count, tags.
        Returns None if the user does not exist or the profile fetch fails.
        """
        profile_resp = self.get_user_profile(username)
        matched_user = profile_resp.get('data', {}).get('matchedUser')

        if not matched_user:
            print(f"[LeetCodeAPI] User '{username}' not found or profile unavailable.")
            return None

        contest_resp  = self.get_user_contest_info(username)
        all_q_resp    = self.get_all_questions_count()
        tags_resp     = self.get_user_tags(username)

        contest_data  = contest_resp.get('data', {})
        tags_user     = tags_resp.get('data', {}).get('matchedUser', {})

        return {
            # profile block: submitStats + userCalendar + joinedTimestamp all nested here
            "profile": matched_user,

            # contest block: userContestRanking + userContestRankingHistory
            "contest": {
                "userContestRanking":        contest_data.get('userContestRanking'),
                "userContestRankingHistory": contest_data.get('userContestRankingHistory', []),
            },

            # flat list of {difficulty, count}
            "all_questions_count": all_q_resp.get('data', {}).get('allQuestionsCount', []),

            # tagProblemCounts nested under matchedUser
            "tags": tags_user,
        }