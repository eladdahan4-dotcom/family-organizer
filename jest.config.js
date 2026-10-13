// Unit + screen tests. Runs the app's real screens in a React Native test renderer,
// with the database replaced by an in-memory fake and phone features (gallery, camera,
// share sheet, notifications) replaced by controllable mocks.
module.exports = {
  preset: "jest-expo",
  testMatch: ["<rootDir>/tests/unit/**/*.test.ts?(x)"],
  setupFilesAfterEnv: ["<rootDir>/tests/unit/setup.ts"],
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|expo-.*|@react-native-async-storage/.*|firebase|@firebase/.*)",
  ],
  testTimeout: 20000,
};
