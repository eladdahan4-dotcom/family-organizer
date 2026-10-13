// Firebase settings for this family's project.
// These values are not secret (they identify the project); access is controlled
// by the Firestore rules in firestore.rules. Fill them in from the Firebase console:
// Project settings → Your apps → Web app → SDK setup and configuration → Config.
export const firebaseConfig = {
  apiKey: "AIzaSyACe9n8HHmdJwDUelf3fUmSt0ypbx59JxY",
  authDomain: "family-board-40de6.firebaseapp.com",
  projectId: "family-board-40de6",
  storageBucket: "family-board-40de6.firebasestorage.app",
  messagingSenderId: "843131632426",
  appId: "1:843131632426:web:9280c47db938643b7c7c53",
};

export const isConfigured = !firebaseConfig.apiKey.startsWith("REPLACE");

// Gemini models used to read messages and images (through Firebase AI Logic, free tier).
// The lighter model goes first: it is faster and passed every real-AI test. When a model is
// out of daily quota (429), retired (404) or doesn't answer in time, the next one is tried.
export const AI_MODELS = ["gemini-flash-lite-latest", "gemini-3.8-flash"];
export const AI_MODEL = AI_MODELS[0];
