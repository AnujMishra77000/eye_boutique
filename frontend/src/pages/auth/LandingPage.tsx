import { ArrowRight, ShieldCheck, UserPlus, Users } from "lucide-react";
import { Link } from "react-router-dom";

const actions = [
  {
    title: "Admin Registration",
    description: "Create and configure a new admin account for platform control.",
    to: "/admin-register",
    cta: "Register Admin",
    icon: UserPlus
  },
  {
    title: "Login as Staff",
    description: "Secure staff access for customer, prescription, billing, and operations workflows.",
    to: "/login/staff",
    cta: "Staff Login",
    icon: Users
  },
  {
    title: "Login as Admin",
    description: "Full-access admin login to manage staff, campaigns, settings, and analytics.",
    to: "/login/admin",
    cta: "Admin Login",
    icon: ShieldCheck
  }
];

export function LandingPage() {
  return (
    <div className="min-h-screen bg-matte-gradient px-4 py-8 text-slate-100 sm:px-6 sm:py-12 lg:px-10 lg:py-16">
      <div className="mx-auto w-full max-w-6xl">
        <header className="mb-8 text-center sm:mb-12">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl lg:text-4xl">
            Welcome to Aadarsh Eye Boutique CRM Center
          </h1>
          <p className="mx-auto mt-3 max-w-3xl text-sm text-slate-200/90 sm:text-base">
            Choose your access path to continue into the CRM platform.
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {actions.map((item) => (
            <Link
              key={item.title}
              to={item.to}
              className="group rounded-2xl border border-pink-300/30 bg-matte-850/90 p-5 shadow-neon-ring transition hover:-translate-y-0.5 hover:border-pink-200/55 hover:shadow-neon-glow"
            >
              <div className="mb-4 inline-flex rounded-lg border border-pink-300/35 bg-pink-300/10 p-2 text-pink-100">
                <item.icon size={18} />
              </div>

              <h2 className="text-lg font-semibold text-slate-50">{item.title}</h2>
              <p className="mt-2 text-sm text-slate-200/90">{item.description}</p>

              <div className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-pink-100">
                <span>{item.cta}</span>
                <ArrowRight size={15} className="transition group-hover:translate-x-0.5" />
              </div>
            </Link>
          ))}
        </section>
      </div>
    </div>
  );
}
