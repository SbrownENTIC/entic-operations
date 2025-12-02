import Dashboard from './pages/Dashboard';
import Providers from './pages/Providers';
import ProviderDetail from './pages/ProviderDetail';
import Licenses from './pages/Licenses';
import ClinicalPrivileges from './pages/ClinicalPrivileges';
import CMETracking from './pages/CMETracking';
import OnCallSchedule from './pages/OnCallSchedule';
import OutsideIncome from './pages/OutsideIncome';
import Invoices from './pages/Invoices';
import Payments from './pages/Payments';
import ProgramLocations from './pages/ProgramLocations';
import ProviderTimeOff from './pages/ProviderTimeOff';
import Reminders from './pages/Reminders';
import SimpleDashboard from './pages/SimpleDashboard';
import Reports from './pages/Reports';
import SupplyRequest from './pages/SupplyRequest';
import PublicSupplyRequest from './pages/PublicSupplyRequest';
import SupplyOrderDetail from './pages/SupplyOrderDetail';
import ClinicalSupplyCatalog from './pages/ClinicalSupplyCatalog';
import OfficeSupplyCatalog from './pages/OfficeSupplyCatalog';
import OfficeSupplyOrders from './pages/OfficeSupplyOrders';
import ClinicalSupplyOrders from './pages/ClinicalSupplyOrders';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "Providers": Providers,
    "ProviderDetail": ProviderDetail,
    "Licenses": Licenses,
    "ClinicalPrivileges": ClinicalPrivileges,
    "CMETracking": CMETracking,
    "OnCallSchedule": OnCallSchedule,
    "OutsideIncome": OutsideIncome,
    "Invoices": Invoices,
    "Payments": Payments,
    "ProgramLocations": ProgramLocations,
    "ProviderTimeOff": ProviderTimeOff,
    "Reminders": Reminders,
    "SimpleDashboard": SimpleDashboard,
    "Reports": Reports,
    "SupplyRequest": SupplyRequest,
    "PublicSupplyRequest": PublicSupplyRequest,
    "SupplyOrderDetail": SupplyOrderDetail,
    "ClinicalSupplyCatalog": ClinicalSupplyCatalog,
    "OfficeSupplyCatalog": OfficeSupplyCatalog,
    "OfficeSupplyOrders": OfficeSupplyOrders,
    "ClinicalSupplyOrders": ClinicalSupplyOrders,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};