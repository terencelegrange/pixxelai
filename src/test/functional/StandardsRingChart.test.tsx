// @vitest-environment jsdom
import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import StandardsRingChart, { CATEGORY_COLORS } from "@/components/StandardsRingChart";

describe("Functional: StandardsRingChart Component", () => {
  const sampleAreas = [
    { category: "Security", score: 85, meets_count: 5, controls_count: 6 },
    { category: "Architecture", score: 100, meets_count: 6, controls_count: 6 },
    { category: "Privacy", score: 50, meets_count: 3, controls_count: 6 },
    { category: "Compliance", score: null, meets_count: 0, controls_count: 5 },
  ];

  it("should render SVG with custom size and center label", () => {
    const { container } = render(
      <StandardsRingChart areas={sampleAreas} size={280} centerLabel="Test App" />
    );

    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("width", "280");
    expect(svg).toHaveAttribute("height", "280");
    expect(svg).toHaveAttribute("role", "img");

    // Center label and computed overall average: (85 + 100 + 50) / 3 = 78%
    expect(screen.getByText("78%")).toBeInTheDocument();
    expect(screen.getAllByText("Test App").length).toBeGreaterThanOrEqual(1);
  });

  it("should render closed indicator for 100% completed categories", () => {
    render(<StandardsRingChart areas={sampleAreas} size={280} />);

    // Architecture has score 100, so it shows "Closed 100%" badge
    expect(screen.getByText("Closed 100%")).toBeInTheDocument();
  });

  it("should render Pending for unassessed categories", () => {
    render(<StandardsRingChart areas={sampleAreas} size={280} />);

    // Compliance has score null, so it shows Pending
    expect(screen.getByText("Pending")).toBeInTheDocument();
  });

  it("should render progressbars with accessible ARIA values for each category in the legend", () => {
    render(<StandardsRingChart areas={sampleAreas} size={280} />);

    const progressbars = screen.getAllByRole("progressbar");
    expect(progressbars.length).toBe(sampleAreas.length);

    expect(screen.getByLabelText("Security compliance: 85%")).toBeInTheDocument();
    expect(screen.getByLabelText("Architecture compliance: 100%")).toBeInTheDocument();
    expect(screen.getByLabelText("Privacy compliance: 50%")).toBeInTheDocument();
    expect(screen.getByLabelText("Compliance compliance: 0%")).toBeInTheDocument();
  });

  it("should hide legend when showLegend is false", () => {
    const { container } = render(
      <StandardsRingChart areas={sampleAreas} size={200} showLegend={false} />
    );

    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();

    const progressbars = screen.queryAllByRole("progressbar");
    expect(progressbars.length).toBe(0);
  });

  it("should handle empty categories gracefully without crashing", () => {
    const { container } = render(<StandardsRingChart areas={[]} size={160} />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(screen.getByText("Not Assessed")).toBeInTheDocument();
  });

  it("should map categories to defined color schemes", () => {
    expect(CATEGORY_COLORS.security.stroke).toBe("#10b981");
    expect(CATEGORY_COLORS.architecture.stroke).toBe("#0284c7");
    expect(CATEGORY_COLORS.privacy.stroke).toBe("#8b5cf6");
    expect(CATEGORY_COLORS.compliance.stroke).toBe("#f59e0b");
    expect(CATEGORY_COLORS.legal.stroke).toBe("#f43f5e");
    expect(CATEGORY_COLORS.quality.stroke).toBe("#ec4899");
  });
});
