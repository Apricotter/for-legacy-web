import { Redirect, Route, Switch } from "react-router-dom";

import { lazy, Suspense } from "preact/compat";
import { useState, useEffect } from "preact/hooks";
import { observer } from "mobx-react-lite";
import { clientController, useClient } from "../controllers/client/ClientController";

import { Masks, Preloader } from "@revoltchat/ui";

import ErrorBoundary from "../lib/ErrorBoundary";

import Context from "../context";

import { CheckAuth } from "../controllers/client/jsx/CheckAuth";
import Invite from "./invite/Invite";

const Login = lazy(() => import("./login/Login"));
const ConfirmDelete = lazy(() => import("./login/ConfirmDelete"));
const RevoltApp = lazy(() => import("./RevoltApp"));
const Landing = lazy(() => import("./landing/Landing"));
const Dashboard = lazy(() => import("./dashboard/Dashboard"));
const DevWizard = lazy(() => import("./DevWizard"));
const DevOnboarding = lazy(() => import("./DevOnboarding"));
const Payment = lazy(() => import("./payment/Payment"));

const ADMIN_EMAILS = (import.meta.env.VITE_SKIP_PAYMENT_FOR_EMAILS as string | undefined)
    ?.split(",").map(s => s.trim().toLowerCase()) ?? [];

const PaymentGate = observer(({ children }: { children: preact.ComponentChildren }) => {
    const client = useClient();
    const [email, setEmail] = useState<string | null>(null);
    const [emailLoaded, setEmailLoaded] = useState(false);
    const loggedIn = clientController.isLoggedIn();

    useEffect(() => {
        if (!loggedIn || ADMIN_EMAILS.length === 0) { setEmailLoaded(true); return; }
        client?.api.get("/auth/account/")
            .then((acc: any) => setEmail(acc?.email?.toLowerCase() ?? ""))
            .catch(() => setEmail(""))
            .finally(() => setEmailLoaded(true));
    }, [loggedIn]);

    if (loggedIn && !emailLoaded) return <>{children}</>;
    const isAdmin = ADMIN_EMAILS.length > 0 && !!email && ADMIN_EMAILS.includes(email);
    if (loggedIn && !isAdmin && !localStorage.getItem("apricotter_preauth_done")) {
        return <Redirect to="/gallery/payment" />;
    }
    return <>{children}</>;
});

const IS_HUB =
    typeof window !== "undefined" &&
    (window.location.hostname === "hub2.apricotter.com" ||
        window.location.hostname === "localhost");

const LoadSuspense: React.FC = ({ children }) => (
    // @ts-expect-error Typing issue between Preact and Preact.
    <Suspense fallback={<Preloader type="ring" />}>{children}</Suspense>
);

export function App() {
    return (
        <ErrorBoundary section="client">
            <Context>
                <Masks />
                <Switch>
                    <Route path="/login/verify/:token">
                        <LoadSuspense>
                            <Login />
                        </LoadSuspense>
                    </Route>
                    <Route path="/login/reset/:token">
                        <LoadSuspense>
                            <Login />
                        </LoadSuspense>
                    </Route>
                    <Route path="/delete/:token">
                        <LoadSuspense>
                            <ConfirmDelete />
                        </LoadSuspense>
                    </Route>
                    <Route path="/invite/:code">
                        <CheckAuth blockRender>
                            <Invite />
                        </CheckAuth>
                        <CheckAuth auth blockRender>
                            <Invite />
                        </CheckAuth>
                    </Route>
                    <Route
                        path="/signup"
                        render={({ location }) => (
                            <Redirect to={`/login/create${location.search}`} />
                        )}
                    />
                    <Route path="/login">
                        <CheckAuth>
                            <LoadSuspense>
                                <Login />
                            </LoadSuspense>
                        </CheckAuth>
                    </Route>
                    <Route path="/dashboard">
                        <LoadSuspense>
                            <Dashboard />
                        </LoadSuspense>
                    </Route>
                    <Route path="/dev-wizard">
                        <LoadSuspense>
                            <DevWizard />
                        </LoadSuspense>
                    </Route>
                    <Route path="/dev-onboarding">
                        <LoadSuspense>
                            <DevOnboarding />
                        </LoadSuspense>
                    </Route>
                    <Route path="/gallery/payment">
                        <CheckAuth auth>
                            <LoadSuspense>
                                <Payment />
                            </LoadSuspense>
                        </CheckAuth>
                    </Route>
                    <Route path="/">
                        {IS_HUB ? (
                            <>
                                <CheckAuth blockRender>
                                    <LoadSuspense>
                                        <Landing />
                                    </LoadSuspense>
                                </CheckAuth>
                                <CheckAuth auth blockRender>
                                    <PaymentGate>
                                        <LoadSuspense>
                                            <RevoltApp />
                                        </LoadSuspense>
                                    </PaymentGate>
                                </CheckAuth>
                            </>
                        ) : (
                            <CheckAuth auth>
                                <PaymentGate>
                                    <LoadSuspense>
                                        <RevoltApp />
                                    </LoadSuspense>
                                </PaymentGate>
                            </CheckAuth>
                        )}
                    </Route>
                </Switch>
            </Context>
        </ErrorBoundary>
    );
}
