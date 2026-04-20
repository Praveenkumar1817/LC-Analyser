from sqlalchemy import Column, Integer, String, Float, DateTime, JSON, ForeignKey, func
from sqlalchemy.orm import relationship
from app.db.session import Base

class UserProfile(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String, unique=True, index=True, nullable=False)
    real_name = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)
    last_updated = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    stats = relationship("UserStats", back_populates="user", cascade="all, delete-orphan", uselist=False)
    topics = relationship("UserTopics", back_populates="user", cascade="all, delete-orphan", uselist=False)

class UserStats(Base):
    __tablename__ = "user_stats"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    
    total_solved = Column(Integer, default=0)
    easy_solved = Column(Integer, default=0)
    medium_solved = Column(Integer, default=0)
    hard_solved = Column(Integer, default=0)
    
    acceptance_rate = Column(Float, default=0.0)
    contest_rating = Column(Float, default=0.0)
    streak = Column(Integer, default=0)
    
    skill_score = Column(Float, nullable=True) # Computed by ML/Heuristic
    
    user = relationship("UserProfile", back_populates="stats")

class UserTopics(Base):
    __tablename__ = "user_topics"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    
    topic_data = Column(JSON, nullable=False) # Store problem counts e.g. {"DP": 45, "Graphs": 20}
    
    user = relationship("UserProfile", back_populates="topics")
