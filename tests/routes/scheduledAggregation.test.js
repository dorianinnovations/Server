import request from "supertest";
import app from "../../src/server.js";
import mongoose from "mongoose";
import User from "../../src/models/User.js";
import CollectiveDataConsent from "../../src/models/CollectiveDataConsent.js";
import scheduledAggregationService from "../../src/services/scheduledAggregationService.js";

describe("Scheduled Aggregation API", () => {
  let testUser;
  let authToken;

  beforeAll(async () => {
    // Create test user
    testUser = new User({
      email: "test@scheduled.com",
      password: "testpassword123",
      emotionalLog: [
        {
          emotion: "joy",
          intensity: 8,
          context: "Great day",
          timestamp: new Date()
        },
        {
          emotion: "wonder",
          intensity: 7,
          context: "Amazing sunset",
          timestamp: new Date(Date.now() - 5 * 60 * 1000) // 5 minutes ago
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
        email: "test@scheduled.com",
        password: "testpassword123"
      });

    authToken = loginResponse.body.token;
  });

  afterAll(async () => {
    // Cleanup
    await User.deleteMany({ email: "test@scheduled.com" });
    await CollectiveDataConsent.deleteMany({ userId: testUser._id });
    
    // Stop the service if it's running
    if (scheduledAggregationService.isRunning) {
      scheduledAggregationService.stop();
    }
    
    await mongoose.connection.close();
  });

  describe("POST /scheduled-aggregation/start", () => {
    it("should start the scheduled aggregation service", async () => {
      const response = await request(app)
        .post("/scheduled-aggregation/start")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.status.isRunning).toBe(true);
    });

    it("should require authentication", async () => {
      const response = await request(app)
        .post("/scheduled-aggregation/start");

      expect(response.status).toBe(401);
    });
  });

  describe("POST /scheduled-aggregation/stop", () => {
    it("should stop the scheduled aggregation service", async () => {
      const response = await request(app)
        .post("/scheduled-aggregation/stop")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.status.isRunning).toBe(false);
    });

    it("should require authentication", async () => {
      const response = await request(app)
        .post("/scheduled-aggregation/stop");

      expect(response.status).toBe(401);
    });
  });

  describe("GET /scheduled-aggregation/status", () => {
    it("should get service status", async () => {
      const response = await request(app)
        .get("/scheduled-aggregation/status");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.status).toBeDefined();
      expect(response.body.status.isRunning).toBeDefined();
    });
  });

  describe("POST /scheduled-aggregation/trigger", () => {
    beforeEach(async () => {
      // Start the service for testing
      if (!scheduledAggregationService.isRunning) {
        scheduledAggregationService.start();
      }
    });

    it("should trigger an aggregation cycle", async () => {
      const response = await request(app)
        .post("/scheduled-aggregation/trigger")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it("should require authentication", async () => {
      const response = await request(app)
        .post("/scheduled-aggregation/trigger");

      expect(response.status).toBe(401);
    });
  });

  describe("GET /scheduled-aggregation/latest", () => {
    it("should get the latest scheduled snapshot", async () => {
      const response = await request(app)
        .get("/scheduled-aggregation/latest");

      // This might return 404 if no snapshots are available yet
      if (response.status === 404) {
        expect(response.body.success).toBe(false);
        expect(response.body.message).toBe("No scheduled snapshots available");
      } else {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.snapshot).toBeDefined();
      }
    });
  });

  describe("GET /scheduled-aggregation/stats", () => {
    it("should get service statistics", async () => {
      const response = await request(app)
        .get("/scheduled-aggregation/stats");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.stats).toBeDefined();
      expect(response.body.stats.runCount).toBeDefined();
      expect(response.body.stats.errorCount).toBeDefined();
    });
  });

  describe("POST /scheduled-aggregation/reset", () => {
    it("should reset service statistics", async () => {
      const response = await request(app)
        .post("/scheduled-aggregation/reset")
        .set("Authorization", `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.stats).toBeDefined();
    });

    it("should require authentication", async () => {
      const response = await request(app)
        .post("/scheduled-aggregation/reset");

      expect(response.status).toBe(401);
    });
  });

  describe("PUT /scheduled-aggregation/interval", () => {
    it("should update aggregation interval", async () => {
      const response = await request(app)
        .put("/scheduled-aggregation/interval")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ minutes: 15 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain("15 minutes");
    });

    it("should reject invalid interval", async () => {
      const response = await request(app)
        .put("/scheduled-aggregation/interval")
        .set("Authorization", `Bearer ${authToken}`)
        .send({ minutes: 0 });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it("should require authentication", async () => {
      const response = await request(app)
        .put("/scheduled-aggregation/interval")
        .send({ minutes: 15 });

      expect(response.status).toBe(401);
    });
  });

  describe("GET /scheduled-aggregation/health", () => {
    it("should return health status", async () => {
      const response = await request(app)
        .get("/scheduled-aggregation/health");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.health).toBeDefined();
      expect(response.body.health.service).toBe("scheduled_aggregation");
      expect(response.body.health.status).toBeDefined();
    });
  });
}); 