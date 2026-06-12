/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import AudiologySupplyCatalog from './pages/AudiologySupplyCatalog';
import AudiologySupplyOrders from './pages/AudiologySupplyOrders';
import CMETracking from './pages/CMETracking';
import ClinicalPrivileges from './pages/ClinicalPrivileges';
import ClinicalSupplyCatalog from './pages/ClinicalSupplyCatalog';
import ClinicalSupplyOrders from './pages/ClinicalSupplyOrders';
import Dashboard from './pages/Dashboard';
import DocumentManagement from './pages/DocumentManagement';
import Invoices from './pages/Invoices';
import Licenses from './pages/Licenses';
import OfficeSupplyCatalog from './pages/OfficeSupplyCatalog';
import OfficeSupplyOrders from './pages/OfficeSupplyOrders';
import OnCallSchedule from './pages/OnCallSchedule';
import OutsideIncome from './pages/OutsideIncome';
import Payments from './pages/Payments';
import ProgramLocations from './pages/ProgramLocations';
import ProviderDetail from './pages/ProviderDetail';
import ProviderTimeOff from './pages/ProviderTimeOff';
import Providers from './pages/Providers';
import PublicSupplyRequest from './pages/PublicSupplyRequest';
import Reminders from './pages/Reminders';
import Reports from './pages/Reports';
import SimpleDashboard from './pages/SimpleDashboard';
import SupplyOrderDetail from './pages/SupplyOrderDetail';
import SupplyRequest from './pages/SupplyRequest';
import SystemDocumentation from './pages/SystemDocumentation';
import TodaysOrders from './pages/TodaysOrders';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AudiologySupplyCatalog": AudiologySupplyCatalog,
    "AudiologySupplyOrders": AudiologySupplyOrders,
    "CMETracking": CMETracking,
    "ClinicalPrivileges": ClinicalPrivileges,
    "ClinicalSupplyCatalog": ClinicalSupplyCatalog,
    "ClinicalSupplyOrders": ClinicalSupplyOrders,
    "Dashboard": Dashboard,
    "DocumentManagement": DocumentManagement,
    "Invoices": Invoices,
    "Licenses": Licenses,
    "OfficeSupplyCatalog": OfficeSupplyCatalog,
    "OfficeSupplyOrders": OfficeSupplyOrders,
    "OnCallSchedule": OnCallSchedule,
    "OutsideIncome": OutsideIncome,
    "Payments": Payments,
    "ProgramLocations": ProgramLocations,
    "ProviderDetail": ProviderDetail,
    "ProviderTimeOff": ProviderTimeOff,
    "Providers": Providers,
    "PublicSupplyRequest": PublicSupplyRequest,
    "Reminders": Reminders,
    "Reports": Reports,
    "SimpleDashboard": SimpleDashboard,
    "SupplyOrderDetail": SupplyOrderDetail,
    "SupplyRequest": SupplyRequest,
    "SystemDocumentation": SystemDocumentation,
    "TodaysOrders": TodaysOrders,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};