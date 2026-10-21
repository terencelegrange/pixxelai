// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import {
  getRememberedProfiles,
  rememberProfile,
  forgetProfile,
  RememberedProfile,
} from "@/lib/profiles";

describe("Unit: Remembered Profiles Utilities (lib/profiles)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("should return empty array when localStorage is empty or corrupt", () => {
    expect(getRememberedProfiles()).toEqual([]);

    window.localStorage.setItem("bp_profiles", "invalid-json");
    expect(getRememberedProfiles()).toEqual([]);
  });

  it("should store and retrieve remembered profiles in descending order of activity", () => {
    const p1: RememberedProfile = {
      id: 1,
      email: "user1@pixxel.ai",
      name: "User One",
      avatar: 5,
    };
    const p2: RememberedProfile = {
      id: 2,
      email: "user2@pixxel.ai",
      name: "User Two",
      avatar: 10,
    };

    rememberProfile(p1);
    rememberProfile(p2);

    const profiles = getRememberedProfiles();
    expect(profiles).toHaveLength(2);
    expect(profiles[0].email).toBe("user2@pixxel.ai"); // Most recently remembered at top
    expect(profiles[1].email).toBe("user1@pixxel.ai");
  });

  it("should preserve existing deviceToken unless explicitly modified", () => {
    const initial: RememberedProfile = {
      id: 1,
      email: "trusted@pixxel.ai",
      name: "Trusted User",
      avatar: 2,
      deviceToken: "secret-device-token-abc",
    };
    rememberProfile(initial);

    // Profile update without mentioning deviceToken
    const update: RememberedProfile = {
      id: 1,
      email: "trusted@pixxel.ai",
      name: "Updated Name",
      avatar: 3,
    };
    rememberProfile(update);

    const updated = getRememberedProfiles()[0];
    expect(updated.name).toBe("Updated Name");
    expect(updated.deviceToken).toBe("secret-device-token-abc");
  });

  it("should remove profile when forgetProfile is called", () => {
    rememberProfile({ id: 1, email: "remove-me@pixxel.ai", name: "To Remove", avatar: 1 });
    rememberProfile({ id: 2, email: "keep-me@pixxel.ai", name: "To Keep", avatar: 2 });

    expect(getRememberedProfiles()).toHaveLength(2);

    forgetProfile("remove-me@pixxel.ai");

    const remaining = getRememberedProfiles();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].email).toBe("keep-me@pixxel.ai");
  });

  it("should cap stored profiles at maximum of 10", () => {
    for (let i = 1; i <= 15; i++) {
      rememberProfile({
        id: i,
        email: `user${i}@pixxel.ai`,
        name: `User ${i}`,
        avatar: i,
      });
    }

    const profiles = getRememberedProfiles();
    expect(profiles).toHaveLength(10);
    expect(profiles[0].email).toBe("user15@pixxel.ai");
  });
});
