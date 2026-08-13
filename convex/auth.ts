import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";

const MockmarkPassword = Password({
  profile(params) {
    const email = String(params.email ?? "")
      .trim()
      .toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email))
      throw new ConvexError("Enter a valid email address.");
    const profile: Record<string, string> & { email: string } = { email };
    if (params.flow !== "signUp") return profile;
    const name = String(params.name ?? "")
      .trim()
      .replace(/\s+/g, " ");
    if (name.length < 2 || name.length > 80)
      throw new ConvexError("Name must be 2-80 characters.");
    profile.name = name;
    return profile;
  },
  validatePasswordRequirements(password) {
    if (
      password.length < 12 ||
      !/[a-z]/.test(password) ||
      !/[A-Z]/.test(password) ||
      !/\d/.test(password)
    ) {
      throw new ConvexError(
        "Password must be at least 12 characters with upper, lower, and numeric characters.",
      );
    }
  },
});

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [MockmarkPassword],
});
