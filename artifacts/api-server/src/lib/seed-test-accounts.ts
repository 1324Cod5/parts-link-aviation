import bcrypt from "bcrypt";
import { db, usersTable, mroProfilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

interface TestAccount {
  email: string;
  password: string;
  role: "seller" | "super_admin";
  plan: "free" | "pro" | "enterprise" | "mro_verified" | "mro_premium";
  companyName: string;
  contactName: string;
  subscriptionStatus?: "active" | "trial" | "past_due" | "cancelled" | "suspended";
  currentPeriodEnd?: Date;
  mroProfile?: {
    companyName: string;
    description: string;
    country: string;
    city: string;
    contactName: string;
    contactEmail: string;
    contactPhone: string;
    serviceTypes: string[];
    aircraftTypes: string[];
    certifications: string[];
    turnaroundTime: string;
  };
}

const ONE_MONTH = 30 * 24 * 60 * 60 * 1000;

const TEST_ACCOUNTS: TestAccount[] = [
  {
    email: "admin@test.com",
    password: "Admin123!",
    role: "super_admin",
    plan: "enterprise",
    companyName: "AeroParts Test Admin",
    contactName: "Test Administrator",
  },
  {
    email: "freeseller@test.com",
    password: "Seller123!",
    role: "seller",
    plan: "free",
    companyName: "Free Seller Co.",
    contactName: "Free Seller",
  },
  {
    email: "proseller@test.com",
    password: "Seller123!",
    role: "seller",
    plan: "pro",
    companyName: "Pro Aviation Parts LLC",
    contactName: "Pro Seller",
    subscriptionStatus: "active",
    currentPeriodEnd: new Date(Date.now() + ONE_MONTH),
  },
  {
    email: "enterprise@test.com",
    password: "Seller123!",
    role: "seller",
    plan: "enterprise",
    companyName: "Enterprise Aviation Group",
    contactName: "Enterprise Seller",
    subscriptionStatus: "active",
    currentPeriodEnd: new Date(Date.now() + ONE_MONTH),
  },
  {
    email: "freemro@test.com",
    password: "MRO123!",
    role: "seller",
    plan: "free",
    companyName: "Basic MRO Services",
    contactName: "Free MRO Contact",
    mroProfile: {
      companyName: "Basic MRO Services",
      description: "Entry-level MRO provider offering basic airframe inspections and component repair.",
      country: "United States",
      city: "Dallas, TX",
      contactName: "Free MRO Contact",
      contactEmail: "freemro@test.com",
      contactPhone: "+1 214-555-0100",
      serviceTypes: ["Airframe Inspection"],
      aircraftTypes: ["Boeing 737"],
      certifications: ["FAA Part 145"],
      turnaroundTime: "10-14 business days",
    },
  },
  {
    email: "verifiedmro@test.com",
    password: "MRO123!",
    role: "seller",
    plan: "mro_verified",
    companyName: "Verified Aero Maintenance Inc.",
    contactName: "Verified MRO Manager",
    subscriptionStatus: "active",
    currentPeriodEnd: new Date(Date.now() + ONE_MONTH),
    mroProfile: {
      companyName: "Verified Aero Maintenance Inc.",
      description: "Verified MRO provider specialising in narrow-body maintenance and avionics. FAA Part-145 and EASA Part-145 certified with a strong focus on quick turnaround.",
      country: "United States",
      city: "Atlanta, GA",
      contactName: "Verified MRO Manager",
      contactEmail: "verifiedmro@test.com",
      contactPhone: "+1 404-555-0180",
      serviceTypes: [
        "Airframe Inspection",
        "Avionics Repair",
        "Component Repair",
        "NDT Inspection",
        "Line Maintenance",
        "Interior Refurbishment",
      ],
      aircraftTypes: ["Boeing 737", "Airbus A320 Family", "Bombardier CRJ"],
      certifications: ["FAA Part-145", "EASA Part-145"],
      turnaroundTime: "5-10 business days",
    },
  },
  {
    email: "premiummro@test.com",
    password: "MRO123!",
    role: "seller",
    plan: "mro_premium",
    companyName: "Premium Aero Services Ltd.",
    contactName: "Premium MRO Director",
    subscriptionStatus: "active",
    currentPeriodEnd: new Date(Date.now() + ONE_MONTH),
    mroProfile: {
      companyName: "Premium Aero Services Ltd.",
      description: "Full-service MRO centre specialising in widebody maintenance, avionics overhaul, and engine shop visits. EASA Part-145 and FAA Part-145 approved.",
      country: "United Kingdom",
      city: "London Heathrow",
      contactName: "Premium MRO Director",
      contactEmail: "premiummro@test.com",
      contactPhone: "+44 20 7946 0200",
      serviceTypes: [
        "Airframe Heavy Maintenance",
        "Avionics Overhaul",
        "Engine Shop Visit",
        "Component Repair",
        "NDT Inspection",
        "Painting & Refinishing",
        "Interior Refurbishment",
        "AOG Response",
        "Line Maintenance",
        "Landing Gear Overhaul",
      ],
      aircraftTypes: ["Boeing 777", "Boeing 787", "Airbus A330", "Airbus A350", "Airbus A320 Family"],
      certifications: ["EASA Part-145", "FAA Part-145", "TCCA AMO", "CAAS Approval"],
      turnaroundTime: "3-7 business days (line); 30-45 days (heavy check)",
    },
  },
];

export async function seedTestAccounts(): Promise<void> {
  try {
    for (const account of TEST_ACCOUNTS) {
      const [existing] = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.email, account.email));

      if (existing) continue;

      const passwordHash = await bcrypt.hash(account.password, 10);

      const [inserted] = await db
        .insert(usersTable)
        .values({
          email: account.email,
          passwordHash,
          role: account.role,
          plan: account.plan,
          companyName: account.companyName,
          contactName: account.contactName,
          subscriptionStatus: account.subscriptionStatus ?? null,
          currentPeriodEnd: account.currentPeriodEnd ?? null,
        })
        .returning({ id: usersTable.id });

      logger.info({ email: account.email, plan: account.plan }, "Test account created");

      if (account.mroProfile && inserted) {
        await db.insert(mroProfilesTable).values({
          userId: inserted.id,
          companyName: account.mroProfile.companyName,
          description: account.mroProfile.description,
          country: account.mroProfile.country,
          city: account.mroProfile.city,
          contactName: account.mroProfile.contactName,
          contactEmail: account.mroProfile.contactEmail,
          contactPhone: account.mroProfile.contactPhone,
          serviceTypes: account.mroProfile.serviceTypes,
          aircraftTypes: account.mroProfile.aircraftTypes,
          certifications: account.mroProfile.certifications,
          turnaroundTime: account.mroProfile.turnaroundTime,
          status: "active",
          featured: account.plan === "mro_premium",
        });
        logger.info({ email: account.email }, "MRO profile created for test account");
      }
    }
  } catch (err) {
    logger.error({ err }, "Failed to seed test accounts");
  }
}
