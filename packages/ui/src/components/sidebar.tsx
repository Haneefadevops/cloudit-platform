import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../lib/utils.js";
import { Button } from "./button.js";

export interface SidebarNavItem {
  label: string;
  href?: string;
  icon?: React.ReactNode;
  active?: boolean;
  children?: SidebarNavItem[];
}

export interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  logo?: React.ReactNode;
  userProfile?: React.ReactNode;
  items: SidebarNavItem[];
  collapsed?: boolean;
  onCollapse?: (collapsed: boolean) => void;
  footer?: React.ReactNode;
}

function Sidebar({
  className,
  logo,
  userProfile,
  items,
  collapsed = false,
  onCollapse,
  footer,
  ...props
}: SidebarProps) {
  const [internalCollapsed, setInternalCollapsed] = React.useState(collapsed);
  const isCollapsed = onCollapse ? collapsed : internalCollapsed;

  const toggle = () => {
    const next = !isCollapsed;
    if (onCollapse) {
      onCollapse(next);
    } else {
      setInternalCollapsed(next);
    }
  };

  return (
    <aside
      className={cn(
        "flex h-screen flex-col border-r bg-background transition-all duration-300",
        isCollapsed ? "w-16" : "w-64",
        className
      )}
      {...props}
    >
      <div className="flex h-14 items-center justify-between border-b px-3">
        {!isCollapsed && <div className="truncate">{logo}</div>}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggle}
          className="shrink-0"
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        <ul className="space-y-1 px-2">
          {items.map((item, idx) => (
            <SidebarItem
              key={idx}
              item={item}
              collapsed={isCollapsed}
              depth={0}
            />
          ))}
        </ul>
      </nav>

      {userProfile && (
        <div className="border-t p-3">{userProfile}</div>
      )}
      {footer && <div className="border-t p-3 text-xs text-muted-foreground">{footer}</div>}
    </aside>
  );
}

interface SidebarItemProps {
  item: SidebarNavItem;
  collapsed: boolean;
  depth: number;
}

function SidebarItem({ item, collapsed, depth }: SidebarItemProps) {
  const [open, setOpen] = React.useState(false);
  const hasChildren = item.children && item.children.length > 0;

  const content = (
    <div
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        item.active
          ? "bg-primary text-primary-foreground"
          : "text-foreground hover:bg-accent hover:text-accent-foreground",
        collapsed && "justify-center px-2"
      )}
      style={{ paddingLeft: collapsed ? undefined : `${0.75 + depth * 0.75}rem` }}
    >
      {item.icon && <span className="shrink-0">{item.icon}</span>}
      {!collapsed && <span className="truncate">{item.label}</span>}
    </div>
  );

  return (
    <li>
      {item.href ? (
        <a href={item.href}>{content}</a>
      ) : (
        <button
          onClick={() => hasChildren && setOpen(!open)}
          className="w-full"
          type="button"
        >
          {content}
        </button>
      )}
      {hasChildren && open && !collapsed && (
        <ul className="mt-1 space-y-1">
          {item.children!.map((child, idx) => (
            <SidebarItem key={idx} item={child} collapsed={collapsed} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

export { Sidebar };
