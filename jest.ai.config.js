// Real AI tests: sends Hebrew messages and screenshots to the actual Gemini model
// through the app's own extract() function and checks what comes back.
module.exports = {
  testEnvironment: "node",
  testMatch: ["<rootDir>/tests/ai/**/*.test.ts"],
  transform: { "^.+\\.tsx?$": ["ts-jest", { tsconfig: { esModuleInterop: true, module: "commonjs", target: "es2020", strict: false, skipLibCheck: true } }] },
  testTimeout: 120000,
};
