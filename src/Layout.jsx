import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { FormProvider, useFormState } from "@/components/FormContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { clearAuditUserCache } from "@/lib/auditLogger";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
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
        Bell,
        Menu,
        X,
        MoreVertical,
        HelpCircle,
        LogOut,
        Loader2,
        ClipboardList
      } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
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
    title: "Office Supply Orders",
    url: createPageUrl("OfficeSupplyOrders"),
    icon: Package,
  },
  {
    title: "Clinical Supply Orders",
    url: createPageUrl("ClinicalSupplyOrders"),
    icon: Package,
  },
  {
    title: "Audiology Supply Orders",
    url: createPageUrl("AudiologySupplyOrders"),
    icon: Package,
  },
  {
    title: "Time Off & CME",
    url: createPageUrl("ProviderTimeOff"),
    icon: Calendar,
  },
  {
    title: "Notifications & Closures",
    url: createPageUrl("Reminders"),
    icon: Bell,
  },
  {
    title: "Licenses",
    url: createPageUrl("Licenses"),
    icon: ShieldCheck,
  },
  {
    title: "Reports",
    url: createPageUrl("Reports"),
    icon: BarChart3,
  },

  {
    title: "Document Management",
    url: createPageUrl("DocumentManagement"),
    icon: FileText,
  },
  ];

const moreMenuItems = [
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
    title: "Office Catalog",
    url: createPageUrl("OfficeSupplyCatalog"),
    icon: Boxes,
  },
  {
    title: "Clinical Catalog",
    url: createPageUrl("ClinicalSupplyCatalog"),
    icon: FileText,
  },
  {
    title: "Audiology Catalog",
    url: createPageUrl("AudiologySupplyCatalog"),
    icon: Boxes,
  },
  {
    title: "System Documentation",
    url: createPageUrl("SystemDocumentation"),
    icon: HelpCircle,
  },
  {
    title: "Audit Log",
    url: "/AuditLog",
    icon: ClipboardList,
  },
];

function isNavItemActive(pathname, item) {
  if (item.title === "Dashboard") {
    return pathname === "/" || pathname === item.url;
  }
  return pathname === item.url;
}

export default function Layout(props) {
  return (
    <FormProvider>
      <LayoutContent {...props} />
    </FormProvider>
  );
}

