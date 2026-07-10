import {
  ArrowLeftRight,
  ArrowRightLeft,
  BarChart3,
  CalendarCheck,
  ClipboardList,
  CreditCard,
  FileText,
  FileUp,
  HandCoins,
  Handshake,
  Landmark,
  LayoutDashboard,
  Package,
  Receipt,
  RotateCcw,
  Scale,
  ScrollText,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Truck,
  Undo2,
  UserCog,
  UserRound,
  Users,
  Wallet,
  Warehouse,
  type LucideIcon,
} from 'lucide-react';
import type { Role } from '@/api/auth';

export interface MenuItem {
  labelKey: string;
  path: string;
  icon: LucideIcon;
  roles: Role[];
  /** Development stage (TZ section 10) in which the page is implemented. */
  stage: number;
}

export interface MenuSection {
  labelKey?: string;
  items: MenuItem[];
}

// Access follows the rights matrix in TZ section 2.1.
export const MENU: MenuSection[] = [
  {
    items: [
      {
        labelKey: 'menu.dashboard',
        path: '/',
        icon: LayoutDashboard,
        roles: ['admin'],
        stage: 5,
      },
    ],
  },
  {
    labelKey: 'menu.sales',
    items: [
      { labelKey: 'menu.customers', path: '/customers', icon: Users, roles: ['admin', 'sales'], stage: 2 },
      { labelKey: 'menu.deals', path: '/deals', icon: Handshake, roles: ['admin', 'sales'], stage: 2 },
      { labelKey: 'menu.orders', path: '/orders', icon: ShoppingCart, roles: ['admin', 'sales'], stage: 2 },
      { labelKey: 'menu.salesReturns', path: '/returns/sales', icon: Undo2, roles: ['admin', 'sales'], stage: 2 },
    ],
  },
  {
    labelKey: 'menu.warehouseSection',
    items: [
      { labelKey: 'menu.products', path: '/products', icon: Package, roles: ['admin', 'warehouse', 'sales'], stage: 1 },
      { labelKey: 'menu.warehouses', path: '/warehouses', icon: Warehouse, roles: ['admin', 'warehouse'], stage: 1 },
      { labelKey: 'menu.suppliers', path: '/suppliers', icon: Truck, roles: ['admin', 'warehouse'], stage: 1 },
      { labelKey: 'menu.purchases', path: '/purchases', icon: ShoppingBag, roles: ['admin', 'warehouse'], stage: 1 },
      { labelKey: 'menu.purchaseReturns', path: '/returns/purchases', icon: RotateCcw, roles: ['admin', 'warehouse'], stage: 1 },
      { labelKey: 'menu.stockTransfers', path: '/stock/transfers', icon: ArrowLeftRight, roles: ['admin', 'warehouse'], stage: 1 },
      { labelKey: 'menu.stockCounts', path: '/stock/counts', icon: ClipboardList, roles: ['admin', 'warehouse'], stage: 1 },
    ],
  },
  {
    labelKey: 'menu.financeSection',
    items: [
      { labelKey: 'menu.transactions', path: '/finance/transactions', icon: Receipt, roles: ['admin', 'accountant'], stage: 3 },
      { labelKey: 'menu.payments', path: '/finance/payments', icon: CreditCard, roles: ['admin', 'accountant'], stage: 3 },
      { labelKey: 'menu.debts', path: '/finance/debts', icon: Scale, roles: ['admin', 'accountant'], stage: 3 },
      { labelKey: 'menu.accounts', path: '/finance/accounts', icon: Landmark, roles: ['admin', 'accountant'], stage: 3 },
      { labelKey: 'menu.invoices', path: '/finance/invoices', icon: FileText, roles: ['admin', 'accountant'], stage: 3 },
      { labelKey: 'menu.moneyTransfers', path: '/finance/transfers', icon: ArrowRightLeft, roles: ['admin', 'accountant'], stage: 3 },
    ],
  },
  {
    labelKey: 'menu.hrSection',
    items: [
      { labelKey: 'menu.employees', path: '/employees', icon: UserRound, roles: ['admin', 'hr'], stage: 4 },
      { labelKey: 'menu.attendance', path: '/attendance', icon: CalendarCheck, roles: ['admin', 'hr'], stage: 4 },
      { labelKey: 'menu.advances', path: '/advances', icon: HandCoins, roles: ['admin', 'hr'], stage: 4 },
      { labelKey: 'menu.payroll', path: '/payroll', icon: Wallet, roles: ['admin', 'hr'], stage: 4 },
    ],
  },
  {
    labelKey: 'menu.systemSection',
    items: [
      { labelKey: 'menu.reports', path: '/reports', icon: BarChart3, roles: ['admin', 'accountant', 'warehouse', 'sales', 'hr'], stage: 5 },
      { labelKey: 'menu.imports', path: '/imports', icon: FileUp, roles: ['admin', 'warehouse', 'sales'], stage: 1 },
      { labelKey: 'menu.users', path: '/users', icon: UserCog, roles: ['admin'], stage: 5 },
      { labelKey: 'menu.settings', path: '/settings', icon: Settings, roles: ['admin'], stage: 3 },
      { labelKey: 'menu.audit', path: '/audit', icon: ScrollText, roles: ['admin'], stage: 5 },
    ],
  },
];

export function visibleSections(role: Role): MenuSection[] {
  return MENU.map((section) => ({
    ...section,
    items: section.items.filter((item) => item.roles.includes(role)),
  })).filter((section) => section.items.length > 0);
}

export function allMenuItems(): MenuItem[] {
  return MENU.flatMap((s) => s.items);
}

export function firstAllowedPath(role: Role): string {
  const item = allMenuItems().find((i) => i.roles.includes(role));
  return item?.path ?? '/login';
}
