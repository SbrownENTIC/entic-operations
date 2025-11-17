import Dashboard from './pages/Dashboard';
import Providers from './pages/Providers';
import ProviderDetail from './pages/ProviderDetail';
import Licenses from './pages/Licenses';
import ClinicalPrivileges from './pages/ClinicalPrivileges';
import CMETracking from './pages/CMETracking';
import SupplyOrders from './pages/SupplyOrders';
import OnCallSchedule from './pages/OnCallSchedule';
import OutsideIncome from './pages/OutsideIncome';
import Invoices from './pages/Invoices';
import Payments from './pages/Payments';
import Supplies from './pages/Supplies';
import ProgramLocations from './pages/ProgramLocations';
import ProviderTimeOff from './pages/ProviderTimeOff';
import Reminders from './pages/Reminders';
import SimpleDashboard from './pages/SimpleDashboard';
import Reports from './pages/Reports';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "Providers": Providers,
    "ProviderDetail": ProviderDetail,
    "Licenses": Licenses,
    "ClinicalPrivileges": ClinicalPrivileges,
    "CMETracking": CMETracking,
    "SupplyOrders": SupplyOrders,
    "OnCallSchedule": OnCallSchedule,
    "OutsideIncome": OutsideIncome,
    "Invoices": Invoices,
    "Payments": Payments,
    "Supplies": Supplies,
    "ProgramLocations": ProgramLocations,
    "ProviderTimeOff": ProviderTimeOff,
    "Reminders": Reminders,
    "SimpleDashboard": SimpleDashboard,
    "Reports": Reports,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};