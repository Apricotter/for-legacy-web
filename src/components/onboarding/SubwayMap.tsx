import styled from "styled-components/macro";
import { WizardStep } from "./useOnboardingMessages";

const MapWrap = styled.div`
    padding: 16px 22px 10px;
    background: rgba(0, 0, 0, 0.25);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    flex-direction: column;
    gap: 0;
`;

const LineRow = styled.div`
    display: flex;
    align-items: flex-start;
    gap: 0;
    padding-bottom: 24px;
    &:last-child { padding-bottom: 4px; }
`;

const LineLabel = styled.div`
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: rgba(255, 255, 255, 0.35);
    text-transform: uppercase;
    width: 58px;
    flex-shrink: 0;
    padding-top: 6px;
`;

const Track = styled.div`
    display: flex;
    align-items: flex-start;
    flex: 1;
    min-width: 0;
    padding-top: 6px;
`;

const StopCol = styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
`;

const Connector = styled.div<{ $done: boolean; $color: string }>`
    flex: 1;
    height: 2px;
    margin-top: 8px;
    background: ${p => p.$done ? p.$color : "var(--tertiary-background)"};
    transition: background 0.3s;
    min-width: 12px;
`;

const Stop = styled.button<{ $state: "done" | "active" | "pending" | "locked"; $color: string }>`
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: 2px solid ${p =>
        p.$state === "locked" ? "var(--tertiary-background)" : p.$color
    };
    background: ${p =>
        p.$state === "done"   ? p.$color :
        p.$state === "active" ? "var(--secondary-background)" :
        "transparent"
    };
    cursor: ${p => p.$state === "locked" ? "default" : "pointer"};
    flex-shrink: 0;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    outline: none;
    padding: 0;
    &:focus-visible { box-shadow: 0 0 0 2px var(--accent); }
`;

const StopDot = styled.div<{ $color: string }>`
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: ${p => p.$color};
`;

const NeedsYouDot = styled.div`
    position: absolute;
    top: -3px;
    right: -3px;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #f87171;
    border: 1px solid var(--secondary-background);
`;

const StopLabel = styled.div<{ $active: boolean; $color: string }>`
    font-size: 9px;
    font-weight: ${p => p.$active ? "700" : "500"};
    color: ${p => p.$active ? p.$color : "rgba(255,255,255,0.3)"};
    white-space: nowrap;
    text-align: center;
`;

const SubLabel = styled.div`
    font-size: 8px;
    color: rgba(255,255,255,0.2);
    white-space: nowrap;
    text-align: center;
    max-width: 72px;
    overflow: hidden;
    text-overflow: ellipsis;
`;

const TrailingTrack = styled.div<{ $color: string }>`
    flex: 2;
    height: 2px;
    margin-top: 8px;
    background: var(--tertiary-background);
    min-width: 20px;
    opacity: 0.4;
`;

interface SubwayMapProps {
    steps: WizardStep[];
    activeIndex: number;
    onSelectStep: (index: number) => void;
    bookFilename?: string;
    reviewCount?: number;
}

interface LineConfig {
    id: "book" | "author";
    label: string;
    color: string;
}

const LINES: LineConfig[] = [
    { id: "book",   label: "BOOK",   color: "#F5A623" },
    { id: "author", label: "AUTHOR", color: "#60a5fa" },
];

export default function SubwayMap({ steps, activeIndex, onSelectStep, bookFilename, reviewCount }: SubwayMapProps) {
    return (
        <MapWrap>
            {LINES.map(line => {
                const lineSteps = steps
                    .map((s, i) => ({ step: s, globalIndex: i }))
                    .filter(({ step }) =>
                        step.line === line.id &&
                        step.type !== "processing");

                if (lineSteps.length === 0) return null;

                return (
                    <LineRow key={line.id}>
                        <LineLabel>{line.label}</LineLabel>
                        <Track>
                            {lineSteps.map(({ step, globalIndex }, pos) => {
                                const state =
                                    step.done                    ? "done"    :
                                    globalIndex === activeIndex  ? "active"  :
                                    step.needsAction             ? "pending" :
                                    "locked";

                                return (
                                    <>
                                        {pos > 0 && (
                                            <Connector
                                                $done={lineSteps[pos - 1].step.done && step.done}
                                                $color={line.color}
                                            />
                                        )}
                                        <StopCol key={step.id}>
                                            <Stop
                                                $state={state}
                                                $color={line.color}
                                                onClick={() => state !== "locked" && onSelectStep(globalIndex)}
                                                title={step.label}
                                            >
                                                {state === "active" && <StopDot $color={line.color} />}
                                                {step.needsAction && !step.done && <NeedsYouDot />}
                                            </Stop>
                                            <StopLabel $active={globalIndex === activeIndex} $color={line.color}>
                                                {step.label}
                                            </StopLabel>
                                            {line.id === "book" && pos === 0 && bookFilename && (
                                                <SubLabel title={bookFilename}>{bookFilename}</SubLabel>
                                            )}
                                            {line.id === "author" && pos === 0 && (reviewCount ?? 0) > 0 && (
                                                <SubLabel>{reviewCount} review{reviewCount === 1 ? "" : "s"}</SubLabel>
                                            )}
                                        </StopCol>
                                    </>
                                );
                            })}
                            <TrailingTrack $color={line.color} />
                        </Track>
                    </LineRow>
                );
            })}
        </MapWrap>
    );
}
