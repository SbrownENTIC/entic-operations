import AudiologySupplyCatalog from './pages/AudiologySupplyCatalog';
import AudiologySupplyOrders from './pages/AudiologySupplyOrders';
import CMETracking from './pages/CMETracking';
import ClinicalPrivileges from './pages/ClinicalPrivileges';
import ClinicalSupplyCatalog from './pages/ClinicalSupplyCatalog';
import Dashboard from './pages/Dashboard';
import DocumentManagement from './pages/DocumentManagement';
import Home from './pages/Home';
import Licenses from './pages/Licenses';
import OfficeSupplyCatalog from './pages/OfficeSupplyCatalog';
import OnCallSchedule from './pages/OnCallSchedule';
import OutsideIncome from './pages/OutsideIncome';
import Payments from './pages/Payments';
import ProgramLocations from './pages/ProgramLocations';
import ProviderTimeOff from './pages/ProviderTimeOff';
import PublicSupplyRequest from './pages/PublicSupplyRequest';
import Reminders from './pages/Reminders';
import Reports from './pages/Reports';
import SimpleDashboard from './pages/SimpleDashboard';
import SupplyOrderDetail from './pages/SupplyOrderDetail';
import SupplyRequest from './pages/SupplyRequest';
import SystemDocumentation from './pages/SystemDocumentation';
import TodaysOrders from './pages/TodaysOrders';
import ProviderDetail from './pages/ProviderDetail';
import Providers from './pages/Providers';
import Invoices from './pages/Invoices';
import ClinicalSupplyOrders from './pages/ClinicalSupplyOrders';
import OfficeSupplyOrders from './pages/OfficeSupplyOrders';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AudiologySupplyCatalog": AudiologySupplyCatalog,
    "AudiologySupplyOrders": AudiologySupplyOrders,
    "CMETracking": CMETracking,
    "ClinicalPrivileges": ClinicalPrivileges,
    "ClinicalSupplyCatalog": ClinicalSupplyCatalog,
    "Dashboard": Dashboard,
    "DocumentManagement": DocumentManagement,
    "Home": Home,
    "Licenses": Licenses,
    "OfficeSupplyCatalog": OfficeSupplyCatalog,
    "OnCallSchedule": OnCallSchedule,
    "OutsideIncome": OutsideIncome,
    "Payments": Payments,
    "ProgramLocations": ProgramLocations,
    "ProviderTimeOff": ProviderTimeOff,
    "PublicSupplyRequest": PublicSupplyRequest,
    "Reminders": Reminders,
    "Reports": Reports,
    "SimpleDashboard": SimpleDashboard,
    "SupplyOrderDetail": SupplyOrderDetail,
    "SupplyRequest": SupplyRequest,
    "SystemDocumentation": SystemDocumentation,
    "TodaysOrders": TodaysOrders,
    "ProviderDetail": ProviderDetail,
    "Providers": Providers,
    "Invoices": Invoices,
    "ClinicalSupplyOrders": ClinicalSupplyOrders,
    "OfficeSupplyOrders": OfficeSupplyOrders,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};