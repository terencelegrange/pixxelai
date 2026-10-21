// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { axe } from "vitest-axe";
import AssessmentProcessingPage from "@/app/(dashboard)/reporting/processing/page";

describe("Accessibility (a11y): AssessmentProcessingPage Component", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("should have zero accessibility violations in populated queue state", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        stats: {
          running_count: 1,
          queued_count: 1,
          total_in_flight: 2,
          active_workers: 1,
          estimated_wait_seconds: 35,
        },
        running: [
          {
            id: "run-1",
            application_id: "app-1",
            category: "Security",
            status: "analyzing",
            approx_percent: 80,
            phase_label: "AI Reviewing Standards & Code...",
            elapsed_seconds: 50,
            llm_provider: "anthropic",
            llm_model: "claude-3-5-sonnet",
            started_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            application: {
              id: "app-1",
              name: "Payment Gateway",
              short_code: "PG-API",
              category: "Tier-1",
              repo_url: "https://github.com/org/payment-gateway",
            },
          },
        ],
        queued: [
          {
            id: "queue-1",
            application_id: "app-2",
            category: "Architecture",
            status: "queued",
            queue_position: 1,
            wait_seconds: 25,
            created_at: new Date().toISOString(),
            application: {
              id: "app-2",
              name: "Customer Portal",
              short_code: "CP-WEB",
              category: "Tier-2",
              repo_url: "https://github.com/org/customer-portal",
            },
          },
        ],
        recent: [
          {
            id: "rec-1",
            category: "Security",
            status: "completed",
            compliance_score: 95,
            completed_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            application: {
              id: "app-3",
              name: "Identity Provider",
              short_code: "IDP",
            },
          },
        ],
      }),
    });

    const { container } = render(<AssessmentProcessingPage />);

    await waitFor(() => {
      expect(screen.getByText("Assessment Processing Queue")).toBeInTheDocument();
      expect(screen.getByText("Payment Gateway")).toBeInTheDocument();
    });

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("should have zero accessibility violations in empty queue state", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        stats: {
          running_count: 0,
          queued_count: 0,
          total_in_flight: 0,
          active_workers: 1,
          estimated_wait_seconds: 0,
        },
        running: [],
        queued: [],
        recent: [],
      }),
    });

    const { container } = render(<AssessmentProcessingPage />);

    await waitFor(() => {
      expect(screen.getByText("All Assessment Queues Clear")).toBeInTheDocument();
    });

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
