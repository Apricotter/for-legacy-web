import { useEffect } from "preact/hooks";
import { useClient } from "../../controllers/client/ClientController";

export type WizardStepType = "greeting" | "form" | "checkpoint" | "processing" | "milestone";

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
const FIXED_STEP_DEFS: Omit<WizardStep, "data" | "done" | "needsAction">[] = [
    { id: "greeting",                    type: "greeting",   line: "author", label: "Welcome"    },
    { id: "form_book",                   type: "form",       line: "book",   label: "Upload"     },
    { id: "checkpoint_character_review", type: "checkpoint", line: "book",   label: "Characters" },
    { id: "milestone_portraits",         type: "milestone",  line: "book",   label: "Portraits"  },
    { id: "milestone_scenes",            type: "milestone",  line: "book",   label: "Scenes"     },
    { id: "form_author",                 type: "form",       line: "author", label: "Reviews"    },
    { id: "form_voice",                  type: "form",       line: "author", label: "Voice"      },
];

export function makeFixedSteps(): WizardStep[] {
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

function stepIdForBlock(type: string, data: any): string | null {
    if (type === "greeting") return "greeting";
    if (type === "form") {
        const isUpload = data?.fields?.some((f: any) => f.type === "upload" || f.key === "book_file");
        return isUpload ? "form_book" : "form_author";
    }
    if (type === "checkpoint" && data?.step) return `checkpoint_${data.step}`;
    return null;
}

// Accepted action subset — avoids a circular import with OnboardingWizard
export type MessageParserAction =
    | { type: "STEP_ACTIVATED";  stepId: string; data: any; messageId?: string }
    | { type: "STEP_DONE";       stepId: string }
    | { type: "PROCESSING_STEP"; step: WizardStep };

// Pure message-parser hook. Reads channel history + live messages and dispatches
// to the parent reducer. Owns no state of its own.
export function useMessageParser(
    channelId: string | undefined,
    dispatch: (action: MessageParserAction) => void,
) {
    const client = useClient();

    // Channel history — activate steps from past messages
    useEffect(() => {
        if (!channelId || !client) return;
        const channel = (client as any).channels?.get(channelId);
        if (!channel) return;

        (async () => {
            const applyHistory = (msgs: any[]) => {
                const userId = (client as any)?.user?._id;

                const lastGreetingIdx = msgs.reduce((found, m, i) =>
                    parseCodeblock(m.content ?? "")?.type === "greeting" ? i : found, -1);

                const userMsgsAfterGreeting = msgs.filter((m: any, i: number) => {
                    if (i <= lastGreetingIdx) return false;
                    const author = m.author_id ?? m.author?._id ?? m.author;
                    return userId ? author === userId : !parseCodeblock(m.content ?? "");
                });

                // Activate steps from non-processing codeblocks
                for (const msg of msgs) {
                    if (!msg?.content) continue;
                    const parsed = parseCodeblock(msg.content);
                    if (!parsed || parsed.type === "processing") continue;
                    const stepId = stepIdForBlock(parsed.type, parsed.data);
                    if (stepId) {
                        dispatch({ type: "STEP_ACTIVATED", stepId, data: parsed.data, messageId: msg._id ?? msg.id });
                    }
                }

                // Mark greeting done if user replied "My name is X"
                if (userMsgsAfterGreeting.some((m: any) => /^my name is /i.test(m.content ?? ""))) {
                    dispatch({ type: "STEP_DONE", stepId: "greeting" });
                }

                // Mark upload done if user sent an attachment after greeting
                if (userMsgsAfterGreeting.some((m: any) => m.attachments?.length > 0)) {
                    dispatch({ type: "STEP_DONE", stepId: "form_book" });
                }
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
                dispatch({ type: "PROCESSING_STEP", step });
                return;
            }

            const stepId = stepIdForBlock(parsed.type, parsed.data);
            if (stepId) {
                dispatch({ type: "STEP_ACTIVATED", stepId, data: parsed.data, messageId: msg._id ?? msg.id });
            }
        };

        (client as any).on?.("message", handler);
        return () => (client as any).off?.("message", handler);
    }, [channelId, client]);
}
