// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import WatermarkOverlay from "@/components/WatermarkOverlay";

describe("Functional: WatermarkOverlay Component", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("should return null when watermark is disabled or fetch fails", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ overlay: { enabled: false } }),
    });

    const { container } = render(<WatermarkOverlay />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/settings/watermark");
    });

    expect(container.firstChild).toBeNull();
  });

  it("should render SVG tiled pattern with text and QR when enabled", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        overlay: {
          enabled: true,
          text: "security@pixxel.ai • CONFIDENTIAL",
          qrDataUrl: "data:image/png;base64,sample",
          opacity: 10,
          fontSize: 14,
        },
      }),
    });

    const { container } = render(<WatermarkOverlay />);

    await waitFor(() => {
      expect(container.querySelector("svg")).toBeInTheDocument();
    });

    const wrapper = container.querySelector('[aria-hidden="true"]');
    expect(wrapper).toBeInTheDocument();
    expect(wrapper).toHaveClass("pointer-events-none");

    const textEl = container.querySelector("text");
    expect(textEl?.textContent).toBe("security@pixxel.ai • CONFIDENTIAL");

    const imageEl = container.querySelector("image");
    expect(imageEl).toBeInTheDocument();
    expect(imageEl).toHaveAttribute("href", "data:image/png;base64,sample");
  });
});
