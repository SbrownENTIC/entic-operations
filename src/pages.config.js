import Dashboard from './pages/Dashboard';
import Providers from './pages/Providers';
import Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "Providers": Providers,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: Layout,
};