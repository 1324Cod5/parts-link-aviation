import { Link } from "wouter";
import { MainLayout } from "@/components/layout/MainLayout";
import { Shield, Users, Globe, Award, CheckCircle, ArrowRight } from "lucide-react";

export default function AboutPage() {
  const pillars = [
    { icon: Shield, label: "Verified Sellers", desc: "Every seller is reviewed and credentialed before listing parts" },
    { icon: CheckCircle, label: "Traceable Parts", desc: "Full documentation chain required on every listing" },
    { icon: Globe, label: "Global Reach", desc: "Connect with buyers and sellers across 50+ countries" },
    { icon: Users, label: "Community First", desc: "Built with feedback from MRO professionals and operators" },
  ];

  const steps = [
    { step: "01", title: "Seller Verification", desc: "Sellers apply with their FAA/EASA credentials, business registration, and quality system documents. Our team reviews each application before approving access." },
    { step: "02", title: "List with Documentation", desc: "Approved sellers create listings with part numbers, condition codes, certifications (8130-3, CoC, TRACE), and high-resolution photos." },
    { step: "03", title: "Buy with Confidence", desc: "Buyers browse verified inventory, submit RFQs, and transact knowing every part has traceable documentation backing it." },
  ];

  return (
    <MainLayout>
      <div className="min-h-screen bg-[#0a1628]">

        <section className="py-20 px-4 text-center border-b border-white/10">
          <div className="max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-[#c9a84c]/10 border border-[#c9a84c]/30 rounded-full px-4 py-2 mb-6">
              <Award className="w-4 h-4 text-[#c9a84c]" />
              <span className="text-[#c9a84c] text-sm font-medium">About Our Platform</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
              About <span className="text-[#c9a84c]">Parts Link Aviation</span>
            </h1>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto leading-relaxed">
              The aviation parts marketplace built for transparency, trust, and traceability.
              We connect certified sellers with verified buyers across the global MRO supply chain.
            </p>
          </div>
        </section>

        <section className="py-16 px-4">
          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl font-bold text-white mb-4">Our Mission</h2>
                <p className="text-gray-300 leading-relaxed mb-4">
                  Parts Link Aviation was built to solve a fundamental problem in the aviation
                  parts industry: lack of transparency. Too often, buyers struggle to verify
                  part provenance, seller credentials, and documentation integrity.
                </p>
                <p className="text-gray-300 leading-relaxed mb-6">
                  We built a platform where every listing requires proper certification,
                  every seller undergoes verification, and every transaction is traceable from shelf to aircraft.
                </p>
                <Link href="/marketplace">
                  <a className="inline-flex items-center gap-2 bg-[#c9a84c] text-[#0a1628] font-semibold px-6 py-3 rounded-lg hover:bg-[#b8973b] transition-colors">
                    Explore the Marketplace
                    <ArrowRight className="w-4 h-4" />
                  </a>
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {pillars.map(({ icon: Icon, label, desc }) => (
                  <div key={label} className="bg-white/5 border border-white/10 rounded-xl p-4">
                    <Icon className="w-6 h-6 text-[#c9a84c] mb-2" />
                    <h3 className="text-white font-semibold text-sm mb-1">{label}</h3>
                    <p className="text-gray-400 text-xs leading-relaxed">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 px-4 border-y border-white/10" style={{ backgroundColor: "rgba(255,255,255,0.02)" }}>
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-white mb-4">How It Works</h2>
              <p className="text-gray-400 max-w-xl mx-auto">
                A simple, secure process that puts documentation and compliance first.
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              {steps.map(({ step, title, desc }) => (
                <div key={step}>
                  <div className="text-5xl font-bold mb-3" style={{ color: "rgba(201,168,76,0.25)" }}>{step}</div>
                  <h3 className="text-xl font-bold text-white mb-3">{title}</h3>
                  <p className="text-gray-400 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16 px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-white mb-4">Have Questions?</h2>
            <p className="text-gray-400 mb-8">
              Our team is here to help — whether you are a seller looking to list inventory
              or a buyer searching for hard-to-find parts.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/contact">
                <a className="inline-flex items-center gap-2 bg-[#c9a84c] text-[#0a1628] font-semibold px-8 py-3 rounded-lg hover:bg-[#b8973b] transition-colors">
                  Contact Support
                  <ArrowRight className="w-4 h-4" />
                </a>
              </Link>
              <Link href="/marketplace">
                <a className="inline-flex items-center gap-2 border border-white/20 text-white px-8 py-3 rounded-lg hover:border-[#c9a84c] hover:text-[#c9a84c] transition-colors">
                  Browse Marketplace
                </a>
              </Link>
            </div>
          </div>
        </section>

      </div>
    </MainLayout>
  );
}
