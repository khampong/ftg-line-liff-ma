import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "prisma/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/*.integration.test.ts"],
    env: {
      // ค่า dummy สำหรับ unit test เท่านั้น (ไม่ใช่ secret จริง ไม่ต้องต่อ DB จริง)
      DATABASE_URL: "postgresql://test:test@localhost:5432/test_db",
      JWT_ACCESS_SECRET: "test-access-secret-not-for-production",
      JWT_REFRESH_SECRET: "test-refresh-secret-not-for-production",
      LINE_CHANNEL_ID: "test-line-channel-id",
      LINE_LOGIN_CHANNEL_ID: "test-line-channel-id",
      UPLOAD_DIR: ".vitest-uploads-tmp",
      MAX_UPLOAD_SIZE_MB: "1",
    },
  },
});
