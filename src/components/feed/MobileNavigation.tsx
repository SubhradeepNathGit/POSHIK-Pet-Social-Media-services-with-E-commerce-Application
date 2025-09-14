'use client';

import Link from 'next/link';
import { 
  IconHome, 
  IconCompass, 
  IconPlus, 
  IconHeart, 
  IconUser, 
  IconShoppingBag, 
  IconPackage,
  IconCalendar,
  IconUsers,
  IconChart,
  IconShield,
  IconBell
} from './FeedIcons';

type Role = 'admin' | 'vet' | 'user' | 'none' | 'loading';

type SidebarItem = {
  label: string;
  href?: string;
  onClick?: () => void;
  badge?: number;
  icon?: React.ReactNode;
};

interface MobileNavigationProps {
  role: Role;
  notiCount: number;
  loadMyPets: () => void;
}

export function MobileNavigation({ role, notiCount, loadMyPets }: MobileNavigationProps) {
  const getSidebarItems = (r: Role, count: number): SidebarItem[] => {
    const baseItems = {
      vet: [
        { label: 'Dashboard', href: '/dashboard', icon: <IconHome /> },
        { label: 'Appointments', href: '/appointments', icon: <IconCalendar /> },
        { label: 'Patients', href: '/patients', icon: <IconUsers /> },
        { label: 'Profile', href: '/settings/profile', icon: <IconUser /> },
        { label: 'Notifications', href: '/notifications', badge: count, icon: <IconBell /> },
      ],
      admin: [
        { label: 'Dashboard', href: '/admin', icon: <IconHome /> },
        { label: 'Analytics', href: '/admin/analytics', icon: <IconChart /> },
        { label: 'KYC Review', href: '/admin/kyc', icon: <IconShield /> },
        { label: 'Products', href: '/admin/products', icon: <IconPackage /> },
        { label: 'Orders', href: '/admin/orders', icon: <IconShoppingBag /> },
        { label: 'Profile', href: '/settings/profile', icon: <IconUser /> },
      ],
      user: [
        { label: 'Home', href: '/feed', icon: <IconHome /> },
        { label: 'Discover', href: '/discover', icon: <IconCompass /> },
        { label: 'Create', href: '/create', icon: <IconPlus /> },
        { label: 'My Pets', onClick: loadMyPets, icon: <IconHeart /> },
        { label: 'Profile', href: '/settings/profile', icon: <IconUser /> },
        { label: 'Cart', href: '/cart', icon: <IconShoppingBag /> },
        { label: 'Orders', href: '/orders', icon: <IconPackage /> },
      ],
    } as const;

    if (r === 'vet') return baseItems.vet.slice();
    if (r === 'admin') return baseItems.admin.slice();
    return baseItems.user.slice();
  };

  const sidebarItems = getSidebarItems(role, notiCount);

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40">
      <div className="backdrop-blur-xl bg-white/95 shadow-lg border-t border-gray-200 px-2 sm:px-4 py-2">
        <div className="flex justify-around">
          {sidebarItems.slice(0, 5).map((item, i) => (
            item.href ? (
              <Link
                key={i}
                href={item.href}
                className="flex flex-col items-center py-2 px-3 text-[11px] sm:text-xs font-medium text-gray-600 hover:text-[#FF8A65] transition-colors relative"
              >
                {item.icon}
                <span className="mt-1 truncate max-w-12">{item.label}</span>
                {item.badge && item.badge > 0 && (
                  <span className="absolute -top-1 -right-1 bg-[#FF8A65] text-white text-[10px] rounded-full h-5 w-5 flex items-center justify-center font-semibold">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </Link>
            ) : (
              <button
                key={i}
                onClick={item.onClick}
                className="flex flex-col items-center py-2 px-3 text-[11px] sm:text-xs font-medium text-gray-600 hover:text-[#FF8A65] transition-colors relative"
              >
                {item.icon}
                <span className="mt-1 truncate max-w-12">{item.label}</span>
                {item.badge && item.badge > 0 && (
                  <span className="absolute -top-1 -right-1 bg-[#FF8A65] text-white text-[10px] rounded-full h-5 w-5 flex items-center justify-center font-semibold">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </button>
            )
          ))}
        </div>
      </div>
    </div>
  );
}






