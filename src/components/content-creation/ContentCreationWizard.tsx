import { useState, useReducer, useEffect, useRef } from "preact/hooks";
import styled from "styled-components/macro";
import { UserCircle, Play, ChevronDown, ArrowLeft } from "lucide-react";
import { EditAlt } from "@styled-icons/boxicons-regular";
import { ProgressBar } from "../shared/ProgressBar";
import { PrimaryCTA } from "../shared/PrimaryCTA";
import { WizardModal, WizardHeader, WizardTitle, WizardCloseBtn, WizardContent, WizardDomeBtn } from "../shared/WizardModal";
import { InputField } from "../shared/InputField";
import { Card } from "../shared/Card";
import { ChatBubble } from "../shared/ChatBubble";
import { AccentLabel } from "../shared/AccentLabel";
import { Collapsible } from "../shared/Collapsible";

// ── types ─────────────────────────────────────────────────────────────────────

type Stage = "character_select" | "character_profile_review" | "scene_quote" | "voice_review" | "content_studio";

type Character = {
    name: string;
    role: string;
    description?: string;
    entityType?: string;
    portraitUrl?: string;
    appearance?: { introduction?: string; imagePrompt?: string };
};

type CCState = {
    stage:             Stage;
    selectedCharacter: Character | null;
    selectedQuote:     Quote | null;
    devChars:          Character[] | null;
};

type CCAction =
    | { type: "CHARACTER_SELECTED";  character: Character }
    | { type: "QUOTE_SELECTED";      quote: Quote }
    | { type: "NAVIGATE_TO";         stage: Stage }
    | { type: "DEV_JUMP";            stage: Stage };

type Quote = {
    id: string;
    text: string;
    scene: string;
    chapter?: string;
};

const DEV_MOCK_CHARS: Character[] = [
    {
        name: "Doc",
        role: "Main",
        description: "Late 20s, short brown hair, sardonic guarded expression. Reluctant operative navigating a world he never chose.",
        appearance: {
            introduction: "A man who looks like he slept in his clothes — on purpose.",
            imagePrompt: "late 20s male, short brown hair, sardonic expression, worn jacket, cinematic noir lighting",
        },
    },
    {
        name: "Renard",
        role: "Main",
        description: "Older, calculating, cold eyes, immaculate dress. Operates entirely without sentiment.",
        appearance: {
            introduction: "The kind of man whose smile never reaches his eyes.",
            imagePrompt: "50s male, silver hair, cold calculating expression, expensive suit, dramatic side lighting",
        },
    },
    {
        name: "Marie",
        role: "Supporting",
        description: "Sharp, perceptive, trusted contact. Always three steps ahead.",
        appearance: {
            introduction: "She notices everything. She says very little.",
            imagePrompt: "30s female, dark hair, perceptive sharp eyes, casual but alert, urban background",
        },
    },
    {
        name: "Leclerc",
        role: "Supporting",
        description: "Mid-50s, weathered, weary. Has seen too much to be surprised by anything.",
        appearance: {
            introduction: "A man carrying the weight of decisions he made decades ago.",
            imagePrompt: "mid 50s male, weathered face, tired eyes, rumpled coat, dim office lighting",
        },
    },
    {
        name: "Isabelle",
        role: "Supporting",
        description: "Early 30s, composed, dual loyalties pulling in opposite directions.",
        appearance: {
            introduction: "Perfectly composed. Impossible to read.",
            imagePrompt: "early 30s female, composed expression, neutral professional attire, ambiguous lighting",
        },
    },
    {
        name: "Viktor",
        role: "Supporting",
        description: "Stocky, patient, operates with a dangerous calm that unsettles everyone around him.",
        appearance: {
            introduction: "He doesn't need to raise his voice. He never does.",
            imagePrompt: "40s male, stocky build, patient dangerous expression, heavy coat, cold environment",
        },
    },
];

const STAGES: Stage[] = ["character_select", "character_profile_review", "scene_quote", "voice_review", "content_studio"];

const STAGE_LABELS: Record<Stage, string> = {
    character_select:         "Character",
    character_profile_review: "Profile",
    scene_quote:              "Scene & Quote",
    voice_review:             "Voice",
    content_studio:           "Studio",
};

const PROGRESS_STEPS = STAGES.map(s => ({ id: s, label: STAGE_LABELS[s] }));

const DEV_MOCK_QUOTES: Quote[] = [
    {
        id: "q1",
        text: "I stopped trusting people the day I realized the ones who smile the most have the most to hide.",
        scene: "The Café on Rue Leclerc",
        chapter: "Chapter 4",
    },
    {
        id: "q2",
        text: "You don't walk away from this kind of work. You just find new reasons to stay.",
        scene: "Safe House, Montmartre",
        chapter: "Chapter 7",
    },
    {
        id: "q3",
        text: "Every door in this city opens — the question is what's waiting on the other side.",
        scene: "The Bridge at Dawn",
        chapter: "Chapter 11",
    },
    {
        id: "q4",
        text: "He handed me the file like it was nothing. It was everything.",
        scene: "Ministry Corridor, Third Floor",
        chapter: "Chapter 14",
    },
];

