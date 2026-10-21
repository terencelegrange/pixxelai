// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ActiveAssessmentBar from "@/components/ActiveAssessmentBar";

describe("Functional: ActiveAssessmentBar Component", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("should render nothing when no active assessments are returned", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ active: [] }),
    });

    const { container } = render(<ActiveAssessmentBar />);

    // Wait for effect to run
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/assessments/active");
    });

    expect(container.firstChild).toBeNull();
  });

  it("should render active spinner, application name, and percentage when assessment is running", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        active: [
          {
            id: "ass-1",
            category: "Security",
            status: "analyzing",
            approx_percent: 80,
            elapsed_seconds: 45,
            started_at: new Date().toISOString(),
            application: {
              id: "app-1",
              name: "RainyDay Payment App",
              short_code: "RD-PAY",
            },
          },
        ],
      }),
    });

    render(<ActiveAssessmentBar />);

    await waitFor(() => {
      expect(screen.getByText("80%")).toBeInTheDocument();
      expect(screen.getByText("RainyDay Payment App")).toBeInTheDocument();
    });

    const triggerBtn = screen.getByRole("button", { name: /active assessment in progress/i });
    expect(triggerBtn).toBeInTheDocument();
    expect(triggerBtn).toHaveAttribute("aria-expanded", "false");
  });

  it("should toggle popover dialog with assessment details when clicked", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        active: [
          {
            id: "ass-1",
            category: "Security",
            status: "cloning",
            approx_percent: 45,
            elapsed_seconds: 22,
            started_at: new Date().toISOString(),
            application: {
              id: "app-1",
              name: "RainyDay Core",
              short_code: "RD-CORE",
            },
          },
        ],
      }),
    });

    render(<ActiveAssessmentBar />);

    await waitFor(() => {
      expect(screen.getByText("45%")).toBeInTheDocument();
    });

    const triggerBtn = screen.getByRole("button", { name: /active assessment in progress/i });

    // Click to open popover
    fireEvent.click(triggerBtn);

    expect(triggerBtn).toHaveAttribute("aria-expanded", "true");
    const dialog = screen.getByRole("dialog", { name: /active assessment progress details/i });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText("Assessment In Progress")).toBeInTheDocument();
    expect(screen.getByText("Cloning Repo...")).toBeInTheDocument();
    expect(screen.getByText("22s")).toBeInTheDocument();

    // Click again to close popover
    fireEvent.click(triggerBtn);
    expect(triggerBtn).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("should render indicator for multiple active assessments", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        active: [
          {
            id: "ass-1",
            category: "Security",
            status: "analyzing",
            approx_percent: 75,
            application: { id: "app-1", name: "App 1", short_code: "A1" },
          },
          {
            id: "ass-2",
            category: "Architecture",
            status: "queued",
            approx_percent: 15,
            application: { id: "app-2", name: "App 2", short_code: "A2" },
          },
        ],
      }),
    });

    render(<ActiveAssessmentBar />);

    await waitFor(() => {
      // +1 badge for the second running app
      expect(screen.getByText("+1")).toBeInTheDocument();
    });
  });
});
