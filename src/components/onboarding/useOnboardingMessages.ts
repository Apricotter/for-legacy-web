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

// Canonical step definitions — always present, always in this order.
// Messages activate them (set data + needsAction); they never create new stops.
const FIXED_STEP_DEFS: Omit<WizardStep, "data" | "done" | "needsAction">[] = [
    { id: "greeting",                    type: "greeting",   line: "author", label: "Welcome"    },
    { id: "form_book",                   type: "form",       line: "book",   label: "Upload"     },
    { id: "checkpoint_character_review", type: "checkpoint", line: "book",   label: "Characters" },
    { id: "form_author",                 type: "form",       line: "author", label: "Reviews"    },
];

function makeFixedSteps(): WizardStep[] {
    return FIXED_STEP_DEFS.map(def => ({ ...def, data: null, done: false, needsAction: false }));
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

// Map a codeblock type+data to the fixed step it should update
function stepIdForBlock(type: string, data: any): string | null {
    if (type === "greeting") return "greeting";
    if (type === "form") {
        const isUpload = data?.fields?.some((f: any) => f.type === "upload" || f.key === "book_file");
        return isUpload ? "form_book" : "form_author";
    }
    if (type === "checkpoint" && data?.step) return `checkpoint_${data.step}`;
    return null;
}

// Apply a codeblock to the fixed step array (activate the target step)
function activateStep(steps: WizardStep[], type: string, data: any, messageId: string): WizardStep[] {
    const targetId = stepIdForBlock(type, data);
    if (!targetId) return steps;
    return steps.map(s => s.id === targetId ? { ...s, data, needsAction: true, messageId } : s);
}

export function useOnboardingMessages(channelId: string | undefined) {
    const client = useClient();

    // Fixed stops — indices are stable (0–5 always map to the same step)
    const [fixed, setFixed] = useState<WizardStep[]>(makeFixedSteps);
    // Processing steps are ephemeral (live only) — one in-progress slot + completed history
    const [processingSteps, setProcessing] = useState<WizardStep[]>([]);

    // Expose as a single array: fixed steps first, then processing (SubwayMap filters processing out)
    const steps = [...fixed, ...processingSteps];

    useEffect(() => {
        if (!channelId || !client) return;
        const channel = client.channels.get(channelId);
        if (!channel) return;

        (async () => {
            const applyHistory = (msgs: any[]) => {
                const userId = (client as any)?.user?._id;

                // Find the last greeting so we only read user replies after the most recent session start
                const lastGreetingIdx = msgs.reduce((found, m, i) =>
                    parseCodeblock(m.content ?? "")?.type === "greeting" ? i : found, -1);

                const userMsgsAfterGreeting = msgs.filter((m: any, i: number) => {
                    if (i <= lastGreetingIdx) return false;
                    const author = m.author_id ?? m.author?._id ?? m.author;
                    return userId ? author === userId : !parseCodeblock(m.content ?? "");
                });

                setFixed(prev => {
                    let next = [...prev.map(s => ({ ...s }))];

                    // Apply all non-processing codeblocks to activate steps
                    for (const msg of msgs) {
                        if (!msg?.content) continue;
                        const parsed = parseCodeblock(msg.content);
                        if (!parsed || parsed.type === "processing" || parsed.type === "checkpoint") continue;
                        next = activateStep(next, parsed.type, parsed.data, msg._id ?? msg.id);
                    }

                    // Mark greeting done if user replied "My name is X" after it
                    const nameMsg = userMsgsAfterGreeting.find((m: any) =>
                        /^my name is /i.test(m.content ?? ""));
                    if (nameMsg) {
                        const name = nameMsg.content.replace(/^my name is /i, "").trim();
                        next = next.map(s => s.id === "greeting"
                            ? { ...s, done: true, needsAction: false, data: { ...s.data, prefill_name: name } }
                            : s);
                    }

                    // Mark upload done if user sent an attachment after greeting
                    if (userMsgsAfterGreeting.some((m: any) => m.attachments?.length > 0)) {
                        next = next.map(s => s.id === "form_book"
                            ? { ...s, done: true, needsAction: false }
                            : s);
                    }

                    return next;
                });
            };

            try {
                // @ts-ignore — revolt.js v7
                const msgs = await (channel as any).fetchMessages({ limit: 100 });
                const raw: any[] = Array.isArray(msgs) ? msgs : (msgs?.messages ?? []);
                applyHistory([...raw].reverse());
            } catch {
                const fallback: any[] = [];
                // @ts-ignore
                channel.messages?.forEach?.((m: any) => fallback.push(m));
                applyHistory(fallback);
            }
        })();
    }, [channelId, client]);

    // Live message handler
    useEffect(() => {
        if (!channelId || !client) return;

        const handler = (msg: any) => {
            const msgChannel = msg.channel_id ?? msg.channelId ?? (msg.channel as any)?._id;
            if (msgChannel !== channelId) return;
            if (!msg.content) return;

            const parsed = parseCodeblock(msg.content);
            if (!parsed) return;

            if (parsed.type === "processing") {
                const step: WizardStep = {
                    id:          msg._id ?? msg.id,
                    type:        "processing",
                    line:        "book",
                    label:       parsed.data?.label ?? "Processing",
                    data:        parsed.data,
                    done:        parsed.data?.done ?? false,
                    needsAction: false,
                    messageId:   msg._id ?? msg.id,
                };
                setProcessing(prev => {
                    if (prev.find(s => s.id === step.id)) return prev;
                    // Keep completed steps; replace in-progress slot
                    return [...prev.filter(s => !(s.type === "processing" && !s.done)), step];
                });
                return;
            }

            // Non-processing: activate the matching fixed step
            const targetId = stepIdForBlock(parsed.type, parsed.data);
            if (!targetId) return;
            setFixed(prev => {
                const target = prev.find(s => s.id === targetId);
                // Skip if already activated by this exact message
                if (target?.messageId === (msg._id ?? msg.id)) return prev;
                return activateStep(prev, parsed.type, parsed.data, msg._id ?? msg.id);
            });
        };

        (client as any).on?.("message", handler);
        return () => (client as any).off?.("message", handler);
    }, [channelId, client]);

    const activateCheckpoint = (stepName: string, data: any) => {
        const targetId = `checkpoint_${stepName}`;
        setFixed(prev => {
            if (!prev.some(s => s.id === targetId)) return prev;
            return prev.map(s => s.id === targetId ? { ...s, data, needsAction: true } : s);
        });
    };

    const markDone = (stepId: string) => {
        setFixed(prev => prev.map(s => s.id === stepId ? { ...s, done: true, needsAction: false } : s));
    };

    const patchStepData = (stepId: string, patch: any) => {
        setFixed(prev => prev.map(s => s.id === stepId ? { ...s, data: { ...s.data, ...patch } } : s));
    };

    const clearSteps = () => {
        setFixed(makeFixedSteps());
        setProcessing([]);
    };

    return { steps, markDone, patchStepData, clearSteps, activateCheckpoint };
}
