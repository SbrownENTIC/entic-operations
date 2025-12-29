import CMETracking from './pages/CMETracking';
import ClinicalPrivileges from './pages/ClinicalPrivileges';
import ClinicalSupplyCatalog from './pages/ClinicalSupplyCatalog';
import ClinicalSupplyOrders from './pages/ClinicalSupplyOrders';
import Dashboard from './pages/Dashboard';
import DocumentManagement from './pages/DocumentManagement';
import Home from './pages/Home';
import Invoices from './pages/Invoices';
import Licenses from './pages/Licenses';
import OfficeSupplyCatalog from './pages/OfficeSupplyCatalog';
import OfficeSupplyOrders from './pages/OfficeSupplyOrders';
import OnCallSchedule from './pages/OnCallSchedule';
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
import OutsideIncome from './pages/OutsideIncome';
import __Layout from './Layout.jsx';


export const PAGES = {
    "CMETracking": CMETracking,
    "ClinicalPrivileges": ClinicalPrivileges,
    "ClinicalSupplyCatalog": ClinicalSupplyCatalog,
    "ClinicalSupplyOrders": ClinicalSupplyOrders,
    "Dashboard": Dashboard,
    "DocumentManagement": DocumentManagement,
    "Home": Home,
    "Invoices": Invoices,
    "Licenses": Licenses,
    "OfficeSupplyCatalog": OfficeSupplyCatalog,
    "OfficeSupplyOrders": OfficeSupplyOrders,
    "OnCallSchedule": OnCallSchedule,
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
    "OutsideIncome": OutsideIncome,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};