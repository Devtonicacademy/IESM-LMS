import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export async function POST(req: Request) {
    try {
        const { topic, count = 5, contents = [] } = await req.json();

        if (!topic) {
            return NextResponse.json({ error: "Missing topic" }, { status: 400 });
        }

        const apiKey = process.env.GEMINI_API_KEY;

        // If no API key, return a mock response
        if (!apiKey) {
            console.log("No GEMINI_API_KEY provided. Returning mock quiz.");
            return NextResponse.json({
                questions: [
                    {
                        question: `What is a fundamental concept in ${topic}?`,
                        options: ["Concept A", "Concept B", "Concept C", "Concept D"],
                        correctAnswer: 0
                    },
                    {
                        question: `Why is ${topic} important?`,
                        options: ["Reason 1", "Reason 2", "Reason 3", "Reason 4"],
                        correctAnswer: 1
                    }
                ]
            });
        }

        const ai = new GoogleGenAI({ apiKey });

        let contextSource = "";
        if (contents.length > 0) {
            contextSource = `Here is the module content to base the questions on:\n${contents.join("\n").substring(0, 5000)}\n\n`;
        }

        const prompt = `${contextSource}Generate a ${count}-question multiple-choice quiz on the topic: "${topic}".
Output valid JSON only. Format:
{
  "questions": [
    {
      "question": "question text",
      "options": ["option 1", "option 2", "option 3", "option 4"],
      "correctAnswer": <index of correct option (0-3)>
    }
  ]
}`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
            }
        });

        const text = response.text || "{}";
        const result = JSON.parse(text);

        return NextResponse.json(result);
    } catch (error: any) {
        console.error("AI Quiz generation error:", error);
        return NextResponse.json({ error: error.message || "Failed to generate quiz" }, { status: 500 });
    }
}
