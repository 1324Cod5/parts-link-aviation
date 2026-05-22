import "express-session";

declare module "express-session" {
  interface SessionData {
    userId: number;
    user: {
      id: string;
      email: string;
      /** Backward-compat alias for activeRole — always equals activeRole. */
      role: string;
      /** All roles assigned to this account (e.g. ["buyer","seller"]). */
      roles: string[];
      /** Currently active role for UI context. */
      activeRole: string;
      subscriptionTier: string;
      subscriptionStatus: string;
      permissions: {
        canCreateListings: boolean;
        rfqFullAccess: boolean;
        maxListings: number | null;
      };
    };
  }
}
