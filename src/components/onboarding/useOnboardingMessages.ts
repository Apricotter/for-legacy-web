import { useEffect, useState } from "preact/hooks";
import { useClient } from "../../controllers/client/ClientController";

export type WizardStepType = "greeting" | "form" | "checkpoint" | "processing";

export interface WizardStep {
    id: string;
    type: WizardStepType;
    line: "book" | "author";
    label: string;
    data: any;
    done: boolean;
    needsAction: boolean;
    messageId?: string;
}

function parseCodeblock(content: string): { type: string; data: any } | null {
    const match = content.match(/```(\w+)\n([\s\S]*?)```/);
    if (!match) return null;
    try {
        return { type: match[1], data: JSON.parse(match[2]) };
    } catch {
        return null;
    }
}

function blockToStep(type: string, data: any, messageId: string): WizardStep | null {
    const id = messageId;
    switch (type) {
        case "greeting":
            return { id, type: "greeting", line: "author", label: "Welcome", data, done: false, needsAction: true, messageId };
        case "form":
            if (data?.fields?.some((f: any) => f.type === "upload" || f.key === "book_file")) {
                return { id, type: "form", line: "book", label: "Upload", data, done: false, needsAction: true, messageId };
            }
            return { id, type: "form", line: "author", label: data?.title ?? "Info", data, done: false, needsAction: true, messageId };
        case "checkpoint": {
            const labels: Record<string, string> = {
                scene_ner: "Cast",
                character_dialog: "Dialog",
                character_voice: "Voice",
            };
            return {
                id,
                type: "checkpoint",
                line: "book",
                label: labels[data?.step] ?? data?.step ?? "Review",
                data,
                done: false,
                needsAction: true,
                messageId,
            };
        }
        case "processing":
            return { id, type: "processing", line: "book", label: data?.label ?? "Processing", data, done: false, needsAction: false, messageId };
        default:
            return null;
    }
}

export function useOnboardingMessages(channelId: string | undefined) {
    const client = useClient();
    const [steps, setSteps] = useState<WizardStep[]>([]);

    // Fetch existing messages from the API on mount (in-memory collection may be empty)
    useEffect(() => {
        if (!channelId || !client) return;
        const channel = client.channels.get(channelId);
        if (!channel) return;

        (async () => {
            try {
                // @ts-ignore — revolt.js v7 Channel
                const msgs = await (channel as any).fetchMessages({ limit: 100 });
                // fetchMessages returns newest-first; reverse to get chronological (greeting before form)
                const raw: any[] = Array.isArray(msgs) ? msgs : (msgs?.messages ?? []);
                const list = [...raw].reverse();
                const existing: WizardStep[] = [];
                for (const msg of list) {
                    if (!msg?.content) continue;
                    const parsed = parseCodeblock(msg.content);
                    if (!parsed) continue;
                    const step = blockToStep(parsed.type, parsed.data, msg._id ?? msg.id);
                    if (step) existing.push(step);
                }
                if (existing.length > 0) setSteps(existing);
            } catch {
                const existing: WizardStep[] = [];
                // @ts-ignore
                channel.messages?.forEach?.((msg: any) => {
                    if (!msg?.content) return;
                    const parsed = parseCodeblock(msg.content);
                    if (!parsed) return;
                    const step = blockToStep(parsed.type, parsed.data, msg._id ?? msg.id);
                    if (step) existing.push(step);
                });
                if (existing.length > 0) setSteps(existing);
            }
        })();
    }, [channelId, client]);

    // Listen for new messages in real-time
    useEffect(() => {
        if (!channelId || !client) return;

        const handler = (msg: any) => {
            const msgChannelId = msg.channelId ?? msg.channel_id ?? msg._id;
            // revolt.js v7 passes the message object directly
            const msgChannel = msg.channel_id ?? msg.channelId ?? (msg.channel as any)?._id;
            if (msgChannel !== channelId) return;
            if (!msg.content) return;

            const parsed = parseCodeblock(msg.content);
            if (!parsed) return;
            const step = blockToStep(parsed.type, parsed.data, msg._id ?? msg.id);
            if (!step) return;

            setSteps(prev => {
                if (prev.find(s => s.id === step.id)) return prev;
                return [...prev, step];
            });
        };

        (client as any).on?.("message", handler);
        return () => (client as any).off?.("message", handler);
    }, [channelId, client]);

    const markDone = (stepId: string) => {
        setSteps(prev => prev.map(s => s.id === stepId ? { ...s, done: true, needsAction: false } : s));
    };

    const clearSteps = () => setSteps([]);

    return { steps, markDone, clearSteps };
}
