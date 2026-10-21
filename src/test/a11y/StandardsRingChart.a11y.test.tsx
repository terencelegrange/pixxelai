// @vitest-environment jsdom
import React from "react";
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { axe } from "vitest-axe";
import StandardsRingChart from "@/components/StandardsRingChart";

describe("Accessibility (a11y): StandardsRingChart Component", () => {
  const sampleAreas = [
    { category: "Security", score: 85, meets_count: 5, controls_count: 6 },
    { category: "Architecture", score: 100, meets_count: 6, controls_count: 6 },
    { category: "Privacy", score: 50, meets_count: 3, controls_count: 6 },
    { category: "Compliance", score: null, meets_count: 0, controls_count: 5 },
  ];

  it("should have zero WCAG accessibility violations in default state with legend", async () => {
    const { container } = render(
      <StandardsRingChart areas={sampleAreas} size={280} centerLabel="RainyDay App" />
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("should have zero accessibility violations when rendered compactly without legend", async () => {
    const { container } = render(
      <StandardsRingChart areas={sampleAreas} size={140} showLegend={false} />
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("should have zero accessibility violations when categories are empty", async () => {
    const { container } = render(<StandardsRingChart areas={[]} size={160} />);

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("should provide accessible names and semantic markup for SVG and progressbars", () => {
    const { container } = render(
      <StandardsRingChart areas={sampleAreas} size={280} centerLabel="Test App" />
    );

    // SVG graphics container accessibility
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("role", "img");
    expect(svg).toHaveAttribute("aria-label", "Test App compliance ring chart");
    expect(container.querySelector("svg title")?.textContent).toBe("Test App");

    // Progress bar accessibility in legend
    const progressbars = container.querySelectorAll('[role="progressbar"]');
    expect(progressbars.length).toBe(sampleAreas.length);

    progressbars.forEach((bar) => {
      expect(bar).toHaveAttribute("aria-valuenow");
      expect(bar).toHaveAttribute("aria-valuemin", "0");
      expect(bar).toHaveAttribute("aria-valuemax", "100");
      expect(bar).toHaveAttribute("aria-label");
    });
  });
});
