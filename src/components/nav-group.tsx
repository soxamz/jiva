'use client';

import Link from 'next/link';
import { useState } from 'react';

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar';
import type { SidebarNavGroup, SidebarNavItem } from '@/components/app-shared';
import { ChevronRightIcon } from 'lucide-react';

function NavGroupItem({ item }: { item: SidebarNavItem }) {
  const hasActiveRoute = Boolean(
    item.isActive || item.subItems?.some((subItem) => subItem.isActive)
  );
  const [open, setOpen] = useState(hasActiveRoute);

  return (
    <Collapsible
      className="group/collapsible"
      key={item.title}
      onOpenChange={setOpen}
      open={open}
      render={<SidebarMenuItem />}
    >
      {item.subItems?.length ? (
        <>
          <CollapsibleTrigger render={<SidebarMenuButton isActive={item.isActive} />}>
            {item.icon}
            <span>{item.title}</span>
            <ChevronRightIcon className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenuSub>
              {item.subItems.map((subItem) => (
                <SidebarMenuSubItem key={subItem.title}>
                  <SidebarMenuSubButton
                    isActive={subItem.isActive}
                    render={<Link href={subItem.path} />}
                  >
                    {subItem.icon}
                    <span>{subItem.title}</span>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              ))}
            </SidebarMenuSub>
          </CollapsibleContent>
        </>
      ) : (
        <SidebarMenuButton isActive={item.isActive} render={<Link href={item.path} />}>
          {item.icon}
          <span>{item.title}</span>
        </SidebarMenuButton>
      )}
    </Collapsible>
  );
}

export function NavGroup({ label, items }: SidebarNavGroup) {
  return (
    <SidebarGroup>
      {label && <SidebarGroupLabel>{label}</SidebarGroupLabel>}
      <SidebarMenu>
        {items.map((item) => {
          const isActive = Boolean(
            item.isActive || item.subItems?.some((subItem) => subItem.isActive)
          );

          return <NavGroupItem item={item} key={`${item.title}-${isActive}`} />;
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
