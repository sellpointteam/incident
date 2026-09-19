import { Link, useLocation } from "react-router-dom";
import {
  Map, Lock, LogOut, Skull, Info, BookOpen, ShieldAlert,
  ChevronDown, LineChart, User, Wrench, Sparkles, FileText, Globe2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import logo from "@/assets/logo.jpg";

export default function AppHeader() {
  const { pathname } = useLocation();
  const { user, isAdmin, isMilitantAdmin, signOut } = useAuth();

  const navItems = [
    { to: "/", label: "Live Map", icon: Map },
    { to: "/analytics", label: "Analytics", icon: LineChart },
    { to: "/blog", label: "Blog", icon: BookOpen },
    { to: "/about", label: "About", icon: Info },
  ];

  const isActive = (to: string) => (to === "/" ? pathname === "/" : pathname.startsWith(to));

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/85 backdrop-blur-md">
      <div className="flex h-14 items-center justify-between gap-4 px-4 lg:px-6">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2.5 shrink-0 group">
          <img src={logo} alt="Pakistan Casualty Tracker" className="h-9 w-9 rounded-md object-cover ring-1 ring-border" />
          <div className="hidden md:block leading-tight">
            <p className="font-display text-sm font-bold tracking-wide text-foreground">Pakistan Casualty Tracker</p>
            <p className="text-[10px] text-muted-foreground">OSINT Intelligence Platform</p>
          </div>
        </Link>

        {/* Nav */}
        <nav className="hidden lg:flex items-center gap-0.5 mx-auto">
          {navItems.map(({ to, label, icon: Icon }) => {
            const active = isActive(to);
            return (
              <Link key={to} to={to}>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`gap-1.5 text-sm h-9 px-3 font-medium transition-colors ${
                    active
                      ? "text-primary bg-primary/10"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Button>
              </Link>
            );
          })}
        </nav>

        {/* Mobile nav */}
        <nav className="flex lg:hidden items-center gap-0.5">
          {navItems.slice(0, 5).map(({ to, icon: Icon, label }) => (
            <Link key={to} to={to}>
              <Button variant="ghost" size="icon" className={`h-8 w-8 ${isActive(to) ? "text-primary" : "text-muted-foreground"}`} aria-label={label}>
                <Icon className="h-4 w-4" />
              </Button>
            </Link>
          ))}
        </nav>

        {/* Right */}
        <div className="flex items-center gap-2 shrink-0">
          {isMilitantAdmin && !isAdmin && (
            <Link to="/admin/militant">
              <Button
                size="sm"
                className="gap-1.5 text-sm h-9 bg-danger text-danger-foreground hover:bg-danger/90 shadow-lg shadow-danger/30 font-semibold"
              >
                <Skull className="h-4 w-4" />
                <span>Militant Incident Panel</span>
              </Button>
            </Link>
          )}

          {isAdmin && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 text-sm h-9 border-primary/30 text-primary hover:bg-primary/10">
                  <Wrench className="h-4 w-4" />
                  <span className="hidden sm:inline">Admin</span>
                  <ChevronDown className="h-3 w-3 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">Operations</DropdownMenuLabel>
                <DropdownMenuItem asChild>
                  <Link to="/admin" className="gap-2 text-sm">
                    <Wrench className="h-4 w-4 text-primary" />
                    Incident Entry
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">Manage</DropdownMenuLabel>
                <DropdownMenuItem asChild>
                  <Link to="/admin/blog" className="gap-2 text-sm"><FileText className="h-4 w-4" /> Blog Posts</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/incidents/full" className="gap-2 text-sm"><ShieldAlert className="h-4 w-4" /> Incidents (full table)</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/admin/integrity" className="gap-2 text-sm"><ShieldAlert className="h-4 w-4" /> Data Integrity</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/admin/settings" className="gap-2 text-sm"><Wrench className="h-4 w-4" /> Site Settings</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}


          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Account menu" className="h-9 w-9 rounded-full bg-secondary/60 hover:bg-secondary border border-border">
                  <User className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">{user.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut} className="gap-2 text-sm text-destructive focus:text-destructive">
                  <LogOut className="h-4 w-4" /> Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link to="/login">
              <Button variant="ghost" size="sm" className="gap-1.5 text-sm h-9">
                <Lock className="h-4 w-4" />
                Login
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
