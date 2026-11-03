import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

export async function POST(req: Request) {
    try {
        const { message, history = [], pdfUrl, pdfBase64, currentAssessments = null, userApiKey, schoolSlug } = await req.json();

        if (!message) {
            return NextResponse.json({ error: "Missing message" }, { status: 400 });
        }

        // Get API key from env, request, or Firestore settings secrets
        let apiKey = process.env.GEMINI_API_KEY || userApiKey || req.headers.get("x-gemini-api-key");

        if (!apiKey && schoolSlug) {
            try {
                const secretsSnap = await getDoc(doc(db, "schools", schoolSlug, "settings", "secrets"));
                if (secretsSnap.exists()) {
                    apiKey = secretsSnap.data()?.aiApiKey;
                }
            } catch (err) {
                console.error("Error fetching saved aiApiKey:", err);
            }
        }

        // If no API key, return a mock response for developer testing
        if (!apiKey) {
            console.log("No GEMINI_API_KEY provided. Returning mock conversational response.");
            return NextResponse.json({
                message: "No Gemini API key is configured. This is a simulated response. To see authentic generation, please set GEMINI_API_KEY in your env or settings.",
                data: currentAssessments || {
                    quiz: {
                        questions: [
                            {
                                id: "mock-q1",
                                question: "This is a sample question generated in demo mode. What is the capital of France?",
                                options: ["London", "Paris", "Berlin", "Rome"],
                                correctAnswer: 1
                            },
                            {
                                id: "mock-q2",
                                question: "What is the primary purpose of this training program?",
                                options: ["Compliance", "Skills development", "Entertainment", "Graduation"],
                                correctAnswer: 1
                            }
                        ],
                        passMark: 80
                    },
                    project: {
                        instructions: "Sample Project: Create a summary report based on the course materials. List three key learnings and how you plan to apply them in your work."
                    },
                    timesheet: {
                        instructions: "Timesheet Guidelines: Log a minimum of 10 hours of study for this PDF course. Ensure you detail the topics studied in each session log."
                    }
                }
            });
        }

        const ai = new GoogleGenAI({ apiKey });

        // Build the contents array for Gemini
        const parts: any[] = [];

        // If a PDF is provided, add it as inlineData
        if (pdfBase64) {
            // Strip data URL prefix if present
            const cleanBase64 = pdfBase64.includes(",") ? pdfBase64.split(",")[1] : pdfBase64;
            parts.push({
                inlineData: {
                    data: cleanBase64,
                    mimeType: 'application/pdf'
                }
            });
        } else if (pdfUrl) {
            try {
                const pdfRes = await fetch(pdfUrl);
                if (pdfRes.ok) {
                    const pdfBuffer = await pdfRes.arrayBuffer();
                    const base64 = Buffer.from(pdfBuffer).toString('base64');
                    parts.push({
                        inlineData: {
                            data: base64,
                            mimeType: 'application/pdf'
                        }
                    });
                } else {
                    console.error("Failed to fetch PDF URL:", pdfUrl, pdfRes.statusText);
                }
            } catch (fetchErr) {
                console.error("Error fetching PDF from URL:", fetchErr);
                // Continue without PDF inlineData, relying on text instructions
            }
        }

        const prompt = `
You are an expert curriculum developer and instructional designer. Your task is to assist in generating and refining course assessments (multiple-choice quizzes, projects, timesheet requirements) based on the provided PDF document.

Current Draft Assessments (JSON format):
${currentAssessments ? JSON.stringify(currentAssessments, null, 2) : "None"}

Conversation History:
${history.map((m: any) => `${m.role === "user" ? "Instructor" : "AI Assistant"}: ${m.content}`).join("\n")}

New Instructor Request:
"${message}"

Based on the PDF content, conversation history, and current draft assessments, fulfill the instructor's request. You must generate or update the assessments (Quiz questions, Project instructions, and Timesheet guidelines).
If the request is purely informational (e.g. "Summarize chapter 2"), answer conversationally in the "message" field, and return the current assessments unchanged in the "data" field (or null if they don't exist yet).
If the request asks to generate, update, edit, add, or delete assessments, perform those actions and return the complete updated assessments in the "data" field.

You must respond with a valid JSON object ONLY. Do not wrap your response in markdown code blocks or anything else. The output must strictly follow this JSON schema:
{
  "message": "A conversational explanation of what was done, answering any questions or explaining the assessment modifications.",
  "data": {
    "quiz": {
      "questions": [
        {
          "id": "A unique UUID string for the question",
          "question": "The question text",
          "options": ["Option A", "Option B", "Option C", "Option D"],
          "correctAnswer": 0
        }
      ],
      "passMark": 80
    },
    "project": {
      "instructions": "Detailed instructions for the final project, what the student needs to build/write, and submission instructions."
    },
    "timesheet": {
      "instructions": "Guidelines/requirements for the timesheet log (e.g. 'Students must self-report a minimum of 12 hours of active study for this course...')"
    }
  }
}
`;

        parts.push({ text: prompt });

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
                {
                    role: 'user',
                    parts: parts
                }
            ],
            config: {
                responseMimeType: "application/json",
            }
        });

        const text = response.text || "{}";
        const result = JSON.parse(text);

        return NextResponse.json(result);
    } catch (error: any) {
        console.error("AI Assessments generation error:", error);
        return NextResponse.json({ error: error.message || "Failed to generate assessments" }, { status: 500 });
    }
}
