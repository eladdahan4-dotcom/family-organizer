// Replaces the database and phone features with controllable fakes for every screen test.

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

jest.mock("../../src/firebase", () => {
  const { makeFakeFirebase } = require("./fakeStore");
  return makeFakeFirebase(jest.requireActual("../../src/codes"));
});

// Reminders have their own tests (reminders.test.ts); screens use a no-op.
jest.mock("../../src/notify", () => ({ syncReminders: jest.fn() }));

jest.mock("expo-image-picker", () => ({
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: true, assets: null })),
  launchCameraAsync: jest.fn(async () => ({ canceled: true, assets: null })),
  requestCameraPermissionsAsync: jest.fn(async () => ({ granted: true })),
}));

jest.mock("expo-file-system", () => ({
  readAsStringAsync: jest.fn(async () => "/9j/FROMFILE"),
  EncodingType: { Base64: "base64" },
}));

jest.mock("expo-notifications", () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => null),
  getPermissionsAsync: jest.fn(async () => ({ granted: true })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
  cancelAllScheduledNotificationsAsync: jest.fn(async () => undefined),
  scheduleNotificationAsync: jest.fn(async () => "id"),
  AndroidImportance: { HIGH: 4 },
  SchedulableTriggerInputTypes: { DATE: "date" },
}));

// Content "shared" from WhatsApp / Gallery. Tests set global.__share before rendering.
(global as any).__share = { hasShareIntent: false, shareIntent: null };
jest.mock("expo-share-intent", () => {
  const React = require("react");
  return {
    ShareIntentProvider: ({ children }: any) => React.createElement(React.Fragment, null, children),
    useShareIntentContext: () => {
      const s = (global as any).__share;
      return {
        hasShareIntent: s.hasShareIntent,
        shareIntent: s.shareIntent,
        resetShareIntent: (global as any).__resetShare,
      };
    },
  };
});

beforeEach(() => {
  require("./fakeStore").resetStore();
  (global as any).__share = { hasShareIntent: false, shareIntent: null };
  (global as any).__resetShare = jest.fn(() => {
    (global as any).__share = { hasShareIntent: false, shareIntent: null };
  });
  (global as any).fetch = jest.fn(async () => {
    throw new Error("fetch not mocked in this test");
  });
});
