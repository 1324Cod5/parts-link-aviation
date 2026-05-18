import "express-session";

declare module "express-session" {
  interface SessionData {
    userId: number;
    user: { email: string; role: string };
  }
}
