import { LayoutDashboard, Key, Bot, Settings, MessageSquare } from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/providers", icon: Key, label: "Providers" },
  { to: "/agents", icon: Bot, label: "Agents" },
  { to: "/channels", icon: MessageSquare, label: "Channels" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

export function Sidebar() {
  return (
    <aside className="fixed left-0 top-14 z-40 h-[calc(100vh-3.5rem)] w-56 border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
      <nav className="space-y-1 p-4">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary-50 text-primary-600 dark:bg-primary-950 dark:text-primary-400"
                  : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800",
              )
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
