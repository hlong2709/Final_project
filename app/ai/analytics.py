from typing import List
from app.models import EngagementEvent

def calculate_active_learning_score(events: List[EngagementEvent]) -> float:
    """
    Simple scoring logic based on detected behaviors:
    - hand_raising: +10 points
    - group_discussion: +5 points
    - focus: +1 point per minute
    - distracted: -2 points
    """
    score = 0.0
    for event in events:
        if event.behavior_type == "hand_raising":
            score += 10 * event.confidence
        elif event.behavior_type == "group_discussion":
            score += 5 * event.confidence
        elif event.behavior_type == "focus":
            score += 1 * event.confidence
        elif event.behavior_type == "distracted":
            score -= 2 * event.confidence
            
    return max(0.0, score)
