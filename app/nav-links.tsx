"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/",        label: "Dashboard"    },
  { href: "/papers",  label: "Papers"       },
  { href: "/topics",  label: "Topics"       },
  { href: "/resources",label: "Resources"   },
  { href: "/review",  label: "Review Queue" },
  { href: "/settings",label: "Settings"     },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-6 text-sm text-zinc-500">
      {links.map(({ href, label }) => {
        const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={
              isActive
                ? "text-zinc-900 font-medium"
                : "hover:text-zinc-900 transition-colors"
            }
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
