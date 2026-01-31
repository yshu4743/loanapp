
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getFinancialAdvice = async (prompt: string, context?: any) => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction: `You are 'Finly', the AI financial advisor for MicroLoan Pro.
        Rules:
        - 30% interest rate on all loans.
        - 48-hour repayment tenure.
        - Non-payment results in CIBIL score drops.
        - Be professional, warn about high interest, and encourage responsible borrowing.
        - User context: ${JSON.stringify(context || {})}`,
      },
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return "I am currently processing risk data. Please ensure your repayment is on time to protect your CIBIL score!";
  }
};