const initialState: CCState = {
    stage:             "character_select",
    selectedCharacter: null,
    selectedQuote:     null,
    devChars:          null,
};

function ccReducer(state: CCState, action: CCAction): CCState {
    switch (action.type) {
        case "CHARACTER_SELECTED":
            return { ...state, selectedCharacter: action.character, stage: "character_profile_review" };
        case "QUOTE_SELECTED":
            return { ...state, selectedQuote: action.quote, stage: "voice_review" };
        case "NAVIGATE_TO":
            return { ...state, stage: action.stage };
        case "DEV_JUMP":
            return {
                ...initialState,
                stage:             action.stage,
                devChars:          DEV_MOCK_CHARS,
                selectedCharacter: ["character_profile_review", "scene_quote", "voice_review", "content_studio"].includes(action.stage) ? DEV_MOCK_CHARS[0] : null,
            };
        default:
            return state;
    }
}

// ── styled components ─────────────────────────────────────────────────────────


// ── character select ──────────────────────────────────────────────────────────

const StepTitle = styled.div`
    font-size: 20px;
    font-weight: 800;
    color: rgba(255,255,255,0.95);
    margin-bottom: 6px;
    letter-spacing: -0.02em;
`;

const StepDirective = styled.div`
    font-size: 13px;
    color: rgba(255,255,255,0.5);
    line-height: 1.55;
    margin-bottom: 18px;
`;

const CharGrid = styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
    gap: 16px;
`;

const CharCard = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 7px;
    cursor: pointer;
    transition: transform 0.15s;
    &:hover { transform: translateY(-3px); }
`;

const CharImgWrap = styled.div`
    position: relative;
    width: 72px;
    height: 90px;
`;

const CharImg = styled.img`
    width: 72px;
    height: 90px;
    border-radius: 6px;
    object-fit: cover;
    border: 2px solid rgba(255,255,255,0.1);
    transition: border-color 0.15s;
    ${CharCard}:hover & { border-color: #F5A623; }
`;

const CharImgPlaceholder = styled.div`
    width: 72px;
    height: 90px;
    border-radius: 6px;
    background: rgba(255,255,255,0.06);
    border: 2px solid rgba(255,255,255,0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 26px;
    color: rgba(255,255,255,0.2);
    transition: border-color 0.15s;
    ${CharCard}:hover & { border-color: #F5A623; }
`;

const CharImgOverlay = styled.div`
    position: absolute;
    inset: 0;
    border-radius: 6px;
    background: rgba(245,166,35,0.25);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    color: #F5A623;
    font-weight: 700;
    opacity: 0;
    transition: opacity 0.15s;
    ${CharCard}:hover & { opacity: 1; }
`;

const CharName = styled.div`
    font-size: 11px;
    font-weight: 700;
    color: rgba(255,255,255,0.85);
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 88px;
`;

const CharRole = styled.div`
    font-size: 9px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: rgba(255,255,255,0.3);
    text-align: center;
`;

function CharacterSelectStep({
    portraitsUrl,
    devChars,
    onSelect,
}: {
    portraitsUrl?: string;
    devChars?: Character[];
    onSelect: (c: Character) => void;
}) {
    const [chars, setChars] = useState<Character[]>(devChars ?? []);
    const [loading, setLoading] = useState(!devChars && !!portraitsUrl);

    useEffect(() => {
        if (devChars?.length) { setChars(devChars); setLoading(false); }
    }, [devChars]);

    useEffect(() => {
        if (devChars || !portraitsUrl) return;
        fetch(portraitsUrl)
            .then(r => r.ok ? r.json() : null)
            .catch(() => null)
            .then(data => {
                setChars(data?.characters ?? (Array.isArray(data) ? data : []));
                setLoading(false);
            });
    }, [portraitsUrl]);

    if (loading) return <StepDirective>Loading characters…</StepDirective>;
    if (!chars.length) return <StepDirective>No characters found.</StepDirective>;

    return (
        <div>
            <StepTitle>Choose Your Character</StepTitle>
            <StepDirective>
                Select a character below — we'll use them to create your first post.
            </StepDirective>
            <CharGrid>
                {chars.map((c, i) => (
                    <CharCard key={i} onClick={() => onSelect(c)}>
                        <CharImgWrap>
                            {c.portraitUrl
                                ? <CharImg src={c.portraitUrl} alt={c.name} loading="lazy" />
                                : <CharImgPlaceholder>👤</CharImgPlaceholder>}
                            <CharImgOverlay>✓</CharImgOverlay>
                        </CharImgWrap>
                        <CharName>{c.name}</CharName>
                        <CharRole>{c.role}</CharRole>
                    </CharCard>
                ))}
            </CharGrid>
        </div>
    );
}

