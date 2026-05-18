import "express-session";

declare module "express-session" {
  interface SessionData {
    userId: number;
    user: {
      id: string;
      email: string;
      role: string;
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
