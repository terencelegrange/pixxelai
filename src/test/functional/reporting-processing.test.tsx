// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AssessmentProcessingPage from "@/app/(dashboard)/reporting/processing/page";

describe("Functional: AssessmentProcessingPage Component", () => {
  const originalFetch = global.fetch;
  const originalConfirm = window.confirm;

  const mockProcessingData = {
    stats: {
      running_count: 1,
      queued_count: 2,
      total_in_flight: 3,
      active_workers: 1,
      estimated_wait_seconds: 70,
    },
    running: [
      {
        id: "run-1",
        application_id: "app-1",
        category: "Security",
        status: "analyzing",
        approx_percent: 80,
        phase_label: "AI Reviewing Standards & Code...",
        elapsed_seconds: 45,
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
      {
        id: "queue-2",
        application_id: "app-3",
        category: "Compliance",
        status: "queued",
        queue_position: 2,
        wait_seconds: 10,
        created_at: new Date().toISOString(),
        application: {
          id: "app-3",
          name: "Data Pipeline",
          short_code: "DP-ETL",
          category: "Tier-1",
          repo_url: "https://github.com/org/data-pipeline",
        },
      },
    ],
    recent: [
      {
        id: "rec-1",
        category: "Security",
        status: "completed",
        compliance_score: 92,
        completed_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        application: {
          id: "app-4",
          name: "Auth Service",
          short_code: "AUTH",
        },
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    window.confirm = vi.fn().mockReturnValue(true);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    window.confirm = originalConfirm;
  });

  it("should render processing queue with active, queued, and stats metrics", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockProcessingData,
    });

    render(<AssessmentProcessingPage />);

    await waitFor(() => {
      expect(screen.getByText("Assessment Processing Queue")).toBeInTheDocument();
      expect(screen.getByText("Payment Gateway")).toBeInTheDocument();
      expect(screen.getByText("Customer Portal")).toBeInTheDocument();
      expect(screen.getByText("Data Pipeline")).toBeInTheDocument();
    });

    // Check progress bar and phase
    expect(screen.getByText("AI Reviewing Standards & Code...")).toBeInTheDocument();
    expect(screen.getByText("80%")).toBeInTheDocument();
    const progressbar = screen.getByRole("progressbar");
    expect(progressbar).toHaveAttribute("aria-valuenow", "80");

    // Check KPI cards
    expect(screen.getByText("FIFO priority scheduling")).toBeInTheDocument();
    expect(screen.getByText("~35 seconds per assessment")).toBeInTheDocument();
    expect(screen.getByText("Processing Active")).toBeInTheDocument();

    // Check recent executions
    expect(screen.getByText("Auth Service")).toBeInTheDocument();
    expect(screen.getByText("92% Score")).toBeInTheDocument();
  });

  it("should display empty state when all queues are clear", async () => {
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

    render(<AssessmentProcessingPage />);

    await waitFor(() => {
      expect(screen.getByText("All Assessment Queues Clear")).toBeInTheDocument();
      expect(screen.getByText("Idle / Standing By")).toBeInTheDocument();
      expect(screen.getByText("No assessments currently executing.")).toBeInTheDocument();
      expect(screen.getByText("No assessments currently queued.")).toBeInTheDocument();
    });
  });

  it("should switch tabs to filter content views", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockProcessingData,
    });

    render(<AssessmentProcessingPage />);

    await waitFor(() => {
      expect(screen.getByText("Payment Gateway")).toBeInTheDocument();
    });

    // Switch to Running tab only
    const runningTab = screen.getByRole("button", { name: /Running \(1\)/i });
    fireEvent.click(runningTab);

    expect(screen.getByText("Payment Gateway")).toBeInTheDocument();
    expect(screen.queryByText("Customer Portal")).not.toBeInTheDocument();

    // Switch to Queued tab only
    const queuedTab = screen.getByRole("button", { name: /Queued Backlog \(2\)/i });
    fireEvent.click(queuedTab);

    expect(screen.queryByText("Payment Gateway")).not.toBeInTheDocument();
    expect(screen.getByText("Customer Portal")).toBeInTheDocument();
  });

  it("should trigger manual refresh when clicked", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockProcessingData,
    });

    render(<AssessmentProcessingPage />);

    await waitFor(() => {
      expect(screen.getByText("Payment Gateway")).toBeInTheDocument();
    });

    const refreshBtn = screen.getByRole("button", { name: /refresh queue data/i });
    fireEvent.click(refreshBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  it("should allow cancelling/dequeuing a queued assessment", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockProcessingData,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...mockProcessingData,
          queued: [mockProcessingData.queued[1]],
          stats: { ...mockProcessingData.stats, queued_count: 1, total_in_flight: 2 },
        }),
      });

    render(<AssessmentProcessingPage />);

    await waitFor(() => {
      expect(screen.getByText("Customer Portal")).toBeInTheDocument();
    });

    const cancelBtn = screen.getByRole("button", {
      name: /cancel queued assessment for Customer Portal/i,
    });
    fireEvent.click(cancelBtn);

    expect(window.confirm).toHaveBeenCalled();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/reporting/processing?id=queue-1", {
        method: "DELETE",
      });
      expect(screen.getByText("Cancelled assessment for Customer Portal.")).toBeInTheDocument();
    });
  });
});
