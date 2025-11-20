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
        Bell,
        Menu,
        X,
        MoreVertical
      } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const navigationItems = [
  {
    title: "Dashboard",
    url: createPageUrl("Dashboard"),
    icon: LayoutDashboard,
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
    title: "Supply Orders",
    url: createPageUrl("SupplyOrders"),
    icon: Package,
  },
  {
    title: "Payments",
    url: createPageUrl("Payments"),
    icon: CreditCard,
  },
  {
    title: "Time Off & CME",
    url: createPageUrl("ProviderTimeOff"),
    icon: Calendar,
  },
  {
    title: "Reminders",
    url: createPageUrl("Reminders"),
    icon: Bell,
  },
  {
    title: "Providers",
    url: createPageUrl("Providers"),
    icon: Users,
  },
];

const moreMenuItems = [
  {
    title: "Clinical Privileges",
    url: createPageUrl("ClinicalPrivileges"),
    icon: Award,
  },
  {
    title: "Licenses",
    url: createPageUrl("Licenses"),
    icon: ShieldCheck,
  },
  {
    title: "CME Tracking",
    url: createPageUrl("CMETracking"),
    icon: GraduationCap,
  },
  {
    title: "Supply Catalog",
    url: createPageUrl("Supplies"),
    icon: Boxes,
  },
  {
    title: "Reports",
    url: createPageUrl("Reports"),
    icon: BarChart3,
  },
];

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const [previousCount, setPreviousCount] = React.useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const { data: pendingOrders = [] } = useQuery({
    queryKey: ['pending-review-orders'],
    queryFn: async () => {
      const reviewOrders = await base44.entities.SupplyOrder.filter({ status: 'pending_review' });
      const fulfillmentOrders = await base44.entities.SupplyOrder.filter({ status: 'pending_fulfillment' });
      return [...reviewOrders, ...fulfillmentOrders];
    },
    refetchInterval: 30000
  });

  // Play notification sound when new orders arrive
  React.useEffect(() => {
    if (pendingOrders.length > previousCount && previousCount > 0) {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      const playDoorbell = () => {
        const oscillator1 = audioContext.createOscillator();
        const gainNode1 = audioContext.createGain();
        oscillator1.connect(gainNode1);
        gainNode1.connect(audioContext.destination);
        oscillator1.frequency.value = 800;
        oscillator1.type = 'sine';
        gainNode1.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode1.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        oscillator1.start(audioContext.currentTime);
        oscillator1.stop(audioContext.currentTime + 0.3);
        
        const oscillator2 = audioContext.createOscillator();
        const gainNode2 = audioContext.createGain();
        oscillator2.connect(gainNode2);
        gainNode2.connect(audioContext.destination);
        oscillator2.frequency.value = 600;
        oscillator2.type = 'sine';
        gainNode2.gain.setValueAtTime(0, audioContext.currentTime + 0.3);
        gainNode2.gain.setValueAtTime(0.3, audioContext.currentTime + 0.3);
        gainNode2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.7);
        oscillator2.start(audioContext.currentTime + 0.3);
        oscillator2.stop(audioContext.currentTime + 0.7);
      };
      
      playDoorbell();
    }
    setPreviousCount(pendingOrders.length);
  }, [pendingOrders.length]);

  // Hide navigation for public pages
  if (currentPageName === 'PublicSupplyRequest') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
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
      `}</style>
      
      {/* Top Navigation */}
      <nav className="bg-white/90 backdrop-blur-sm border-b border-slate-200/60 shadow-sm sticky top-0 z-50">
        <div className="px-4 lg:px-6">
          <div className="flex items-end justify-between h-20 pb-2">
            {/* Logo and Brand */}
            <div className="flex flex-col gap-1 pb-1">
              <img 
                src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/691521cbabed77e5043c7037/267bf0119_thumbnail_ENTIC_horizontal_BKGD.png" 
                alt="ENTIC Logo" 
                className="h-10 w-auto"
              />
              <div>
                <h2 className="font-bold text-slate-900 text-sm">Operations Center</h2>
              </div>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-2 flex-1 justify-center px-2 pb-1">
              <Link 
                to={createPageUrl("SupplyOrders") + "?filter=pending"}
                className="relative p-2 hover:bg-blue-50 rounded-lg transition-all border border-transparent hover:border-blue-200"
              >
                <Bell className="w-5 h-5 text-slate-600" />
                {pendingOrders.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center shadow-lg">
                    {pendingOrders.length}
                  </span>
                )}
              </Link>
              {navigationItems.map((item) => (
                <Link
                  key={item.title}
                  to={item.url}
                  className={`flex items-center gap-2 px-2 py-2 rounded-lg text-sm font-medium transition-all duration-200 border min-w-[130px] justify-center ${
                    location.pathname === item.url
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md border-blue-600'
                      : 'bg-white text-slate-700 hover:bg-blue-50 border-slate-200 hover:border-blue-300 shadow-sm hover:shadow'
                  }`}
                >
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{item.title}</span>
                </Link>
              ))}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-1 px-2 py-2 rounded-lg text-sm font-medium border border-slate-200 hover:border-blue-300 shadow-sm hover:shadow"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {moreMenuItems.map((item) => (
                    <DropdownMenuItem key={item.title} asChild>
                      <Link
                        to={item.url}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <item.icon className="w-4 h-4" />
                        <span>{item.title}</span>
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Right side - Mobile Menu */}
            <div className="flex items-center gap-2 pb-1">
              <Link 
                to={createPageUrl("SupplyOrders") + "?filter=pending"}
                className="relative p-2 hover:bg-slate-100 rounded-lg transition-colors lg:hidden"
              >
                <Bell className="w-5 h-5 text-slate-600" />
                {pendingOrders.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                    {pendingOrders.length}
                  </span>
                )}
              </Link>

              {/* Mobile Menu Button */}
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </Button>
            </div>
          </div>

          {/* Mobile Navigation Dropdown */}
          {mobileMenuOpen && (
            <div className="lg:hidden border-t border-slate-200 py-2 bg-white">
              <div className="grid grid-cols-2 gap-1 max-h-[70vh] overflow-y-auto">
                {navigationItems.map((item) => (
                  <Link
                    key={item.title}
                    to={item.url}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-all ${
                      location.pathname === item.url
                        ? 'bg-blue-100 text-blue-700 font-medium'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    <span>{item.title}</span>
                  </Link>
                ))}
                {moreMenuItems.map((item) => (
                  <Link
                    key={item.title}
                    to={item.url}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-all ${
                      location.pathname === item.url
                        ? 'bg-blue-100 text-blue-700 font-medium'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    <span>{item.title}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}