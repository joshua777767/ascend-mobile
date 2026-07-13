module.exports = {
  testEnvironment: "node",
  verbose: true,
  testMatch: ["**/__tests__/**/*.test.ts"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
  transform: {
    "^.+\\.(ts|tsx|js|jsx)$": [
      "babel-jest",
      { configFile: "./babel.config.js" },
    ],
  },
  // Transform expo-notifications so import syntax resolves
  // (the module itself is fully mocked in tests — this just lets jest parse it)
  transformIgnorePatterns: [
    "node_modules/(?!(expo-notifications|expo-modules-core)/)",
  ],
};
