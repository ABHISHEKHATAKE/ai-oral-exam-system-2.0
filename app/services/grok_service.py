from typing import List, Dict, Optional, Any
import os, re
from groq import Groq

# Direct API key initialization (no .env loading needed)
GROQ_API_KEY = "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"

class GrokExamService:

    def __init__(self, api_key: Optional[str] = None):
        # Use provided API key or the hardcoded one
        self.api_key = api_key or GROQ_API_KEY

        if not self.api_key:
            # If still not found, enter mock mode but do not raise — allow fallback behavior
            print("⚠️ GROQ_API_KEY not found; running in mock mode")
            self.client = None
            self.mock_mode = True
        else:
            # Trim and log a masked version for debugging
            self.api_key = self.api_key.strip()
            masked = self.api_key[:4] + "..." + self.api_key[-4:]
            print(f"✅ Loaded GROQ_API_KEY: {masked}")
            try:
                self.client = Groq(api_key=self.api_key)
                self.mock_mode = False
            except Exception as e:
                print(f"⚠️ Error initializing Groq client: {e}; falling back to mock mode")
                self.client = None
                self.mock_mode = True

        self.model = "llama-3.1-8b-instant"
        
        # Initialize conversations storage for exam sessions
        self.conversations = {}

    # ------------------- PDF QUESTION GENERATION -------------------
    def generate_pdf_questions(self, pdf_content: str, instruction: str) -> List[str]:
        if not self.client or self.mock_mode:
            raise ValueError("Groq client not initialized. Please check your GROQ_API_KEY in the .env file.")

        relevant_text = pdf_content[:6000]

        prompt = f"""
You are a professor conducting an oral exam.

Instruction: {instruction}

Content:
{relevant_text}

Generate 5 deep viva questions.
Format:
Q1. ...
Q2. ...
Q3. ...
Q4. ...
Q5. ...
"""

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
                max_tokens=400
            )
            questions = [q for q in response.choices[0].message.content.split("\n") if q.strip().startswith("Q")]
            return questions if questions else ["Q1. Please explain the main concepts from the provided material."]
        except Exception as e:
            error_msg = str(e)
            if '401' in error_msg or 'invalid_api_key' in error_msg:
                raise ValueError("Invalid GROQ_API_KEY. Please update your API key in the .env file.") from e
            elif '429' in error_msg:
                raise ValueError("Groq API rate limit exceeded. Please try again later.") from e
            else:
                raise ValueError(f"Groq API error: {error_msg}") from e

    def generate_project_questions(self, project_details: Dict) -> List[str]:
        """Generate questions based on project details"""
        if not self.client or self.mock_mode:
            raise ValueError("Groq client not initialized. Please check your GROQ_API_KEY in the .env file.")

        title = project_details.get('title', 'Project')
        description = project_details.get('description', 'Project description')
        technologies = project_details.get('technologies', [])
        metrics = project_details.get('metrics', [])

        prompt = f"""
You are a professor conducting an oral exam about a student's project.

Project Title: {title}
Project Description: {description}
Technologies Used: {', '.join(technologies) if technologies else 'Not specified'}
Project Metrics: {', '.join(metrics) if metrics else 'Not specified'}

Generate 8 thoughtful questions that would test the student's understanding of their project. Focus on:
- Technical implementation details
- Problem-solving approach
- Technology choices and reasoning
- Project outcomes and learnings

Return only the questions, one per line, without numbering.
"""

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=1000,
                temperature=0.7
            )
            
            questions_text = response.choices[0].message.content.strip()
            questions = [q.strip() for q in questions_text.split('\n') if q.strip()]
            return questions[:8]  # Limit to 8 questions
            
        except Exception as e:
            error_msg = str(e)
            if '401' in error_msg or 'invalid_api_key' in error_msg:
                raise ValueError("Invalid GROQ_API_KEY. Please update your API key in the .env file.") from e
            elif '429' in error_msg:
                raise ValueError("Groq API rate limit exceeded. Please try again later.") from e
            else:
                raise ValueError(f"Groq API error: {error_msg}") from e

    # ------------------- TEXT EXAM QUESTIONS -------------------
    def generate_exam_questions(self, exam_id: str, project_details: Dict = None, pdf_content: str = None, num_questions: int = 8) -> List[Dict]:
        """Generate text-based questions for an exam based on PDF content or project details"""
        print(f"\n🎯 [GENERATE_QUESTIONS] Generating {num_questions} text-based questions for exam: {exam_id}")
        print(f"   - PDF content provided: {pdf_content is not None and len(pdf_content) if pdf_content else 'No'}")
        print(f"   - Project details provided: {project_details is not None}")

        if pdf_content:
            # Generate questions from PDF content using Groq
            print("   - Generating questions from PDF content (Groq)")
            instruction = (project_details or {}).get('title','PDF material') if project_details else 'PDF material'
            pdf_questions = self.generate_pdf_questions(pdf_content, instruction)
            questions = []
            for i, qt in enumerate(pdf_questions):
                questions.append({
                    "id": f"q{i+1}",
                    "type": "text",
                    "question": qt,
                    "options": None,
                    "correct_answer": None
                })
        elif project_details:
            # Generate questions from project details
            print("   - Generating questions from project details")
            project_questions = self.generate_project_questions(project_details)
            questions = []
            for i, qt in enumerate(project_questions):
                questions.append({
                    "id": f"q{i+1}",
                    "type": "text", 
                    "question": qt,
                    "options": None,
                    "correct_answer": None
                })
        else:
            # No content provided - cannot generate meaningful questions
            print("   - ERROR: No PDF content or project details provided")
            raise ValueError("Cannot generate questions: no content provided")

        print(f"✅ [GENERATE_QUESTIONS] Generated {len(questions)} questions")
        return questions

    # ------------------- ANSWER EVALUATION -------------------
    def evaluate_answer(self, question: str, student_answer: str) -> Dict[str, Any]:
        """Evaluate a student's answer using AI and return score and feedback"""
        if not self.client:
            raise ValueError("Groq client not initialized. Please check your GROQ_API_KEY in the .env file.")

        if not student_answer.strip():
            return {
                "score": 0.0,
                "max_score": 1.0,
                "feedback": "No answer provided.",
                "evaluation": "No answer given"
            }

        prompt = f"""
You are a professor evaluating an oral examination answer. Evaluate the student's response on a scale of 0-1 (where 1.0 is excellent and 0.0 is completely incorrect or irrelevant).

Question: {question}

Student's Answer: {student_answer}

Provide your evaluation in the following format:
SCORE: [0.0-1.0]
FEEDBACK: [2-3 sentence constructive feedback]
EVALUATION: [brief assessment]

Be fair but thorough. Consider:
- Accuracy of information
- Completeness of answer
- Understanding of concepts
- Clarity of explanation
"""

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,  # Lower temperature for consistent evaluation
                max_tokens=300
            )

            evaluation_text = response.choices[0].message.content

            # Parse the response
            score = 0.0
            feedback = "Evaluation completed."
            evaluation = "Answer evaluated"

            lines = evaluation_text.split('\n')
            for line in lines:
                line = line.strip()
                if line.startswith('SCORE:'):
                    try:
                        score_text = line.replace('SCORE:', '').strip()
                        score = min(1.0, max(0.0, float(score_text)))
                    except ValueError:
                        score = 0.5  # Default to 0.5 if parsing fails
                elif line.startswith('FEEDBACK:'):
                    feedback = line.replace('FEEDBACK:', '').strip()
                elif line.startswith('EVALUATION:'):
                    evaluation = line.replace('EVALUATION:', '').strip()

            return {
                "score": score,
                "max_score": 1.0,
                "feedback": feedback,
                "evaluation": evaluation
            }

        except Exception as e:
            error_msg = str(e)
            if '401' in error_msg or 'invalid_api_key' in error_msg:
                raise ValueError("Invalid GROQ_API_KEY. Please update your API key in the .env file.") from e
            elif '429' in error_msg:
                raise ValueError("Groq API rate limit exceeded. Please try again later.") from e
            else:
                raise ValueError(f"Groq API error during evaluation: {error_msg}") from e




# Global instance
grok_exam_service = GrokExamService()
