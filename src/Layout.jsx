import React from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { 
  LayoutDashboard, 
  Users, 
  Award, 
  GraduationCap,
  Package,
  Calendar,
  DollarSign,
  FileText,
  CreditCard,
  ShieldCheck,
  Boxes,
  BarChart3,
  HeartPulse,
  Bell
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

const navigationItems = [
  {
    title: "Dashboard",
    url: createPageUrl("Dashboard"),
    icon: LayoutDashboard,
  },
  {
    title: "Providers",
    url: createPageUrl("Providers"),
    icon: Users,
  },
  {
    title: "Clinical Privileges",
    url: createPageUrl("ClinicalPrivileges"),
    icon: Award,
  },
  {
    title: "CME Tracking",
    url: createPageUrl("CMETracking"),
    icon: GraduationCap,
  },
  {
    title: "Licenses",
    url: createPageUrl("Licenses"),
    icon: ShieldCheck,
  },
  {
    title: "Time Off & CME",
    url: createPageUrl("ProviderTimeOff"),
    icon: Calendar,
  },
  {
    title: "Supply Catalog",
    url: createPageUrl("Supplies"),
    icon: Boxes,
  },
  {
    title: "Supply Orders",
    url: createPageUrl("SupplyOrders"),
    icon: Package,
  },
  {
    title: "On-Call Schedule",
    url: createPageUrl("OnCallSchedule"),
    icon: Calendar,
  },
  {
    title: "Outside Income",
    url: createPageUrl("OutsideIncome"),
    icon: DollarSign,
  },
  {
    title: "Invoices",
    url: createPageUrl("Invoices"),
    icon: FileText,
  },
  {
    title: "Payments",
    url: createPageUrl("Payments"),
    icon: CreditCard,
  },
  {
    title: "Reminders",
    url: createPageUrl("Reminders"),
    icon: Calendar,
  },
  {
    title: "Reports",
    url: createPageUrl("Reports"),
    icon: BarChart3,
  },
];

export default function Layout({ children, currentPageName }) {
  const location = useLocation();

  const { data: pendingOrders = [] } = useQuery({
    queryKey: ['pending-review-orders'],
    queryFn: async () => {
      const orders = await base44.entities.SupplyOrder.filter({ status: 'pending_review' });
      return orders;
    },
    refetchInterval: 30000 // Refetch every 30 seconds
  });

  // Hide sidebar for public pages
  if (currentPageName === 'PublicSupplyRequest') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        {children}
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <style>{`
          :root {
            --primary: 217 91% 35%;
            --primary-foreground: 0 0% 100%;
            --background: 210 20% 98%;
            --card: 0 0% 100%;
            --card-foreground: 222.2 47.4% 11.2%;
            --muted: 214 32% 95%;
            --muted-foreground: 215 16% 47%;
            --accent: 210 40% 96%;
            --accent-foreground: 222.2 47.4% 11.2%;
          }
          
          .sidebar-menu-item:hover {
            background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(99, 102, 241, 0.1) 100%);
          }
          
          .sidebar-menu-item-active {
            background: linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(99, 102, 241, 0.15) 100%);
            border-left: 3px solid #3b82f6;
          }
        `}</style>
        
        <Sidebar className="border-r border-slate-200/60 bg-white/80 backdrop-blur-sm">
          <SidebarHeader className="border-b border-slate-200/60 p-6 bg-gradient-to-br from-blue-50 to-indigo-50">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                  <HeartPulse className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-900 text-lg">ENTIC Operations Center</h2>
                  <p className="text-xs text-slate-600">Provider Management</p>
                </div>
              </div>
              <Link 
                to={createPageUrl("SupplyOrders")}
                className="relative p-2 hover:bg-white/50 rounded-lg transition-colors"
              >
                <Bell className="w-5 h-5 text-slate-600" />
                {pendingOrders.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                    {pendingOrders.length}
                  </span>
                )}
              </Link>
            </div>
          </SidebarHeader>
          
          <SidebarContent className="p-3 bg-white/50">
            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-semibold text-slate-600 uppercase tracking-wider px-3 py-2">
                Navigation
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navigationItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton 
                        asChild 
                        className={`sidebar-menu-item transition-all duration-200 rounded-lg mb-1 ${
                          location.pathname === item.url ? 'sidebar-menu-item-active text-blue-700 font-medium' : 'text-slate-700'
                        }`}
                      >
                        <Link to={item.url} className="flex items-center gap-3 px-3 py-2.5">
                          <item.icon className="w-4 h-4" />
                          <span className="text-sm">{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        <main className="flex-1 flex flex-col">
          <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200/60 px-6 py-4 md:hidden shadow-sm">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="hover:bg-slate-100 p-2 rounded-lg transition-colors duration-200" />
              <h1 className="text-xl font-semibold text-slate-900">ENTIC Operations Center</h1>
            </div>
          </header>

          <div className="flex-1 overflow-auto">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}