function LayoutContent({ children, currentPageName }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isDirty, setIsDirty } = useFormState();
  const [pendingNavigation, setPendingNavigation] = useState(null);
  const { isAuthenticated, isLoadingAuth, navigateToLogin } = useAuth();
  const isPublicPage = currentPageName === 'PublicSupplyRequest';

  // Scroll to top on route change
  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // Redirect unauthenticated users away from protected pages
  React.useEffect(() => {
    if (!isPublicPage && !isLoadingAuth && !isAuthenticated) {
      navigateToLogin();
    }
  }, [isPublicPage, isLoadingAuth, isAuthenticated, navigateToLogin]);

  // Update document title on page change
  React.useEffect(() => {
    if (currentPageName === 'PublicSupplyRequest') {
      document.title = "ENTIC Supply Order Form";
      return;
    }

    const pageTitleMap = {
      Dashboard: "Dashboard",
      Providers: "Providers",
      OnCallSchedule: "On-Call Schedule",
      OutsideIncome: "Outside Income",
      Invoices: "Invoices",
      Payments: "Payments",
      OfficeSupplyOrders: "Office Supply Orders",
      ClinicalSupplyOrders: "Clinical Supply Orders",
      AudiologySupplyOrders: "Audiology Supply Orders",
      ProviderTimeOff: "Time Off & CME",
      Reminders: "Notifications & Closures",
      Licenses: "Licenses",
      Reports: "Reports",
      DocumentManagement: "Document Management",
      ClinicalPrivileges: "Clinical Privileges",
      CMETracking: "CME Tracking",
      OfficeSupplyCatalog: "Office Catalog",
      ClinicalSupplyCatalog: "Clinical Catalog",
      AudiologySupplyCatalog: "Audiology Catalog",
      SystemDocumentation: "System Documentation",
      ProgramLocations: "Program Locations",
      ProviderDetail: "Provider Detail",
      AuditLog: "Audit Log",
      NotificationQueue: "Notification Queue",
      CallLogDashboard: "Call Log",
      TodaysOrders: "Today's Orders",
    };
    const pageTitle = pageTitleMap[currentPageName];
    document.title = pageTitle
      ? `ENTIC Operations Center – ${pageTitle}`
      : "ENTIC Operations Center";
  }, [currentPageName]);

  const [previousCount, setPreviousCount] = React.useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const handleNavigationClick = (e, url) => {
    // Dashboard scroll-to-top logic
    if (url === createPageUrl("Dashboard") && location.pathname === createPageUrl("Dashboard")) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // If form is dirty, intercept navigation
    if (isDirty) {
      e.preventDefault();
      setPendingNavigation(url);
    }
    // If not dirty, let default Link behavior happen
    // This will handle navigating to "/Invoices" from "/Invoices?edit=1" correctly
  };

  const handleLogout = () => {
    clearAuditUserCache();
    base44.auth.logout();
  };

  const handleConfirmNavigation = () => {
    setIsDirty(false); // Reset dirty state
    if (pendingNavigation) {
      navigate(pendingNavigation);
      setPendingNavigation(null);
    }
  };

  const { data: pendingOrders = [] } = useQuery({
    queryKey: ['pending-review-orders'],
    queryFn: async () => {
      // Use $in operator to fetch both statuses in a single request
      const orders = await base44.entities.SupplyOrder.filter({ 
        status: { $in: ['pending_review', 'pending_fulfillment'] } 
      });
      // Filter for office orders only; 'open' drafts are excluded (not yet submitted)
      return orders.filter(o => o.category === 'office');
    },
    refetchInterval: 30000
  });

  // Play notification sound when new orders arrive
  React.useEffect(() => {
    if (pendingOrders.length > previousCount) {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        
        const audioContext = new AudioContext();
        
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

          // Clean up context after sound finishes
          setTimeout(() => {
            if (audioContext.state !== 'closed') {
              audioContext.close().catch(console.error);
            }
          }, 1000);
        };
        
        playDoorbell();
      } catch (err) {
        console.error("Failed to play notification sound", err);
      }
    }
    setPreviousCount(pendingOrders.length);
  }, [pendingOrders.length]);

  // Show loading state while checking auth (protected pages only)
  if (!isPublicPage && isLoadingAuth) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  // Redirect in progress for unauthenticated protected pages
  if (!isPublicPage && !isAuthenticated) {
    return null;
  }

  // Hide navigation for public pages
  if (isPublicPage) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        {children}
      </div>
    );
  }

  const isDashboardPage = currentPageName === 'Dashboard';

  return (
    <div className={`${isDashboardPage ? 'min-h-screen' : 'h-screen overflow-hidden'} w-full overflow-x-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50`}>
      <style>{`
        :root {
          --primary: 221 83% 53%;
          --primary-foreground: 210 40% 98%;
          --background: 210 40% 98%;
          --card: 0 0% 100%;
          --card-foreground: 222.2 47.4% 11.2%;
          --muted: 210 40% 96.1%;
          --muted-foreground: 215.4 16.3% 46.9%;
          --accent: 210 40% 96.1%;
          --accent-foreground: 222.2 47.4% 11.2%;
        }
        @keyframes ring {
          0%, 100% { transform: rotate(0deg); }
          10%, 30% { transform: rotate(-15deg); }
          20%, 40% { transform: rotate(15deg); }
          50% { transform: rotate(0deg); }
        }
        .animate-ring {
          animation: ring 2s ease-in-out infinite;
          transform-origin: top center;
        }
      `}</style>
      
      {/* Top Navigation */}
      <nav className="bg-white/90 backdrop-blur-sm border-b border-slate-200/60 shadow-sm fixed top-0 left-0 right-0 z-50">
        <div className="px-4 lg:px-6">
          <div className="flex items-end justify-between min-h-[6rem] py-2">
            {/* Logo and Brand */}
            <div className="flex flex-col gap-1 pb-1 shrink-0">
              <img 
                src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/691521cbabed77e5043c7037/267bf0119_thumbnail_ENTIC_horizontal_BKGD.png" 
                alt="ENTIC Logo" 
                className="h-14 w-auto object-contain"
                crossOrigin="anonymous"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
              <div>
                <h2 className="font-bold text-slate-900 text-sm">Operations Center</h2>
              </div>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-1 flex-1 justify-center px-2 pb-1">
              <Link 
                to={createPageUrl("OfficeSupplyOrders") + "?filter=pending"}
                className="relative p-2 hover:bg-blue-50 rounded-lg transition-all border border-transparent hover:border-blue-200"
                aria-label={`Pending supply orders${pendingOrders.length > 0 ? ` (${pendingOrders.length})` : ''}`}
              >
                <Bell className={`w-5 h-5 text-slate-600 ${pendingOrders.length > 0 ? 'animate-ring' : ''}`} />
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
                  onClick={(e) => handleNavigationClick(e, item.url)}
                  className={`flex items-center gap-1 px-1 py-1 rounded-lg text-[11px] font-medium transition-all duration-200 border h-14 w-[105px] justify-center text-center leading-tight whitespace-normal ${
                    isNavItemActive(location.pathname, item)
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md border-blue-600'
                      : 'bg-white text-slate-700 hover:bg-blue-50 border-slate-200 hover:border-blue-300 shadow-sm hover:shadow'
                  }`}
                >
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  <span>{item.title}</span>
                </Link>
              ))}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-1 px-2 py-2 rounded-lg text-sm font-medium border border-slate-200 hover:border-blue-300 shadow-sm hover:shadow"
                    aria-label="More menu"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {moreMenuItems.map((item) => (
                    <DropdownMenuItem key={item.title} asChild>
                      <Link
                        to={item.url}
                        onClick={(e) => handleNavigationClick(e, item.url)}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <item.icon className="w-4 h-4" />
                        <span>{item.title}</span>
                      </Link>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="flex items-center gap-2 cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50">
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Right side - Mobile Menu */}
            <div className="flex items-center gap-2 pb-1">
              <Link 
                to={createPageUrl("OfficeSupplyOrders") + "?filter=pending"}
                className="relative p-2 hover:bg-slate-100 rounded-lg transition-colors lg:hidden"
                aria-label={`Pending supply orders${pendingOrders.length > 0 ? ` (${pendingOrders.length})` : ''}`}
              >
                <Bell className={`w-5 h-5 text-slate-600 ${pendingOrders.length > 0 ? 'animate-ring' : ''}`} />
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
                aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
                aria-expanded={mobileMenuOpen}
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
                    onClick={(e) => {
                      setMobileMenuOpen(false);
                      handleNavigationClick(e, item.url);
                    }}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-all ${
                      isNavItemActive(location.pathname, item)
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
                    onClick={(e) => {
                      setMobileMenuOpen(false);
                      handleNavigationClick(e, item.url);
                    }}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-all ${
                      isNavItemActive(location.pathname, item)
                        ? 'bg-blue-100 text-blue-700 font-medium'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    <span>{item.title}</span>
                  </Link>
                ))}
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleLogout();
                  }}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-all text-red-600 hover:bg-red-50 w-full text-left"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Main Content */}
      <main className={isDashboardPage ? "flex-1 relative pt-[8rem]" : "relative h-screen pt-[8rem] overflow-hidden"}>
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className={isDashboardPage ? "h-full" : "h-full min-h-0 overflow-hidden non-dashboard-compact"}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      <AlertDialog open={!!pendingNavigation} onOpenChange={(open) => !open && setPendingNavigation(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Are you sure you want to leave? Your changes will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingNavigation(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmNavigation} className="bg-red-600 hover:bg-red-700">
              Discard Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}