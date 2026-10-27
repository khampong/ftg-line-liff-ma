import { defineConfig } from "vitest/config";
import { config } from "dotenv";

// integration test: ใช้ DATABASE_URL จริงจาก .env (dev postgres) ไม่ใช่ dummy
// รัน: npm run test:integration (ต้องมี docker compose up postgres ก่อน)
config({ path: ".env" });

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["src/**/*.integration.test.ts"],
    env: {
      LINE_CHANNEL_ID: "test-line-channel-id",
      UPLOAD_DIR: ".vitest-integration-uploads-tmp",
      MAX_UPLOAD_SIZE_MB: "1",
    },
  },
});
