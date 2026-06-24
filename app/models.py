from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
import datetime

Base = declarative_base()

class Student(Base):
    __tablename__ = "students"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(String, unique=True, index=True) # e.g., s123456
    name = Column(String)
    email = Column(String, unique=True)
    
    events = relationship("EngagementEvent", back_populates="student")

class ClassSession(Base):
    __tablename__ = "sessions"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String) # e.g., "Math 101 - Week 1"
    teacher_name = Column(String)
    start_time = Column(DateTime, default=datetime.datetime.utcnow)
    end_time = Column(DateTime, nullable=True)
    
    events = relationship("EngagementEvent", back_populates="session")
    reports = relationship("SessionReport", back_populates="session")

class EngagementEvent(Base):
    __tablename__ = "engagement_events"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id"))
    student_id = Column(Integer, ForeignKey("students.id"), nullable=True) # Could be null if student detection is anonymous
    behavior_type = Column(String) # "raising_hand", "group_discussion", "focus", "distracted"
    confidence = Column(Float)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    metadata_json = Column(Text) # Additional data like bounding box or posture details
    
    session = relationship("ClassSession", back_populates="events")
    student = relationship("Student", back_populates="events")

class SessionReport(Base):
    __tablename__ = "session_reports"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id"))
    total_active_score = Column(Float)
    summary_data = Column(Text) # JSON summary of the session
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    session = relationship("ClassSession", back_populates="reports")
