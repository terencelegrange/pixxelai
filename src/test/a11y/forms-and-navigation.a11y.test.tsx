// @vitest-environment jsdom
import React, { useState } from "react";
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { axe } from "vitest-axe";

/**
 * Accessible SSO Configuration Form Pattern
 * Validates accessibility of master toggle, secondary local account bypass toggle, and input fields.
 */
function MockSsoConfigForm() {
  const [ssoEnabled, setSsoEnabled] = useState(false);
  const [allowLocal, setAllowLocal] = useState(true);
  const [tenantId, setTenantId] = useState("");
  const [clientId, setClientId] = useState("");

  return (
    <form aria-label="Single Sign-On Configuration" onSubmit={(e) => e.preventDefault()}>
      {/* Master Toggle */}
      <div>
        <label htmlFor="sso-toggle" className="font-semibold">
          Enable Single Sign-On (Microsoft Entra)
        </label>
        <button
          id="sso-toggle"
          type="button"
          role="switch"
          aria-checked={ssoEnabled}
          aria-label="Enable Single Sign-On with Microsoft Entra"
          onClick={() => setSsoEnabled(!ssoEnabled)}
        >
          {ssoEnabled ? "Enabled" : "Disabled"}
        </button>
      </div>

      {/* Secondary Bypass Toggle */}
      <div>
        <label htmlFor="local-toggle" className="font-semibold">
          Local accounts allowed
        </label>
        <button
          id="local-toggle"
          type="button"
          role="switch"
          aria-checked={allowLocal}
          aria-label="Allow local accounts to bypass SSO"
          onClick={() => setAllowLocal(!allowLocal)}
        >
          {allowLocal ? "Allowed" : "Enforce SSO Only"}
        </button>
      </div>

      {/* Configuration Inputs */}
      <div>
        <label htmlFor="tenant-id">Directory (Tenant) ID</label>
        <input
          id="tenant-id"
          type="text"
          value={tenantId}
          disabled={!ssoEnabled}
          aria-disabled={!ssoEnabled}
          onChange={(e) => setTenantId(e.target.value)}
        />
      </div>

      <div>
        <label htmlFor="client-id">Application (Client) ID</label>
        <input
          id="client-id"
          type="text"
          value={clientId}
          disabled={!ssoEnabled}
          aria-disabled={!ssoEnabled}
          onChange={(e) => setClientId(e.target.value)}
        />
      </div>

      <button type="submit" disabled={!ssoEnabled}>
        Save Settings
      </button>
    </form>
  );
}

describe("Accessibility (a11y): Form & Toggle Patterns", () => {
  it("should have zero WCAG accessibility violations for the SSO form and toggles", async () => {
    const { container } = render(<MockSsoConfigForm />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("should support keyboard toggle and update aria-checked attribute", () => {
    render(<MockSsoConfigForm />);

    const ssoSwitch = screen.getByRole("switch", {
      name: /enable single sign-on with microsoft entra/i,
    });
    expect(ssoSwitch).toHaveAttribute("aria-checked", "false");

    fireEvent.click(ssoSwitch);
    expect(ssoSwitch).toHaveAttribute("aria-checked", "true");

    const localSwitch = screen.getByRole("switch", {
      name: /allow local accounts to bypass sso/i,
    });
    expect(localSwitch).toHaveAttribute("aria-checked", "true");

    fireEvent.click(localSwitch);
    expect(localSwitch).toHaveAttribute("aria-checked", "false");
  });

  it("should properly disable and enable fields in response to master toggle", () => {
    render(<MockSsoConfigForm />);

    const tenantInput = screen.getByLabelText("Directory (Tenant) ID");
    const clientInput = screen.getByLabelText("Application (Client) ID");
    const saveButton = screen.getByRole("button", { name: "Save Settings" });

    // Initially disabled because master toggle is off
    expect(tenantInput).toBeDisabled();
    expect(clientInput).toBeDisabled();
    expect(saveButton).toBeDisabled();

    // Toggle master switch on
    const ssoSwitch = screen.getByRole("switch", {
      name: /enable single sign-on with microsoft entra/i,
    });
    fireEvent.click(ssoSwitch);

    // Now enabled
    expect(tenantInput).not.toBeDisabled();
    expect(clientInput).not.toBeDisabled();
    expect(saveButton).not.toBeDisabled();
  });
});
