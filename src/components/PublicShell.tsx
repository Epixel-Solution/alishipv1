import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Logo } from "@/components/Logo";
import { ALISHIP_CONTACT } from "@/lib/contact";
import { Phone, Mail } from "lucide-react";

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 border-b border-zinc-800 bg-zinc-950 text-zinc-50">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <Logo size="sm" variant="light" />
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <Link to="/" className="rounded-md px-3 py-1.5 text-zinc-300 hover:bg-zinc-900 hover:text-white">Home</Link>
            <Link to="/about" className="rounded-md px-3 py-1.5 text-zinc-300 hover:bg-zinc-900 hover:text-white">About</Link>
            <Link to="/track" className="rounded-md px-3 py-1.5 text-zinc-300 hover:bg-zinc-900 hover:text-white">Track</Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-zinc-800 bg-zinc-950 text-zinc-300">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:grid-cols-3">
          <div>
            <Logo size="sm" variant="light" />
            <p className="mt-2 max-w-xs text-sm text-zinc-400">
              Aliship Logistics — Sorted. Shipped. Simple. Reliable parcel delivery and tracking across Kenya.
            </p>
          </div>
          <div className="text-sm">
            <h4 className="mb-2 font-semibold text-white">Company</h4>
            <ul className="space-y-1.5 text-zinc-400">
              <li><Link to="/about" className="hover:text-primary">About us</Link></li>
              <li><Link to="/track" className="hover:text-primary">Track a parcel</Link></li>
            </ul>
          </div>
          <div className="text-sm">
            <h4 className="mb-2 font-semibold text-white">Contact</h4>
            <ul className="space-y-1.5 text-zinc-400">
              <li className="inline-flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-primary" />
                <a href={`tel:${ALISHIP_CONTACT.phones[0].replace(/\s/g, "")}`} className="hover:text-primary">{ALISHIP_CONTACT.phones[0]}</a>
                <span className="opacity-50">/</span>
                <a href={`tel:${ALISHIP_CONTACT.phones[1].replace(/\s/g, "")}`} className="hover:text-primary">{ALISHIP_CONTACT.phones[1]}</a>
              </li>
              <li className="inline-flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-primary" />
                <a href={`mailto:${ALISHIP_CONTACT.email}`} className="hover:text-primary">{ALISHIP_CONTACT.email}</a>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-zinc-900 px-4 py-3 text-center text-xs text-zinc-500 flex flex-wrap items-center justify-center gap-2">
          <span>© {new Date().getFullYear()} Aliship Logistics. All rights reserved.</span>
          <span className="opacity-50">·</span>
          <span>
            Developed by{" "}
            <a href="https://epixelcreatives.com" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">
              Epixel Professional Solutions
            </a>
          </span>
          <span className="opacity-50">·</span>
          <Link to="/login" className="hover:text-primary transition-colors">Staff login</Link>
        </div>
      </footer>
    </div>
  );
}