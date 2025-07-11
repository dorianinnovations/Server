import request from "supertest";
import app from "../../src/server.js";
import mongoose from "mongoose";
import User from "../../src/models/User.js";
import CollectiveDataConsent from "../../src/models/CollectiveDataConsent.js";
import CollectiveSnapshot from "../../src/models/CollectiveSnapshot.js";

describe("Collective Snapshots API", () => {
  let testUser;
  let authToken;

  beforeAll(async () => {
    // Create test user
    testUser = new User({
      email: "test@snapshots.com",
      password: "testpassword123",
      emotionalLog: [
        {
          emotion: "awe",
          intensity: 8,
          context: "Beautiful sunset",
          timestamp: new Date()
        },
        {
          emotion: "joy",
          intensity: 7,
          context: "Great conversation",
          timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      ]
    });
    await testUser.save();

    // Create consent for test user
    const consent = new CollectiveDataConsent({
      userId: testUser._id,
      consentStatus: "granted",
      dataTypes: {
        emotions: true,
        intensity: true,
        context: true,
        demographics: false,
        activityPatterns: false
      }
    });
    await consent.save();

    // Login to get auth token
    const loginResponse = await request(app)
      .post("/auth/login")
      .send({
        email: "test@snapshots.com",
        password: "testpassword123"
      });

    authToken = loginResponse.body.token;
  });

  afterAll(async () => {
    // Cleanup
    await User.deleteMany({ email: "test@snapshots.com" });
    await CollectiveDataConsent.deleteMany({ userId: testUser._id });
    await CollectiveSnapshot.deleteMany({});
    await mongoose.connection.close();
  });

  describe("POST /collective-snapshots/generate", () => {
    it("should generate a new snapshot", async () => {
      const response = await request(app)
        .post("/collective-snapshots/generate")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          timeRange: "30d"
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.snapshot).toBeDefined();
      expect(response.body.snapshot.dominantEmotion).toBeDefined();
      expect(response.body.snapshot.archetype).toBeDefined();
      expect(response.body.snapshot.insight).toBeDefined();
    });

    it("should reject invalid time range", async () => {
      const response = await request(app)
        .post("/collective-snapshots/generate")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          timeRange: "invalid"
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it("should require authentication", async () => {
      const response = await request(app)
        .post("/collective-snapshots/generate")
        .send({
          timeRange: "30d"
        });

      expect(response.status).toBe(401);
    });
  });

  describe("GET /collective-snapshots/latest", () => {
    it("should get the latest snapshot", async () => {
      const response = await request(app)
        .get("/collective-snapshots/latest?timeRange=30d");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.snapshot).toBeDefined();
    });

    it("should handle no snapshots found", async () => {
      const response = await request(app)
        .get("/collective-snapshots/latest?timeRange=7d");

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe("GET /collective-snapshots/history", () => {
    it("should get snapshot history", async () => {
      const response = await request(app)
        .get("/collective-snapshots/history?timeRange=30d&limit=5");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.snapshots).toBeDefined();
      expect(Array.isArray(response.body.snapshots)).toBe(true);
    });
  });

  describe("GET /collective-snapshots/archetypes", () => {
    it("should get archetype history", async () => {
      const response = await request(app)
        .get("/collective-snapshots/archetypes?timeRange=30d&limit=10");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.archetypes).toBeDefined();
      expect(Array.isArray(response.body.archetypes)).toBe(true);
    });
  });

  describe("GET /collective-snapshots/emotions", () => {
    it("should get emotion trends", async () => {
      const response = await request(app)
        .get("/collective-snapshots/emotions?timeRange=30d&limit=10");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.emotions).toBeDefined();
      expect(Array.isArray(response.body.emotions)).toBe(true);
    });
  });

  describe("GET /collective-snapshots/stats", () => {
    it("should get snapshot statistics", async () => {
      const response = await request(app)
        .get("/collective-snapshots/stats");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.stats).toBeDefined();
      expect(response.body.stats.totalSnapshots).toBeDefined();
    });
  });

  describe("GET /collective-snapshots/:id", () => {
    it("should get detailed snapshot", async () => {
      // First create a snapshot
      const snapshot = new CollectiveSnapshot({
        timestamp: new Date(),
        sampleSize: 10,
        dominantEmotion: "joy",
        avgIntensity: 7.5,
        insight: "The collective is experiencing joy and wonder.",
        archetype: "The Dreamer",
        status: "completed",
        metadata: {
          timeRange: "30d",
          totalEmotions: 25
        }
      });
      await snapshot.save();

      const response = await request(app)
        .get(`/collective-snapshots/${snapshot._id}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.snapshot).toBeDefined();
      expect(response.body.snapshot.dominantEmotion).toBe("joy");
      expect(response.body.snapshot.archetype).toBe("The Dreamer");
    });

    it("should handle non-existent snapshot", async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .get(`/collective-snapshots/${fakeId}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe("DELETE /collective-snapshots/:id", () => {
    it("should delete a snapshot with authentication", async () => {
      // Create a snapshot to delete
      const snapshot = new CollectiveSnapshot({
        timestamp: new Date(),
        sampleSize: 5,
        dominantEmotion: "sadness",
        avgIntensity: 3.0,
        insight: "The collective is experiencing sadness.",
        archetype: "The Wanderer",
        status: "completed"
      });
      await snapshot.save();

      const response = await request(app)
        .delete(`/collective-snapshots/${snapshot._id}`)
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify it's deleted
      const deletedSnapshot = await CollectiveSnapshot.findById(snapshot._id);
      expect(deletedSnapshot).toBeNull();
    });

    it("should require authentication for deletion", async () => {
      const response = await request(app)
        .delete(`/collective-snapshots/${new mongoose.Types.ObjectId()}`);

      expect(response.status).toBe(401);
    });
  });

  describe("GET /collective-snapshots/search", () => {
    it("should search snapshots by archetype", async () => {
      const response = await request(app)
        .get("/collective-snapshots/search?archetype=Dreamer&timeRange=30d");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.snapshots).toBeDefined();
      expect(response.body.pagination).toBeDefined();
    });

    it("should search snapshots by emotion", async () => {
      const response = await request(app)
        .get("/collective-snapshots/search?emotion=joy&timeRange=30d");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.snapshots).toBeDefined();
    });
  });

  describe("GET /collective-snapshots/export", () => {
    it("should export snapshots as JSON", async () => {
      const response = await request(app)
        .get("/collective-snapshots/export")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.metadata).toBeDefined();
      expect(response.body.snapshots).toBeDefined();
    });

    it("should export snapshots as CSV", async () => {
      const response = await request(app)
        .get("/collective-snapshots/export?format=csv")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toContain("text/csv");
    });

    it("should require authentication for export", async () => {
      const response = await request(app)
        .get("/collective-snapshots/export");

      expect(response.status).toBe(401);
    });
  });
}); 