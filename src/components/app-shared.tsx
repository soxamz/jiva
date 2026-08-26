import type { ReactNode } from 'react';
import {
  ActivityIcon,
  AmbulanceIcon,
  ClipboardListIcon,
  FileTextIcon,
  HistoryIcon,
  HeartPulseIcon,
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

type Translate = (key: string) => string;

function patientGroups(t: Translate): SidebarNavGroup[] {
  return [
    {
      label: t('nav.healthRecord'),
      items: [
        { title: t('nav.dashboard'), path: '/dashboard', icon: <LayoutDashboardIcon /> },
        { title: t('nav.timeline'), path: '/timeline', icon: <ActivityIcon /> },
        { title: t('nav.documents'), path: '/documents', icon: <FileTextIcon /> },
        {
          title: t('nav.healthInformation'),
          path: '/health-information',
          icon: <HeartPulseIcon />,
        },
      ],
    },
    {
      label: t('nav.care'),
      items: [
        { title: t('nav.intake'), path: '/intake', icon: <ClipboardListIcon /> },
        { title: t('nav.shareAccess'), path: '/share', icon: <QrCodeIcon /> },
        { title: t('nav.accessLog'), path: '/access-log', icon: <HistoryIcon /> },
      ],
    },
    {
      label: t('nav.safety'),
      items: [
        { title: t('nav.emergencyCard'), path: '/emergency-card', icon: <ShieldCheckIcon /> },
      ],
    },
  ];
}

function clinicalGroups(t: Translate): SidebarNavGroup[] {
  return [
    {
      label: t('nav.clinicalWorkspace'),
      items: [{ title: t('nav.doctorPortal'), path: '/doctor', icon: <StethoscopeIcon /> }],
    },
    {
      label: t('nav.emergency'),
      items: [{ title: t('nav.breakGlass'), path: '/emergency', icon: <AmbulanceIcon /> }],
    },
  ];
}

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

export function getNavGroups(role: AppShellUser['role'], pathname: string, t: Translate) {
  return withActiveState(role === 'patient' ? patientGroups(t) : clinicalGroups(t), pathname);
}

export function getFooterNavLinks(
  role: AppShellUser['role'],
  pathname: string,
  t: Translate
): SidebarNavItem[] {
  const item =
    role === 'patient'
      ? { title: t('nav.emergencyAccess'), path: '/emergency', icon: <AmbulanceIcon /> }
      : { title: t('nav.patientDashboard'), path: '/dashboard', icon: <LifeBuoyIcon /> };

  return [{ ...item, isActive: matchesRoute(pathname, item.path) }];
}