// ── character profile review ──────────────────────────────────────────────────


const ProfilePortrait = styled.img`
    width: 140px;
    height: 175px;
    border-radius: 8px;
    object-fit: cover;
    object-position: top;
    flex-shrink: 0;
    border: 2px solid rgba(245,166,35,0.4);
`;

const ProfilePortraitPlaceholder = styled.div`
    width: 140px;
    height: 175px;
    border-radius: 8px;
    background: rgba(255,255,255,0.06);
    border: 2px solid rgba(255,255,255,0.12);
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(255,255,255,0.2);
    flex-shrink: 0;
`;

const ProfileRow = styled.div`
    display: flex;
    gap: 16px;
    align-items: stretch;
`;

const ProfileDetails = styled.div`
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
    justify-content: space-between;
`;

const FieldLabel = styled.div`
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: rgba(255,255,255,0.3);
    margin-bottom: 2px;
`;

const FieldText = styled.div`
    font-size: 12px;
    color: rgba(255,255,255,0.8);
    line-height: 1.5;
`;




function CharacterProfileReviewStep({
    character,
    onContinue,
}: {
    character: Character;
    onContinue: () => void;
}) {
    return (
        <div>
            <StepTitle>Character Profile</StepTitle>
            <StepDirective>Review your character's details before continuing.</StepDirective>

            <ProfileRow>
                {character.portraitUrl
                    ? <ProfilePortrait src={character.portraitUrl} alt={character.name} />
                    : <ProfilePortraitPlaceholder><UserCircle size={40} /></ProfilePortraitPlaceholder>}
                <ProfileDetails>
                    <Card style={{ position: "relative", marginBottom: 12 }}>
                        <button style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 5px", borderRadius: 5, position: "absolute", top: 8, right: 8 }}>
                            <EditAlt size={13} style={{ color: "#F5A623" }} />
                        </button>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            <div>
                                <FieldLabel>Name</FieldLabel>
                                <FieldText>{character.name}</FieldText>
                            </div>
                            <div>
                                <FieldLabel>Role</FieldLabel>
                                <FieldText>{character.role}</FieldText>
                            </div>
                            {character.description && (
                                <div>
                                    <FieldLabel>Description</FieldLabel>
                                    <FieldText>{character.description}</FieldText>
                                </div>
                            )}
                            {character.appearance?.imagePrompt && (
                                <div>
                                    <FieldLabel>Image Prompt</FieldLabel>
                                    <FieldText style={{ fontStyle: "italic", opacity: 0.7 }}>{character.appearance.imagePrompt}</FieldText>
                                </div>
                            )}
                        </div>
                    </Card>
                </ProfileDetails>
            </ProfileRow>

            <PrimaryCTA onClick={onContinue} style={{ marginTop: 4 }}>Continue</PrimaryCTA>
        </div>
    );
}

// ── scene & quote step ────────────────────────────────────────────────────────

const QuoteGrid = styled.div`
    display: flex;
    flex-direction: column;
    gap: 7px;
`;

const QuoteCard = styled.div`
    position: relative;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 8px;
    padding: 9px 12px;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
    &:hover {
        border-color: rgba(245,166,35,0.5);
        background: rgba(245,166,35,0.05);
    }
`;


const QuoteText = styled.div`
    font-size: 12px;
    color: rgba(255,255,255,0.85);
    line-height: 1.45;
    font-style: italic;
    margin-bottom: 3px;
`;

const QuoteChapter = styled.div`
    font-size: 9px;
    color: rgba(255,255,255,0.25);
`;

function SceneQuoteStep({ onSelect }: { onSelect: (q: Quote) => void }) {
    return (
        <div>
            <StepTitle style={{ marginBottom: 4 }}>Select Quote</StepTitle>
            <StepDirective style={{ marginBottom: 12 }}>
                Select a quote and scene below to confirm for your first post.
            </StepDirective>
            <QuoteGrid>
                {DEV_MOCK_QUOTES.map(q => (
                    <QuoteCard key={q.id} onClick={() => onSelect(q)}>
                        <AccentLabel>{q.scene}</AccentLabel>
                        <QuoteText>"{q.text}"</QuoteText>
                        {q.chapter && <QuoteChapter>{q.chapter}</QuoteChapter>}
                    </QuoteCard>
                ))}
            </QuoteGrid>
        </div>
    );
}

// ── voice review step ─────────────────────────────────────────────────────────

const VoiceShell = styled.div`
    display: flex;
    flex-direction: column;
    gap: 12px;
`;

