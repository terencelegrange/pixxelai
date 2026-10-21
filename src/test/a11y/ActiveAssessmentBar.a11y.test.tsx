// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { axe } from "vitest-axe";
import ActiveAssessmentBar from "@/components/ActiveAssessmentBar";

describe("Accessibility (a11y): ActiveAssessmentBar Component", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("should have zero accessibility violations in collapsed/trigger state", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        active: [
          {
            id: "ass-1",
            category: "Security",
            status: "analyzing",
            approx_percent: 80,
            elapsed_seconds: 40,
            application: { id: "app-1", name: "RainyDay App", short_code: "RD" },
          },
        ],
      }),
    });

    const { container } = render(<ActiveAssessmentBar />);

    await waitFor(() => {
      expect(screen.getByText("80%")).toBeInTheDocument();
    });

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("should have zero accessibility violations with open popover dialog", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        active: [
          {
            id: "ass-1",
            category: "Security",
            status: "analyzing",
            approx_percent: 80,
            elapsed_seconds: 40,
            application: { id: "app-1", name: "RainyDay App", short_code: "RD" },
          },
        ],
      }),
    });

    const { container } = render(<ActiveAssessmentBar />);

    await waitFor(() => {
      expect(screen.getByText("80%")).toBeInTheDocument();
    });

    const triggerBtn = screen.getByRole("button", { name: /active assessment in progress/i });
    fireEvent.click(triggerBtn);

    expect(screen.getByRole("dialog")).toBeInTheDocument();

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("should enforce ARIA dialog and trigger button roles", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        active: [
          {
            id: "ass-1",
            category: "Security",
            status: "analyzing",
            approx_percent: 80,
            application: { id: "app-1", name: "RainyDay App", short_code: "RD" },
          },
        ],
      }),
    });

    render(<ActiveAssessmentBar />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /active assessment in progress/i })).toBeInTheDocument();
    });

    const btn = screen.getByRole("button", { name: /active assessment in progress/i });
    expect(btn).toHaveAttribute("aria-expanded", "false");
    expect(btn).toHaveAttribute("aria-haspopup", "dialog");

    fireEvent.click(btn);
    expect(btn).toHaveAttribute("aria-expanded", "true");

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-label", "Active assessment progress details");
  });
});
