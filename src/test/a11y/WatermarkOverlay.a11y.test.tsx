// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { axe } from "vitest-axe";
import WatermarkOverlay from "@/components/WatermarkOverlay";

describe("Accessibility (a11y): WatermarkOverlay Component", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("should have zero accessibility violations and remain aria-hidden to assistive tech", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        overlay: {
          enabled: true,
          text: "confidential@pixxel.ai • CONFIDENTIAL",
          qrDataUrl: "data:image/png;base64,sample",
          opacity: 8,
          fontSize: 12,
        },
      }),
    });

    const { container } = render(
      <div>
        <main>
          <h1>Application Dashboard</h1>
          <p>Visible accessible page content</p>
        </main>
        <WatermarkOverlay />
      </div>
    );

    await waitFor(() => {
      expect(container.querySelector("svg")).toBeInTheDocument();
    });

    const results = await axe(container);
    expect(results).toHaveNoViolations();

    const overlay = container.querySelector('[aria-hidden="true"]');
    expect(overlay).toBeInTheDocument();
  });
});
