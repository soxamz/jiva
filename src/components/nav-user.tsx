'use client';

import Link from 'next/link';
import { LogOutIcon, UserRoundIcon } from 'lucide-react';

import type { AppShellUser } from '@/components/app-shared';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type NavUserProps = {
  user: AppShellUser;
  signOutAction: (formData: FormData) => void | Promise<void>;
};

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

export function NavUser({ user, signOutAction }: NavUserProps) {
  const workspaceHref = user.role === 'patient' ? '/dashboard' : '/doctor';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label="Open account menu" render={<Avatar className="size-8" />}>
        <AvatarFallback>{initials(user.name)}</AvatarFallback>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="flex items-center gap-3">
          <Avatar className="size-10">
            <AvatarFallback>{initials(user.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <span className="text-foreground block truncate font-medium">{user.name}</span>
            <span className="text-muted-foreground block truncate text-xs">
              {user.role} - {user.phoneMasked}
            </span>
          </div>
        </DropdownMenuLabel>
        {user.doctorId && (
          <p className="text-muted-foreground px-3 pb-2 text-xs">{user.doctorId}</p>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem render={<Link href={workspaceHref} />}>
            <UserRoundIcon />
            Workspace home
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <form action={signOutAction}>
            <DropdownMenuItem render={<button type="submit" />} variant="destructive">
              <LogOutIcon />
              Sign out
            </DropdownMenuItem>
          </form>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
