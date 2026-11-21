"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Home,
  LayoutDashboard,
  Link2,
  Share2,
  Crown,
  History,
  Receipt,
  LogOut,
  ArrowRight,
  Zap,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { beginNavigationLoading } from "@/lib/api-loading-store";
import {
  markOnboardingComplete,
  DASHBOARD_CHANNEL_PATH,
  DASHBOARD_PLATFORM_PATH,
} from "@/lib/onboarding";
import {
  getUserAvatarFallback,
  getUserAvatarImageUrl,
  isEmojiAvatar,
} from "@/lib/user-avatar";
import { cn } from "@/lib/utils";

type UserMenuProps = {
  email?: string | null;
  phone?: string | null;
  fullName?: string | null;
  avatarUrl?: string | null;
  /** Subscription tier, e.g. "free" or "creator". */
  plan?: string;
  /** Live balance on app pages; the credits row is hidden when unknown. */
  credits?: number;
};

function MenuLink({
  href,
  icon: Icon,
  children,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <DropdownMenuItem asChild className={itemClass}>
      <Link href={href} onClick={() => beginNavigationLoading()}>
        <Icon className={iconClass} />
        {children}
      </Link>
    </DropdownMenuItem>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <DropdownMenuLabel className="px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#64748B]">
      {children}
    </DropdownMenuLabel>
  );
}

const itemClass =
  "group flex h-9 cursor-pointer items-center gap-3 rounded-lg px-2.5 text-sm font-medium text-[#cbd5e1] outline-none transition-colors focus:bg-[#19251F] focus:text-[#F8FAFC] data-[highlighted]:bg-[#19251F] data-[highlighted]:text-[#F8FAFC]";
const iconClass =
  "h-4 w-4 shrink-0 text-[#64748B] transition-colors group-data-[highlighted]:text-[#54D045] group-focus:text-[#54D045]";

export function UserMenu({ email, phone, fullName, avatarUrl, plan, credits }: UserMenuProps) {
  const router = useRouter();
  const avatarFallback = getUserAvatarFallback({ email, phone, fullName, avatarUrl });
  const avatarImageUrl = getUserAvatarImageUrl(avatarUrl);
  const name = fullName?.trim() || email?.split("@")[0] || phone || "Your account";
  const tier = (plan || "free").toLowerCase();
  const planLabel = `${tier.charAt(0).toUpperCase()}${tier.slice(1)} Plan`;
  const paid = tier !== "free" && tier !== "starter";

  async function signOut() {
    beginNavigationLoading();
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Couldn't sign you out. Please try again.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  function goDashboard() {
    beginNavigationLoading();
    markOnboardingComplete();
    router.push("/dashboard");
  }

  const avatar = (size: string, text: string) => (
    <Avatar className={size}>
      {avatarImageUrl && <AvatarImage src={avatarImageUrl} alt="" referrerPolicy="no-referrer" />}
      <AvatarFallback className={cn(isEmojiAvatar(avatarFallback) ? "text-lg" : cn(text, "font-semibold"))}>
        {avatarFallback}
      </AvatarFallback>
    </Avatar>
  );

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="group flex items-center rounded-full p-0.5 outline-none transition-colors hover:bg-white/[0.06] focus-visible:ring-2 focus-visible:ring-[#54D045]/60 data-[state=open]:bg-white/[0.08]"
          aria-label="Open account menu"
        >
          <span className="rounded-full ring-1 ring-[#253244] transition-shadow group-hover:ring-[#54D045]/50 group-data-[state=open]:ring-[#54D045]/70">
            {avatar("h-8 w-8", "text-xs")}
          </span>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={14}
        collisionPadding={12}
        className="z-[130] max-h-[80vh] w-[min(300px,calc(100vw-24px))] overflow-y-auto rounded-2xl border border-[#253244] bg-[#101824] p-1.5 text-[#F8FAFC] shadow-[0_24px_60px_-16px_rgba(0,0,0,0.9),0_0_0_1px_rgba(84,208,69,0.04)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-2"
      >
        {/* Identity */}
        <div className="relative overflow-hidden rounded-xl border border-[#54D045]/15 bg-[#14271F] p-3">
          <div className="pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full bg-[#54D045]/20 blur-2xl" aria-hidden />
          <div className="relative flex items-center gap-3">
            <span className="rounded-full ring-1 ring-[#54D045]/30">{avatar("h-10 w-10", "text-sm")}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[#F8FAFC]">{name}</p>
            </div>
            <span
              className={cn(
                "shrink-0 self-start rounded-md border px-1.5 py-0.5 text-[10px] font-semibold",
                paid ? "border-[#54D045]/35 bg-[#54D045]/15 text-[#a6ec9c]" : "border-white/10 bg-white/[0.06] text-[#cbd5e1]",
              )}
            >
              {planLabel}
            </span>
          </div>
        </div>

        {/* Credits */}
        {typeof credits === "number" && (
          <div className="mt-1.5 flex items-center justify-between gap-3 rounded-xl border border-[#253244] px-3 py-2.5">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#54D045]/10">
                <Zap className="h-3.5 w-3.5 fill-[#54D045] text-[#54D045]" />
              </span>
              <div className="leading-tight">
                <p className="text-sm font-semibold tabular-nums text-[#F8FAFC]">{credits.toLocaleString()}</p>
                <p className="text-[11px] text-[#94A3B8]">credits available</p>
              </div>
            </div>
            <DropdownMenuItem asChild className="cursor-pointer rounded-md p-0 focus:bg-transparent data-[highlighted]:bg-transparent">
              <Link
                href="/pricing"
                onClick={() => beginNavigationLoading()}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-[#8fe383] hover:bg-[#54D045]/10 focus-visible:bg-[#54D045]/10"
              >
                Get more <ArrowRight className="h-3 w-3" />
              </Link>
            </DropdownMenuItem>
          </div>
        )}

        <GroupLabel>General</GroupLabel>
        <DropdownMenuGroup>
          <MenuLink href="/" icon={Home}>
            Home
          </MenuLink>
          <DropdownMenuItem
            className={itemClass}
            onSelect={(e) => {
              e.preventDefault();
              goDashboard();
            }}
          >
            <LayoutDashboard className={iconClass} />
            Dashboard
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <GroupLabel>Setup</GroupLabel>
        <DropdownMenuGroup>
          <MenuLink href={DASHBOARD_CHANNEL_PATH} icon={Link2}>
            Channel Setup
          </MenuLink>
          <MenuLink href={DASHBOARD_PLATFORM_PATH} icon={Share2}>
            Platform Connections
          </MenuLink>
        </DropdownMenuGroup>

        <GroupLabel>Account &amp; billing</GroupLabel>
        <DropdownMenuGroup>
          <MenuLink href="/subscription" icon={Crown}>
            Subscription
          </MenuLink>
          <MenuLink href="/activity" icon={History}>
            Credit usage history
          </MenuLink>
          <MenuLink href="/transactions" icon={Receipt}>
            Transaction history
          </MenuLink>
        </DropdownMenuGroup>

        <DropdownMenuSeparator className="my-1.5 bg-[#253244]" />
        <DropdownMenuItem
          className="group flex h-9 cursor-pointer items-center gap-3 rounded-lg px-2.5 text-sm font-medium text-[#F87171] outline-none transition-colors focus:bg-[#F87171]/10 data-[highlighted]:bg-[#F87171]/10"
          onSelect={(e) => {
            e.preventDefault();
            void signOut();
          }}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
