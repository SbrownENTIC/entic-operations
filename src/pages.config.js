import Dashboard from './pages/Dashboard';
import Providers from './pages/Providers';
import ProviderDetail from './pages/ProviderDetail';
import Licenses from './pages/Licenses';
import ClinicalPrivileges from './pages/ClinicalPrivileges';
import CMETracking from './pages/CMETracking';
import SupplyOrders from './pages/SupplyOrders';
import OnCallSchedule from './pages/OnCallSchedule';
import Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "Providers": Providers,
    "ProviderDetail": ProviderDetail,
    "Licenses": Licenses,
    "ClinicalPrivileges": ClinicalPrivileges,
    "CMETracking": CMETracking,
    "SupplyOrders": SupplyOrders,
    "OnCallSchedule": OnCallSchedule,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: Layout,
};