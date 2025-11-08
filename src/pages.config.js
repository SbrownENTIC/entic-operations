import Dashboard from './pages/Dashboard';
import Providers from './pages/Providers';
import ProviderDetail from './pages/ProviderDetail';
import Licenses from './pages/Licenses';
import Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "Providers": Providers,
    "ProviderDetail": ProviderDetail,
    "Licenses": Licenses,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: Layout,
};