const VoiceClipTabs = styled.div`
    display: flex;
    gap: 6px;
`;

const VoiceClipTab = styled.button<{ $active: boolean }>`
    flex: 1;
    padding: 5px 0;
    border-radius: 6px;
    border: 1px solid ${p => p.$active ? "rgba(245,166,35,0.6)" : "rgba(255,255,255,0.1)"};
    background: ${p => p.$active ? "rgba(245,166,35,0.12)" : "rgba(255,255,255,0.03)"};
    color: ${p => p.$active ? "#F5A623" : "rgba(255,255,255,0.35)"};
    font-size: 10px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.15s;
`;


const VoiceCharName = styled.div`
    font-size: 15px;
    font-weight: 800;
    color: rgba(255,255,255,0.92);
    letter-spacing: -0.01em;
`;

const WaveformWrap = styled.div<{ $playing: boolean }>`
    width: 100%;
    height: 52px;
    background: rgba(0,0,0,0.3);
    border: 1px solid rgba(245,166,35,0.15);
    border-radius: 6px;
    overflow: hidden;
    position: relative;

    svg {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        overflow: visible;
    }

    .wave {
        animation: ${p => p.$playing ? "waveScroll 1.2s linear infinite" : "none"};
        transform-origin: center;
    }

    @keyframes waveScroll {
        from { transform: translateX(0); }
        to   { transform: translateX(-20px); }
    }
`;

const WaveformGrid = styled.div`
    position: absolute;
    inset: 0;
    background-image:
        linear-gradient(rgba(245,166,35,0.06) 1px, transparent 1px),
        linear-gradient(90deg, rgba(245,166,35,0.06) 1px, transparent 1px);
    background-size: 20px 13px;
`;

