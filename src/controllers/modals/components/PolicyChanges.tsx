import { useState } from "preact/hooks";

import { Modal } from "@revoltchat/ui";

import { useClient } from "../../client/ClientController";
import { ModalProps } from "../types";

export default function PolicyChanges({
    onClose,
    changes,
}: ModalProps<"policy_changes">) {
    const client = useClient();
    const [loading, setLoading] = useState(false);

    const latest = changes.sort(
        (a, b) =>
            new Date(b.created_time).getTime() -
            new Date(a.created_time).getTime(),
    )[0];

    async function acknowledge() {
        setLoading(true);
        try {
            await client!.api.post("/policy/acknowledge" as any);
        } catch {
            // best-effort
        }
        onClose();
    }

    return (
        <Modal
            title="Policy Update"
            description={
                <span>
                    {latest.description}
                    {latest.url && (
                        <>
                            {" "}
                            <a
                                href={latest.url}
                                target="_blank"
                                rel="noreferrer"
                            >
                                Read more
                            </a>
                        </>
                    )}
                </span>
            }
            actions={[
                {
                    palette: "accent",
                    onClick: acknowledge,
                    children: loading ? "..." : "I Acknowledge",
                    confirmation: true,
                },
            ]}
            onClose={onClose}
            nonDismissable
        />
    );
}
