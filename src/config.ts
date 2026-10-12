// Firebase settings for this family's project.
// These values are not secret (they identify the project); access is controlled
// by the Firestore rules in firestore.rules. Fill them in from the Firebase console:
// Project settings → Your apps → Web app → SDK setup and configuration → Config.
export const firebaseConfig = {
  apiKey: "REPLACE_ME",
  authDomain: "REPLACE_ME.firebaseapp.com",
  projectId: "REPLACE_ME",
  storageBucket: "REPLACE_ME.appspot.com",
  messagingSenderId: "REPLACE_ME",
  appId: "REPLACE_ME",
};

export const isConfigured = !firebaseConfig.apiKey.startsWith("REPLACE");

// Gemini model used to read messages and images (through Firebase AI Logic, free tier).
export const AI_MODEL = "gemini-2.5-flash";
