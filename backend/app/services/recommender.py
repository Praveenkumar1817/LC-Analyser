import google.generativeai as genai
from app.core.config import settings

class RecommenderService:
    def __init__(self):
         if settings.GEMINI_API_KEY:
             genai.configure(api_key=settings.GEMINI_API_KEY)
             self.model = genai.GenerativeModel('gemini-2.5-flash')
         else:
             self.model = None

    def get_rule_based_weaknesses(self, topic_data: dict) -> list[str]:
         # Identify topics with lowest solve counts below an arbitrary threshold
         if not topic_data: return []
         
         # Sort topics by count, ascending
         sorted_topics = sorted(topic_data.items(), key=lambda item: item[1])
         
         # Return bottom 3 topics that have at least 1 solve
         weak_topics = [t[0] for t in sorted_topics if t[1] > 0][:3]
         return weak_topics

    async def generate_recommendations(self, user_stats: dict, topic_data: dict) -> str:
         weak_topics = self.get_rule_based_weaknesses(topic_data)
         fallback_text = f"Based on stats, focus on practicing: {', '.join(weak_topics) if weak_topics else 'Dynamic Programming and Graphs'}."
         
         if not self.model:
              return fallback_text
              
         prompt = f"""
         User LeetCode Stats:
         Total Solved: {user_stats.get('total_solved', 0)}
         Easy/Medium/Hard: {user_stats.get('easy_solved',0)} / {user_stats.get('medium_solved',0)} / {user_stats.get('hard_solved',0)}
         
         Identified Weak Topics: {weak_topics}
         
         Act as an expert competitive programming coach. Provide a concise, highly actionable 1-week improvement plan.
         Include 3 specific LeetCode problem titles they should solve next to shore up these weaknesses.
         Format the response using Markdown. Keep it under 250 words.
         """
         
         try:
              # Ideally use an async wrapper for the SDK if available, or run in a threadpool
              response = await self.model.generate_content_async(prompt)
              return response.text
         except Exception as e:
              return fallback_text + f"\n\n(AI generation failed: {e})"

recommender_service = RecommenderService()