function Waveform({ playing, progress }: { playing: boolean; progress: number }) {
    const W = 600;
    const H = 52;
    const mid = H / 2;
    const amp = playing ? 16 : 5;
    const points = Array.from({ length: 120 }, (_, i) => {
        const x = (i / 119) * (W + 40) - 20;
        const y = mid + Math.sin(i * 0.32) * amp * Math.sin(i * 0.07 + 1) +
                  Math.sin(i * 0.18 + 2) * amp * 0.5;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");

    const scanX = (progress / 100) * W;

    return (
        <WaveformWrap $playing={playing}>
            <WaveformGrid />
            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
                <defs>
                    <filter id="glow">
                        <feGaussianBlur stdDeviation="1.5" result="blur" />
                        <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                </defs>
                <polyline
                    className="wave"
                    points={points}
                    fill="none"
                    stroke="rgba(245,166,35,0.3)"
                    strokeWidth="1"
                />
                <polyline
                    className="wave"
                    points={points}
                    fill="none"
                    stroke="#F5A623"
                    strokeWidth="1.5"
                    filter="url(#glow)"
                    strokeDasharray={`${scanX} 9999`}
                />
                {playing && (
                    <line
                        x1={scanX} y1={0} x2={scanX} y2={H}
                        stroke="rgba(245,166,35,0.6)"
                        strokeWidth="1"
                    />
                )}
            </svg>
        </WaveformWrap>
    );
}

const PlayRow = styled.div`
    display: flex;
    align-items: center;
    gap: 10px;
`;

const VoicePlayBtn = styled.button<{ $playing: boolean }>`
    width: 34px;
    height: 34px;
    border-radius: 50%;
    background: ${p => p.$playing ? "rgba(245,166,35,0.25)" : "rgba(245,166,35,0.12)"};
    border: 1px solid rgba(245,166,35,0.45);
    color: #F5A623;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
    transition: background 0.15s;
    &:hover { background: rgba(245,166,35,0.28); }
`;

const Timeline = styled.div`
    flex: 1;
    height: 4px;
    background: rgba(255,255,255,0.08);
    border-radius: 4px;
    position: relative;
    cursor: pointer;
`;

const TimelineFill = styled.div<{ $pct: number }>`
    height: 100%;
    width: ${p => p.$pct}%;
    background: #F5A623;
    border-radius: 4px;
    transition: width 0.1s linear;
`;

const TimelineThumb = styled.div<{ $pct: number }>`
    position: absolute;
    top: 50%;
    left: ${p => p.$pct}%;
    transform: translate(-50%, -50%);
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #F5A623;
    box-shadow: 0 0 6px rgba(245,166,35,0.6);
`;

const TimeCode = styled.div`
    font-size: 9px;
    color: rgba(255,255,255,0.25);
    font-variant-numeric: tabular-nums;
    flex-shrink: 0;
`;

const ArtChatArea = styled.div`
    display: flex;
    flex-direction: column;
    gap: 8px;
`;

const ArtBubble = styled.div`
    align-self: flex-start;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 10px 10px 10px 2px;
    padding: 8px 12px;
    font-size: 12px;
    color: rgba(255,255,255,0.75);
    line-height: 1.45;
    max-width: 90%;
`;


const ArtInputRow = styled.div`
    display: flex;
    gap: 8px;
    align-items: center;
`;


const ArtSendBtn = styled.button`
    background: rgba(245,166,35,0.15);
    border: 1px solid rgba(245,166,35,0.4);
    border-radius: 8px;
    color: #F5A623;
    font-size: 11px;
    font-weight: 700;
    padding: 7px 14px;
    cursor: pointer;
    transition: background 0.15s;
    white-space: nowrap;
    &:hover { background: rgba(245,166,35,0.25); }
`;


const ArtToast = styled.div<{ $visible: boolean }>`
    position: absolute;
    bottom: 70px;
    left: 50%;
    transform: translateX(-50%) translateY(${p => p.$visible ? "0" : "8px"});
    background: rgba(14,8,2,0.95);
    border: 1px solid rgba(245,166,35,0.5);
    border-radius: 10px;
    padding: 8px 16px;
    font-size: 12px;
    color: rgba(255,255,255,0.85);
    white-space: nowrap;
    opacity: ${p => p.$visible ? 1 : 0};
    pointer-events: none;
    transition: opacity 0.25s, transform 0.25s;
    box-shadow: 0 8px 24px rgba(0,0,0,0.5);
    z-index: 10;
`;


const CLIP_LABELS = ["Take 1 — Neutral", "Take 2 — Warmer", "Take 3 — Intense", "Take 4 — Intimate"];

const ART_RESPONSES: Record<string, string> = {
    default:  "Got it — I'll adjust that and regenerate.",
    young:    "Makes sense. I'll age the timbre up a bit and reduce the brightness. How's this?",
    slow:     "Sure, I'll pull back the pace slightly. How's this?",
    flat:     "I'll add more emotional range to the delivery. How's this?",
    old:      "I'll bring the voice down in age a touch. How's this?",
};

function artResponse(msg: string): string {
    const m = msg.toLowerCase();
    if (m.includes("young")) return ART_RESPONSES.young;
    if (m.includes("slow"))  return ART_RESPONSES.slow;
    if (m.includes("flat"))  return ART_RESPONSES.flat;
    if (m.includes("old"))   return ART_RESPONSES.old;
    return ART_RESPONSES.default;
}

function VoiceReviewStep({ character, quote, onContinue }: { character: Character; quote: Quote | null; onContinue: () => void }) {
    const [clipIdx,   setClipIdx]   = useState(0);
    const [playing,   setPlaying]   = useState(false);

    const [progress,  setProgress]  = useState(0);
    const [input,     setInput]     = useState("");
    const [artMsg,    setArtMsg]    = useState("Hey! How's this voice sample? Would you like to change anything?");
    const [toast,     setToast]     = useState("");
    const [toastVis,  setToastVis]  = useState(false);
    const intervalRef = useRef<any>(null);

    useEffect(() => {
        setPlaying(false);
        setProgress(0);
        clearInterval(intervalRef.current);
    }, [clipIdx]);

    useEffect(() => {
        if (playing) {
            intervalRef.current = setInterval(() => {
                setProgress(p => {
                    if (p >= 100) { setPlaying(false); clearInterval(intervalRef.current); return 0; }
                    return p + 0.8;
                });
            }, 50);
        } else {
            clearInterval(intervalRef.current);
        }
        return () => clearInterval(intervalRef.current);
    }, [playing]);

    function sendToArt() {
        if (!input.trim()) return;
        const reply = artResponse(input);
        setArtMsg(reply);
        setInput("");
        setToast("Art is regenerating…");
        setToastVis(true);
        setTimeout(() => {
            setToast("How's this?");
            setProgress(0);
            setPlaying(true);
        }, 1800);
        setTimeout(() => setToastVis(false), 4000);
    }

    const totalSec = 12;
    const elapsed = Math.floor((progress / 100) * totalSec);
    const fmt = (s: number) => `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`;

    return (
        <VoiceShell style={{ position: "relative" }}>
            <ArtToast $visible={toastVis}>{toast}</ArtToast>

            <Card style={{ borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                <VoiceCharName>{character.name}</VoiceCharName>
                {quote && (
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontStyle: "italic", lineHeight: 1.45 }}>
                        "{quote.text}"
                    </div>
                )}

                <Waveform playing={playing} progress={progress} />

                <PlayRow>
                    <VoicePlayBtn $playing={playing} onClick={() => setPlaying(p => !p)}>
                        {playing
                            ? <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>▐▐</span>
                            : <Play size={13} fill="#F5A623" />}
                    </VoicePlayBtn>
                    <Timeline>
                        <TimelineFill $pct={progress} />
                        <TimelineThumb $pct={progress} />
                    </Timeline>
                    <TimeCode>{fmt(elapsed)} / {fmt(totalSec)}</TimeCode>
                </PlayRow>

                <ArtChatArea>
                    <ArtBubble>
                        <AccentLabel>Art</AccentLabel>
                        {artMsg}
                    </ArtBubble>
                    <ArtInputRow>
                        <InputField $compact style={{ flex: 1 }}
                            value={input}
                            onInput={(e: any) => setInput(e.target.value)}
                            placeholder="Tell Art what to adjust…"
                            onKeyDown={(e: any) => e.key === "Enter" && sendToArt()}
                        />
                        <ArtSendBtn onClick={sendToArt}>Send</ArtSendBtn>
                    </ArtInputRow>
                </ArtChatArea>
            </Card>

            <Collapsible label="Voice Prompt">
                Speak in a low, measured cadence. The character is guarded — never rushed. Slight roughness in the mid-register. Avoid brightness or warmth in the upper range. Sardonic undertone without being theatrical.
            </Collapsible>

            <PrimaryCTA onClick={onContinue} style={{ marginTop: 4 }}>Confirm Voice</PrimaryCTA>
        </VoiceShell>
    );
}

// ── content studio step ───────────────────────────────────────────────────────

const StudioShell = styled.div`
    display: flex;
    flex-direction: column;
    gap: 8px;
    position: relative;
`;


const SlideEditBtn = styled.button`
    position: absolute;
    top: 8px;
    right: 8px;
    background: rgba(14,8,2,0.6);
    border: none;
    border-radius: 5px;
    padding: 3px 5px;
    cursor: pointer;
    z-index: 2;
    backdrop-filter: blur(4px);
    &:hover { background: rgba(14,8,2,0.85); }
`;

const StudioMainRow = styled.div`
    display: flex;
    gap: 12px;
    align-items: stretch;
`;

const VideoCol = styled.div`
    aspect-ratio: 9/16;
    height: 100%;
    background: rgba(0,0,0,0.5);
    border-radius: 10px;
    border: 1px solid rgba(255,255,255,0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
    flex-shrink: 0;
`;

const RightCol = styled.div`
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
`;

const StudioPreview = styled.div`
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 10px;
    overflow: hidden;
    flex: 1;
`;

const VideoBigPlay = styled.div`
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: rgba(245,166,35,0.2);
    border: 2px solid rgba(245,166,35,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #F5A623;
    cursor: pointer;
    transition: background 0.15s;
    &:hover { background: rgba(245,166,35,0.35); }
`;

const StudioCaption = styled.div`
    padding: 16px 18px;
    font-size: 12px;
    color: rgba(255,255,255,0.75);
    line-height: 1.6;
    width: 100%;
    align-self: flex-start;
`;



function ContentStudioStep({
    character,
    quote,
    onEditVideo,
    onEditCaption,
}: {
    character: Character;
    quote: Quote | null;
    onEditVideo: () => void;
    onEditCaption: () => void;
}) {
    const mockCaption = quote
        ? `"${quote.text}"`
        : `A moment from ${character.name}'s story.`;

    const mockHashtags = `#${character.name.replace(/\s/g,"")} #BookTok #CharacterAI #Storytime #Fiction`;

    return (
        <StudioShell>
            <StudioMainRow>
                <VideoCol style={{ height: "320px", width: "180px" }}>
                    <SlideEditBtn onClick={onEditVideo}>
                        <EditAlt size={13} style={{ color: "#F5A623" }} />
                    </SlideEditBtn>
                    <VideoBigPlay><Play size={20} fill="#F5A623" /></VideoBigPlay>
                    <div style={{ position: "absolute", bottom: 10, left: 0, right: 0, textAlign: "center", fontSize: 9, color: "rgba(255,255,255,0.3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                        {character.name}
                    </div>
                </VideoCol>
                <RightCol>
                    <StudioPreview style={{ flex: 1, position: "relative" }}>
                        <SlideEditBtn onClick={onEditCaption}>
                            <EditAlt size={13} style={{ color: "#F5A623" }} />
                        </SlideEditBtn>
                        <StudioCaption>
                            <div style={{ whiteSpace: "pre-line", marginBottom: 10 }}>{mockCaption}</div>
                            <div style={{ fontSize: 11, color: "rgba(245,166,35,0.6)", lineHeight: 1.7 }}>{mockHashtags}</div>
                        </StudioCaption>
                    </StudioPreview>
                </RightCol>
            </StudioMainRow>
            <PrimaryCTA style={{ width: "100%", flexShrink: 0 }}>Approve</PrimaryCTA>
        </StudioShell>
    );
}

// ── page slide (whole-modal Art chat) ─────────────────────────────────────────

const PageTrack = styled.div<{ $open: boolean }>`
    display: flex;
    width: 200%;
    height: 100%;
    transition: transform 0.32s cubic-bezier(0.4, 0, 0.2, 1);
    transform: translateX(${p => p.$open ? "-50%" : "0"});
`;

const PagePane = styled.div`
    width: 50%;
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    flex-shrink: 0;
`;

const ArtPanelShell = styled.div`
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 16px 22px 18px;
    gap: 8px;
    position: relative;
`;

const ArtPanelHeader = styled.div`
    display: flex;
    align-items: center;
    gap: 10px;
    padding-bottom: 12px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
`;

const BackBtn = styled.button`
    background: none;
    border: none;
    color: rgba(255,255,255,0.45);
    cursor: pointer;
    padding: 2px;
    display: flex;
    align-items: center;
    flex-shrink: 0;
    transition: color 0.15s;
    &:hover { color: #F5A623; }
`;

function ArtChatPanel({
    target,
    character,
    quote,
    onClose,
}: {
    target: "video" | "caption";
    character: Character;
    quote: Quote | null;
    onClose: () => void;
}) {
    const label    = target === "video" ? "Video" : "Post";
    const initMsg  = target === "video"
        ? "Want to change anything about the video?"
        : "Want to tweak the post content?";

    const [toast,    setToast]    = useState(initMsg);
    const [toastVis, setToastVis] = useState(true);
    const [input,    setInput]    = useState("");

    const mockCaption  = quote ? `"${quote.text}"` : `A moment from ${character.name}'s story.`;
    const mockHashtags = `#${character.name.replace(/\s/g,"")} #BookTok #CharacterAI #Storytime #Fiction`;

    // Auto-dismiss the greeting toast
    useEffect(() => {
        const t = setTimeout(() => setToastVis(false), 4000);
        return () => clearTimeout(t);
    }, []);

    function send() {
        if (!input.trim()) return;
        setInput("");
        setToast("Art is working on it…");
        setToastVis(true);
        setTimeout(() => setToast("Done! How does this look?"), 1800);
        setTimeout(() => setToastVis(false), 4200);
    }

    return (
        <ArtPanelShell>
            <ArtToast $visible={toastVis}>{toast}</ArtToast>

            <ArtPanelHeader>
                <BackBtn onClick={onClose}><ArrowLeft size={16} /></BackBtn>
                <WizardTitle>Art — {label}</WizardTitle>
            </ArtPanelHeader>

            {/* Preview fills all space between header and input */}
            {target === "video" ? (
                <div style={{ flex: 1, display: "flex", gap: 12, minHeight: 0 }}>
                    {/* Left: video */}
                    <VideoCol style={{ height: "100%", width: "auto", flexShrink: 0 }}>
                        <VideoBigPlay>
                            <Play size={20} fill="#F5A623" />
                        </VideoBigPlay>
                    </VideoCol>
                    {/* Right: type + prompt */}
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
                        <div>
                            <FieldLabel style={{ marginBottom: 5 }}>Video Type</FieldLabel>
                            <select style={{
                                width: "100%",
                                background: "rgba(255,255,255,0.05)",
                                border: "1px solid rgba(255,255,255,0.1)",
                                borderRadius: 8,
                                color: "rgba(255,255,255,0.75)",
                                fontSize: 12,
                                padding: "8px 10px",
                                outline: "none",
                                cursor: "pointer",
                                fontFamily: "inherit",
                                appearance: "none",
                            }}>
                                <option value="">Select type…</option>
                                <option value="cinematic">Cinematic</option>
                                <option value="portrait">Character Portrait</option>
                                <option value="scene">Scene Recreation</option>
                                <option value="quote">Quote Animation</option>
                                <option value="mood">Mood Reel</option>
                            </select>
                        </div>
                        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                            <FieldLabel style={{ marginBottom: 5 }}>Video Prompt</FieldLabel>
                            <textarea
                                style={{
                                    flex: 1,
                                    background: "rgba(255,255,255,0.05)",
                                    border: "1px solid rgba(255,255,255,0.1)",
                                    borderRadius: 8,
                                    color: "rgba(255,255,255,0.85)",
                                    fontSize: 12,
                                    padding: "10px 12px",
                                    outline: "none",
                                    fontFamily: "inherit",
                                    resize: "none",
                                    lineHeight: 1.55,
                                    boxSizing: "border-box",
                                    minHeight: 0,
                                }}
                                placeholder="Describe the mood, setting, or visual style for this video…"
                            />
                        </div>
                    </div>
                </div>
            ) : (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 0 }}>
                    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "16px 18px", textAlign: "center", width: "100%" }}>
                        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", lineHeight: 1.6, whiteSpace: "pre-line", marginBottom: 10, fontStyle: "italic" }}>{mockCaption}</div>
                        <div style={{ fontSize: 10, color: "rgba(245,166,35,0.6)", lineHeight: 1.7 }}>{mockHashtags}</div>
                    </div>
                </div>
            )}

            <ArtInputRow>
                <InputField $compact
                    value={input}
                    onInput={(e: any) => setInput(e.target.value)}
                    placeholder="Tell Art what to change…"
                    onKeyDown={(e: any) => e.key === "Enter" && send()}
                />
                <ArtSendBtn onClick={send}>Send</ArtSendBtn>
            </ArtInputRow>
        </ArtPanelShell>
    );
}

