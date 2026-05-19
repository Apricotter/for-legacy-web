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
            return { id, type: "processing", line: "book", label: data?.label ?? "Processing", data, done: data?.done ?? false, needsAction: false, messageId };
        default:
            return null;
    }
}

export function useOnboardingMessages(channelId: string | undefined) {
    const client = useClient();
    const [steps, setSteps] = useState<WizardStep[]>([]);

    // Fetch existing messages from the API on mount (in-memory collection may be empty)
    useEffect(() => {
        console.log("[useOnboardingMessages] effect run — channelId:", channelId, "client:", !!client);
        if (!channelId || !client) return;
        const channel = client.channels.get(channelId);
        console.log("[useOnboardingMessages] channel from cache:", channel ? channel.constructor?.name : "NOT FOUND");
        if (!channel) return;

        (async () => {
            console.log("[useOnboardingMessages] fetching messages for channel", channelId);
            const applyUserReplies = (existing: WizardStep[], list: any[]) => {
                const userId = (client as any)?.user?._id;

                // Find the list index of the most recent greeting codeblock so we only
                // count user replies that came AFTER it (not stale replies from a prior session).
                const lastGreetingListIdx = list.reduce((found, m, i) =>
                    parseCodeblock(m.content ?? "")?.type === "greeting" ? i : found, -1);

                const userMsgsAfterGreeting = list.filter((m: any, i: number) => {
                    if (i <= lastGreetingListIdx) return false;
                    const author = m.author_id ?? m.author?._id ?? m.author;
                    return userId ? author === userId : !parseCodeblock(m.content ?? "");
                });

                // Greeting done if user replied "My name is X" after the greeting
                const nameMsg = userMsgsAfterGreeting.find((m: any) => /^my name is /i.test(m.content ?? ""));
                if (nameMsg) {
                    const name = nameMsg.content.replace(/^my name is /i, "").trim();
                    existing.forEach(s => {
                        if (s.type === "greeting") {
                            s.done = true;
                            s.needsAction = false;
                            s.data = { ...s.data, prefill_name: name };
                        }
                    });
                }
                // Upload form done if user sent a message with attachments after the greeting
                if (userMsgsAfterGreeting.some((m: any) => m.attachments?.length > 0)) {
                    existing.forEach(s => {
                        if (s.type === "form" && s.line === "book") {
                            s.done = true;
                            s.needsAction = false;
                        }
                    });
                }
            };

            try {
                // @ts-ignore — revolt.js v7 Channel
                const msgs = await (channel as any).fetchMessages({ limit: 100 });
                // fetchMessages returns newest-first; reverse to get chronological (greeting before form)
                const raw: any[] = Array.isArray(msgs) ? msgs : (msgs?.messages ?? []);
                const list = [...raw].reverse();
                console.log("[useOnboardingMessages] fetched", list.length, "messages");
                const existing: WizardStep[] = [];
                for (const msg of list) {
                    if (!msg?.content) continue;
                    const parsed = parseCodeblock(msg.content);
                    if (!parsed) continue;
                    console.log("[useOnboardingMessages] parsed codeblock", parsed.type, parsed.data);
                    const step = blockToStep(parsed.type, parsed.data, msg._id ?? msg.id);
                    if (step) existing.push(step);
                }
                console.log("[useOnboardingMessages] built", existing.length, "steps from history");
                applyUserReplies(existing, list);
                if (existing.length > 0) setSteps(existing);
            } catch {
                const existing: WizardStep[] = [];
                const list: any[] = [];
                // @ts-ignore
                channel.messages?.forEach?.((msg: any) => {
                    list.push(msg);
                    if (!msg?.content) return;
                    const parsed = parseCodeblock(msg.content);
                    if (!parsed) return;
                    const step = blockToStep(parsed.type, parsed.data, msg._id ?? msg.id);
                    if (step) existing.push(step);
                });
                applyUserReplies(existing, list);
                if (existing.length > 0) setSteps(existing);
            }
        })();
    }, [channelId, client]);

    // Listen for new messages in real-time
    useEffect(() => {
        console.log("[useOnboardingMessages] listener effect — channelId:", channelId, "client:", !!client);
        if (!channelId || !client) return;

        const handler = (msg: any) => {
            const msgChannel = msg.channel_id ?? msg.channelId ?? (msg.channel as any)?._id;
            console.log("[useOnboardingMessages] live message in", msgChannel, "watching", channelId, "content:", msg.content?.slice(0, 80));
            if (msgChannel !== channelId) return;
            if (!msg.content) return;

            const parsed = parseCodeblock(msg.content);
            if (!parsed) {
                console.log("[useOnboardingMessages] no codeblock in live message");
                return;
            }
            console.log("[useOnboardingMessages] live codeblock", parsed.type, parsed.data);
            const step = blockToStep(parsed.type, parsed.data, msg._id ?? msg.id);
            if (!step) {
                console.log("[useOnboardingMessages] blockToStep returned null for type", parsed.type);
                return;
            }

            setSteps(prev => {
                if (prev.find(s => s.id === step.id)) return prev;
                console.log("[useOnboardingMessages] adding live step", step.type, step.label);

                // New processing step → replace any existing processing step (one at a time)
                if (step.type === "processing") {
                    return [...prev.filter(s => s.type !== "processing"), step];
                }
                // Checkpoint on book line → drop processing steps, they've served their purpose
                if (step.type === "checkpoint" && step.line === "book") {
                    return [...prev.filter(s => s.type !== "processing"), step];
                }
                return [...prev, step];
            });
        };

        (client as any).on?.("message", handler);
        return () => (client as any).off?.("message", handler);
    }, [channelId, client]);

    const markDone = (stepId: string) => {
        setSteps(prev => prev.map(s => s.id === stepId ? { ...s, done: true, needsAction: false } : s));
    };

    const patchStepData = (stepId: string, patch: any) => {
        setSteps(prev => prev.map(s => s.id === stepId ? { ...s, data: { ...s.data, ...patch } } : s));
    };

    const clearSteps = () => setSteps([]);

    return { steps, markDone, patchStepData, clearSteps };
}
