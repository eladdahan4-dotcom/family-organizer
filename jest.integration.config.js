// Database tests: the app's real data code (src/firebase.ts) against a local Firestore
// emulator loaded with the real security rules (firestore.rules).
module.exports = {
  testEnvironment: "node",
  testMatch: ["<rootDir>/tests/integration/**/*.test.ts"],
  transform: { "^.+\\.tsx?$": ["ts-jest", { tsconfig: { esModuleInterop: true, module: "commonjs", target: "es2020", strict: false, skipLibCheck: true } }] },
  testTimeout: 30000,
};