// ── placeholder steps ─────────────────────────────────────────────────────────

const PlaceholderWrap = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 0;
    gap: 10px;
    color: rgba(255,255,255,0.25);
    font-size: 13px;
`;

function PlaceholderStep({ label }: { label: string }) {
    return (
        <PlaceholderWrap>
            <div style={{ fontSize: 32 }}>🚧</div>
            <div>{label} — coming soon</div>
        </PlaceholderWrap>
    );
}

// ── dome nav buttons ──────────────────────────────────────────────────────────


// ── main component ────────────────────────────────────────────────────────────

export default function ContentCreationWizard({
    serverId,
    onClose,
    portraitsUrl,
}: {
    serverId: string;
    onClose: () => void;
    portraitsUrl?: string;
}) {
    const [state, dispatch] = useReducer(ccReducer, initialState);
    const { stage, selectedCharacter, selectedQuote, devChars } = state;
    const [artPanel, setArtPanel] = useState<null | "video" | "caption">(null);

    // Dev: ?dev_stage= URL param
    useEffect(() => {
        const param = new URLSearchParams(window.location.search).get("dev_stage") as Stage | null;
        if (param && (STAGES as string[]).includes(param)) {
            dispatch({ type: "DEV_JUMP", stage: param });
        }
    }, []);

    useEffect(() => { setArtPanel(null); }, [stage]);

    const stageIdx = STAGES.indexOf(stage);
    const canPrev = stageIdx > 0;

    function prev() {
        if (stage === "voice_review") {
            dispatch({ type: "NAVIGATE_TO", stage: "character_profile_review" });
        } else if (stageIdx > 0) {
            dispatch({ type: "NAVIGATE_TO", stage: STAGES[stageIdx - 1] });
        }
    }

    function renderContent() {
        switch (stage) {
            case "character_select":
                return (
                    <CharacterSelectStep
                        portraitsUrl={portraitsUrl}
                        devChars={devChars ?? undefined}
                        onSelect={c => dispatch({ type: "CHARACTER_SELECTED", character: c })}
                    />
                );
            case "character_profile_review":
                if (!selectedCharacter) return <PlaceholderStep label="No character selected" />;
                return (
                    <CharacterProfileReviewStep
                        character={selectedCharacter}
                        onContinue={() => dispatch({ type: "NAVIGATE_TO", stage: "scene_quote" })}
                    />
                );
            case "scene_quote":
                return <SceneQuoteStep onSelect={q => dispatch({ type: "QUOTE_SELECTED", quote: q })} />;
            case "voice_review":
                if (!selectedCharacter) return <PlaceholderStep label="No character selected" />;
                return (
                    <VoiceReviewStep
                        character={selectedCharacter}
                        quote={selectedQuote}
                        onContinue={() => dispatch({ type: "NAVIGATE_TO", stage: "content_studio" })}
                    />
                );
            case "content_studio":
                return (
                    <ContentStudioStep
                        character={selectedCharacter ?? DEV_MOCK_CHARS[0]}
                        quote={selectedQuote}
                        onEditVideo={() => setArtPanel("video")}
                        onEditCaption={() => setArtPanel("caption")}
                    />
                );
        }
    }

    return (
        <WizardModal
            backgroundImage="/assets/web/bg-art-studio.png"
            dimOpacity={0.48}
            fixedHeight
            leftNav={canPrev && !artPanel && (
                <WizardDomeBtn $side="left" onClick={prev}>‹</WizardDomeBtn>
            )}
        >
            <PageTrack $open={artPanel !== null}>
                <PagePane>
                    <WizardHeader>
                        <WizardTitle>Content Creation Wizard</WizardTitle>
                        <WizardCloseBtn onClick={onClose}>×</WizardCloseBtn>
                    </WizardHeader>
                    <ProgressBar steps={PROGRESS_STEPS} activeId={stage} />
                    <WizardContent>{renderContent()}</WizardContent>
                </PagePane>
                <PagePane>
                    {artPanel && (
                        <ArtChatPanel
                            key={artPanel}
                            target={artPanel}
                            character={selectedCharacter ?? DEV_MOCK_CHARS[0]}
                            quote={selectedQuote}
                            onClose={() => setArtPanel(null)}
                        />
                    )}
                </PagePane>
            </PageTrack>
        </WizardModal>
    );
}
