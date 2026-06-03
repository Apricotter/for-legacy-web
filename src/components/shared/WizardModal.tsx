import { ComponentChildren } from "preact";
import { createPortal } from "preact/compat";
import styled from "styled-components/macro";

const Overlay = styled.div<{ $bg: string; $dim: number; $flipBg?: boolean; $align?: "center" | "right" }>`
    position: fixed;
    inset: 0;
    z-index: 200;
    display: flex;
    align-items: center;
    justify-content: ${p => p.$align === "right" ? "flex-end" : "center"};
    ${p => p.$align === "right" ? "padding-right: 48px;" : ""}

    @media (max-width: 768px) {
        justify-content: center;
        padding-right: 0;
        align-items: flex-end;
    }

    &::before {
        content: "";
        position: absolute;
        inset: 0;
        background: ${p => `url("${p.$bg}")`} center / cover no-repeat;
        ${p => p.$flipBg ? "transform: scaleX(-1);" : ""}
        z-index: 0;
    }
    &::after {
        content: "";
        position: absolute;
        inset: 0;
        background: rgba(8, 5, 1, ${p => p.$dim});
        z-index: 1;
    }
`;

const ModalWrapper = styled.div`
    position: relative;
    z-index: 2;
    display: flex;
    align-items: center;
`;

const Shell = styled.div<{ $fixedHeight?: boolean; $maxWidth?: string }>`
    position: relative;
    z-index: 2;
    background: rgba(14, 8, 2, 0.88);
    border: 1px solid rgba(255, 255, 255, 0.09);
    border-top: 1px solid rgba(244, 185, 120, 0.35);
    backdrop-filter: blur(32px);
    -webkit-backdrop-filter: blur(32px);
    border-radius: 20px;
    width: min(${p => p.$maxWidth ?? "600px"}, calc(100vw - 32px));
    ${p => p.$fixedHeight
        ? "height: min(540px, calc(100vh - 64px));"
        : "max-height: calc(100vh - 64px);"}
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 32px 80px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(0,0,0,0.4);

    @media (max-width: 768px) {
        width: 100vw;
        max-height: 92vh;
        border-radius: 20px 20px 0 0;
        border-bottom: none;
    }
`;

export const WizardHeader = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 22px 0;
`;

export const WizardTitle = styled.div`
    font-size: 10px;
    font-weight: 700;
    color: #F5A623;
    text-transform: uppercase;
    letter-spacing: 0.14em;
`;

export const WizardCloseBtn = styled.button`
    background: none;
    border: none;
    color: rgba(255,255,255,0.4);
    font-size: 20px;
    cursor: pointer;
    padding: 0 4px;
    line-height: 1;
    transition: color 0.15s;
    &:hover { color: rgba(255,255,255,0.9); }
`;

export const WizardContent = styled.div`
    flex: 1;
    overflow-y: auto;
    padding: 22px 26px 26px;
    min-height: 180px;
    color: rgba(255,255,255,0.92);

    p, h1, h2, h3, h4 {
        color: rgba(255,255,255,0.92);
    }
`;

export const WizardDomeBtn = styled.button<{ $side: "left" | "right" }>`
    position: absolute;
    ${p => p.$side === "left" ? "right: 100%;" : "left: 100%;"}
    top: 50%;
    transform: translateY(-50%);
    width: 44px;
    height: 80px;
    background: rgba(245, 166, 35, 0.15);
    border: 1px solid rgba(245, 166, 35, 0.45);
    ${p => p.$side === "left"
        ? "border-radius: 40px 0 0 40px; border-right: none;"
        : "border-radius: 0 40px 40px 0; border-left: none;"}
    color: #F5A623;
    font-size: 16px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s, color 0.15s, box-shadow 0.15s;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    padding: 0;
    box-shadow: 0 0 16px rgba(245, 166, 35, 0.22);
    &:hover {
        background: rgba(245, 166, 35, 0.28);
        color: #fff;
        box-shadow: 0 4px 22px rgba(245, 166, 35, 0.5);
    }
`;

export function WizardModal({
    backgroundImage,
    dimOpacity = 0.6,
    flipBackground = false,
    fixedHeight = false,
    maxWidth,
    align = "center",
    leftNav,
    children,
}: {
    backgroundImage: string;
    dimOpacity?: number;
    flipBackground?: boolean;
    fixedHeight?: boolean;
    maxWidth?: string;
    align?: "center" | "right";
    leftNav?: ComponentChildren;
    children: ComponentChildren;
}) {
    return createPortal(
        <Overlay $bg={backgroundImage} $dim={dimOpacity} $flipBg={flipBackground} $align={align}>
            <ModalWrapper>
                {leftNav}
                <Shell $fixedHeight={fixedHeight} $maxWidth={maxWidth}>
                    {children}
                </Shell>
            </ModalWrapper>
        </Overlay>,
        document.body,
    );
}
