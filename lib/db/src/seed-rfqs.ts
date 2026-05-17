import { db, rfqsTable } from "./index";

const demo = [
  {
    buyerName: "Marcus Chen",
    buyerEmail: "mchen@asiapacificair.com",
    buyerCompany: "Asia Pacific Airlines",
    buyerPhone: "+852-2100-5500",
    partNumber: "CFM56-7B27/3",
    description: "Urgently require 2x CFM56-7B27/3 engines for AOG recovery. Must have FAA/EASA dual release 8130. Will consider serviceable or overhauled with valid test cell report. Need within 10 days.",
    aircraftApplicability: "Boeing 737-800",
    condition: "Serviceable",
    quantity: 2,
    status: "open" as const,
  },
  {
    buyerName: "Sophie Laurent",
    buyerEmail: "slaurent@eurotech-mro.eu",
    buyerCompany: "EuroTech MRO",
    buyerPhone: "+33-1-4400-7700",
    partNumber: "GE90-115B-LPT",
    description: "Seeking LPT module assembly for GE90-115B. EASA Form 1 mandatory. Looking for exchange or outright purchase. Trace history from new required. Budget flexible for right part.",
    aircraftApplicability: "Boeing 777-300ER",
    condition: "Overhauled",
    quantity: 1,
    status: "open" as const,
  },
  {
    buyerName: "Ahmed Al-Rashid",
    buyerEmail: "a.rashid@gulfaero.ae",
    buyerCompany: "Gulf Aero Technics",
    buyerPhone: "+971-4-299-8800",
    partNumber: "P/N 822-1259-001",
    description: "B737 NG nose gear assembly required. Must be SV condition or better. FAA 8130-3 required. We are GCAA approved MRO. Can accept part immediately from any global stock.",
    aircraftApplicability: "Boeing 737-700/800/900",
    condition: "Serviceable",
    quantity: 1,
    status: "open" as const,
  },
  {
    buyerName: "Ingrid Karlsson",
    buyerEmail: "i.karlsson@nordicaviation.se",
    buyerCompany: "Nordic Aviation Capital",
    buyerPhone: "+46-8-1234-5678",
    partNumber: "PW1100G-JM-FAN",
    description: "Fan module assembly for PW1100G-JM engine. New or zero-time since new preferred. EASA Form 1 and full back-to-birth trace required. Part of fleet upgrade program.",
    aircraftApplicability: "Airbus A320neo",
    condition: "New",
    quantity: 3,
    status: "open" as const,
  },
  {
    buyerName: "Carlos Mendez",
    buyerEmail: "cmendez@latamparts.com",
    buyerCompany: "LATAM Parts Trading",
    buyerPhone: "+55-11-5500-2200",
    partNumber: "APS3200-3",
    description: "APU APS3200-3 needed for Airbus A320 family. Serviceable or fully overhauled with test cell. ANAC or FAA cert required. Exchange or outright - open to negotiation.",
    aircraftApplicability: "Airbus A320/A321",
    condition: "Serviceable",
    quantity: 1,
    status: "open" as const,
  },
  {
    buyerName: "James Okafor",
    buyerEmail: "j.okafor@afriwings.ng",
    buyerCompany: "Afri Wings Aviation",
    buyerPhone: "+234-1-700-4400",
    partNumber: "B737-MLG-AXLE",
    description: "Main landing gear axle assembly for 737 Classic. FAA or EASA paperwork required. Urgency level medium — 6 weeks lead time acceptable. Prefer sellers with established trace history.",
    aircraftApplicability: "Boeing 737-300/400/500",
    condition: null,
    quantity: 2,
    status: "open" as const,
  },
  {
    buyerName: "Yuki Tanaka",
    buyerEmail: "y.tanaka@japanmro.co.jp",
    buyerCompany: "Japan MRO Services",
    buyerPhone: "+81-3-5555-8800",
    partNumber: "V2500-A5-HPC",
    description: "HPC module for V2500-A5 engine. JCAB and FAA dual release preferred. Overhauled with green-time remaining acceptable. Need 4 units over the next quarter as part of module swap program.",
    aircraftApplicability: "Airbus A320",
    condition: "Overhauled",
    quantity: 4,
    status: "open" as const,
  },
  {
    buyerName: "Priya Sharma",
    buyerEmail: "p.sharma@indiaairtech.in",
    buyerCompany: "India Air Technologies",
    buyerPhone: "+91-22-6600-4400",
    partNumber: "CFM56-5B4/3",
    description: "Seeking CFM56-5B4/3 engine for A320 operator. QEC required. Will accept hot section inspected with green time. DGCA approval documentation preferred alongside standard FAA/EASA certs.",
    aircraftApplicability: "Airbus A320-214",
    condition: "Serviceable",
    quantity: 1,
    status: "open" as const,
  },
];

async function seed() {
  const existing = await db.select().from(rfqsTable).limit(1);
  if (existing.length > 0) {
    console.log("RFQs already seeded.");
    process.exit(0);
  }
  await db.insert(rfqsTable).values(demo as any);
  console.log(`Seeded ${demo.length} demo RFQs.`);
  process.exit(0);
}

seed().catch(e => { console.error(e); process.exit(1); });
