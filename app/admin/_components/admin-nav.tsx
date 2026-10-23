"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS: { label: string; href: string | null }[] = [
  { label: "總覽", href: "/admin" },
  { label: "回答風格", href: "/admin/style" },
  { label: "模型", href: "/admin/model" },
  { label: "使用者", href: "/admin/users" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="nav">
      {ITEMS.map((item) =>
        item.href ? (
          <Link
            key={item.label}
            href={item.href}
            className={`nav-item ${pathname === item.href ? "active" : ""}`}
          >
            <span>{item.label}</span>
          </Link>
        ) : (
          <div key={item.label} className="nav-item disabled">
            <span>{item.label}</span>
            <span className="tag">即將推出</span>
          </div>
        )
      )}
    </nav>
  );
}
