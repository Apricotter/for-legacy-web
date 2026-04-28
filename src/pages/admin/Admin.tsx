import { UserPlus } from "@styled-icons/boxicons-regular";
import { observer } from "mobx-react-lite";
import { Route, Switch, useHistory } from "react-router-dom";

import { useClient } from "../../controllers/client/ClientController";
import { GenericSettings } from "../settings/GenericSettings";
import NewClientPane from "./panes/NewClient";

export default observer(() => {
    const history = useHistory();
    const client = useClient();

    if (!client?.user?.privileged) {
        return (
            <div style={{ padding: 40, color: "var(--foreground)" }}>
                Not authorized.
            </div>
        );
    }

    function switchPage(to?: string) {
        history.replace(to ? `/admin/${to}` : `/admin`);
    }

    return (
        <GenericSettings
            pages={[
                {
                    id: "clients",
                    icon: <UserPlus size={20} />,
                    title: "Clients",
                    hideTitle: true,
                },
            ]}
            children={
                <Switch>
                    <Route path="/admin/clients">
                        <NewClientPane />
                    </Route>
                    <Route>
                        <NewClientPane />
                    </Route>
                </Switch>
            }
            defaultPage="clients"
            switchPage={switchPage}
            category="pages"
            showExitButton
        />
    );
});
