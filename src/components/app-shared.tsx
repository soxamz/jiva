import type { ReactNode } from 'react';
import {
  ActivityIcon,
  AmbulanceIcon,
  ClipboardListIcon,
  FileTextIcon,
  HistoryIcon,
  LayoutDashboardIcon,
  LifeBuoyIcon,
  QrCodeIcon,
  ShieldCheckIcon,
  StethoscopeIcon,
} from 'lucide-react';

export type AppShellUser = {
  name: string;
  role: 'patient' | 'doctor' | 'responder' | 'admin';
  phoneMasked: string;
  doctorId: string | null;
};

export type SidebarNavItem = {
  title: string;
  path: string;
  icon: ReactNode;
  isActive?: boolean;
  subItems?: SidebarNavItem[];
};

export type SidebarNavGroup = {
  label?: string;
  items: SidebarNavItem[];
};

const patientGroups: SidebarNavGroup[] = [
  {
    label: 'Health record',
    items: [
      { title: 'Dashboard', path: '/dashboard', icon: <LayoutDashboardIcon /> },
      { title: 'Timeline', path: '/timeline', icon: <ActivityIcon /> },
      { title: 'Documents', path: '/documents', icon: <FileTextIcon /> },
    ],
  },
  {
    label: 'Care',
    items: [
      { title: 'Intake', path: '/intake', icon: <ClipboardListIcon /> },
      { title: 'Share access', path: '/share', icon: <QrCodeIcon /> },
      { title: 'Access log', path: '/access-log', icon: <HistoryIcon /> },
    ],
  },
  {
    label: 'Safety',
    items: [{ title: 'Emergency card', path: '/emergency-card', icon: <ShieldCheckIcon /> }],
  },
];

const clinicalGroups: SidebarNavGroup[] = [
  {
    label: 'Clinical workspace',
    items: [{ title: 'Doctor portal', path: '/doctor', icon: <StethoscopeIcon /> }],
  },
  {
    label: 'Emergency',
    items: [{ title: 'Break-glass access', path: '/emergency', icon: <AmbulanceIcon /> }],
  },
];

function matchesRoute(pathname: string, path: string) {
  return pathname === path || (path !== '/emergency' && pathname.startsWith(`${path}/`));
}

function withActiveState(groups: SidebarNavGroup[], pathname: string): SidebarNavGroup[] {
  return groups.map((group) => ({
    ...group,
    items: group.items.map((item) => ({
      ...item,
      isActive: matchesRoute(pathname, item.path),
      subItems: item.subItems?.map((subItem) => ({
        ...subItem,
        isActive: matchesRoute(pathname, subItem.path),
      })),
    })),
  }));
}

export function getNavGroups(role: AppShellUser['role'], pathname: string) {
  return withActiveState(role === 'patient' ? patientGroups : clinicalGroups, pathname);
}

export function getFooterNavLinks(role: AppShellUser['role'], pathname: string): SidebarNavItem[] {
  const item =
    role === 'patient'
      ? { title: 'Emergency access', path: '/emergency', icon: <AmbulanceIcon /> }
      : { title: 'Patient dashboard', path: '/dashboard', icon: <LifeBuoyIcon /> };

  return [{ ...item, isActive: matchesRoute(pathname, item.path) }];
}
