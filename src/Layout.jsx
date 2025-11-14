import React from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
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
  BarChart3
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

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-slate-50">
        <style>{`
          :root {
            --primary: 217 91% 35%;
            --primary-foreground: 0 0% 100%;
          }
        `}</style>
        
        <Sidebar className="border-r border-slate-200">
          <SidebarHeader className="border-b border-slate-200 p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-lg">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-slate-900 text-lg">ENTIC Operations Center</h2>
                <p className="text-xs text-slate-500">Provider Management</p>
              </div>
            </div>
          </SidebarHeader>
          
          <SidebarContent className="p-3">
            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-2">
                Navigation
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navigationItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton 
                        asChild 
                        className={`hover:bg-blue-50 hover:text-blue-700 transition-all duration-200 rounded-lg mb-1 ${
                          location.pathname === item.url ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'
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
          <header className="bg-white border-b border-slate-200 px-6 py-4 md:hidden">
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