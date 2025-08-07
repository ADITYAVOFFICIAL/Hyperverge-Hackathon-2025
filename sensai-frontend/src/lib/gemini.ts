import {
    GoogleGenerativeAI,
    HarmCategory,
    HarmBlockThreshold,
} from "@google/generative-ai";

// --- Configuration ---

// Use Next.js specific environment variable, prefixed with NEXT_PUBLIC_ to be available on the client-side.
const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
const MODEL_NAME = "gemini-2.0-flash"; // Using a valid and efficient model for moderation tasks.

// --- Type Definitions ---

/**
 * Defines the structure for the moderation result, mirroring the Python service.
 */
export interface ModerationResult {
    is_flagged: boolean;
    severity: "low" | "medium" | "high";
    reason: string;
    action: "approve" | "flag" | "remove";
    confidence: number;
}

type Severity = "low" | "medium" | "high";
type Action = "approve" | "flag" | "remove";

// --- Client Initialization ---

let genAI: GoogleGenerativeAI | null = null;

/**
 * Initializes the GoogleGenerativeAI client.
 * This function ensures the client is a singleton and handles initialization errors.
 */
function initializeGeminiClient(): void {
    if (genAI) return; // Already initialized

    if (!API_KEY) {
        console.warn("⚠️ NEXT_PUBLIC_GEMINI_API_KEY is missing. Moderation service is disabled.");
        return;
    }
    try {
        genAI = new GoogleGenerativeAI(API_KEY);
    } catch (error) {
        console.error("🚨 Failed to initialize GoogleGenerativeAI for moderation:", error);
        genAI = null; // Ensure client is null on failure
    }
}

// Initialize the client when the module is loaded
initializeGeminiClient();


// --- Safety and Mapping Configuration ---

// We set the threshold to BLOCK_NONE to ensure we always get the safety ratings
// for all categories, allowing us to make our own moderation decision.
const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

/**
 * Maps a Gemini HarmCategory to a severity level.
 * @param category The HarmCategory from the API response.
 * @returns The corresponding severity level.
 */
const getSeverity = (category: HarmCategory): Severity => {
    switch (category) {
        case HarmCategory.HARM_CATEGORY_HATE_SPEECH:
        case HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT:
        case HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT:
            return "high";
        case HarmCategory.HARM_CATEGORY_HARASSMENT:
            return "medium";
        default:
            return "low";
    }
};

/**
 * Determines the appropriate action based on the highest detected severity.
 * @param severity The highest severity level found.
 * @returns The corresponding moderation action.
 */
const getAction = (severity: Severity): Action => {
    switch (severity) {
        case "high":
            return "remove";
        case "medium":
            return "flag";
        default:
            return "approve";
    }
};


// --- Core Moderation Logic ---

/**
 * Moderates a piece of text content using the Gemini API's safety ratings.
 *
 * @param content The text content to moderate.
 * @returns A promise that resolves to a ModerationResult object.
 */
export const moderateContent = async (content: string): Promise<ModerationResult> => {
    if (!genAI) {
        console.warn("Moderation skipped - Gemini client not configured.");
        return {
            is_flagged: false,
            severity: "low",
            reason: "Moderation skipped - client not configured",
            action: "approve",
            confidence: 1.0,
        };
    }

    try {
        const model = genAI.getGenerativeModel({ model: MODEL_NAME, safetySettings });
        const result = await model.generateContent(content);
        const response = result.response;

        const ratings = response.candidates?.[0]?.safetyRatings || [];
        
        const flaggedCategories = ratings.filter(
            (rating) => rating.probability !== 'NEGLIGIBLE'
        );

        if (flaggedCategories.length > 0) {
            let highestSeverity: Severity = "low";
            for (const rating of flaggedCategories) {
                const currentSeverity = getSeverity(rating.category);
                if (currentSeverity === "high") {
                    highestSeverity = "high";
                    break; // High severity is the maximum, no need to check further
                }
                if (currentSeverity === "medium") {
                    highestSeverity = "medium";
                }
            }

            const reason = `Flagged for: ${flaggedCategories.map(c => `${c.category.replace('HARM_CATEGORY_', '')} (${c.probability})`).join(', ')}`;
            
            return {
                is_flagged: true,
                severity: highestSeverity,
                reason: reason,
                action: getAction(highestSeverity),
                // Confidence is high as it's based on direct API feedback.
                // A more complex mapping from probability strings could be used if needed.
                confidence: 0.9,
            };
        }

        // If no categories were flagged
        return {
            is_flagged: false,
            severity: "low",
            reason: "Content approved",
            action: "approve",
            confidence: 1.0,
        };

    } catch (error) {
        console.error("Error during content moderation:", error);
        return {
            is_flagged: false,
            severity: "low",
            reason: `Moderation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            action: "approve",
            confidence: 0.5,
        };
    }
};

/**
 * Checks if the Gemini client for moderation is configured and ready.
 * @returns True if the client is initialized, false otherwise.
 */
export const isGeminiModerationConfigured = (): boolean => {
    return genAI !== null;
};