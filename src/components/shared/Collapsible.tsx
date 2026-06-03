import { useState } from "preact/hooks";
import { ComponentChildren } from "preact";
import styled from "styled-components/macro";
import { ChevronDown } from "lucide-react";

const Header = styled.button`
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 8px;
    padding: 9px 12px;
    cursor: pointer;
    transition: background 0.15s;
    &:hover { background: rgba(255,255,255,0.06); }
`;

const Label = styled.div`
    font-size: 10px;
    font-weight: 700;
    color: #F5A623;
    text-transform: uppercase;
    letter-spacing: 0.12em;
`;

const Body = styled.div<{ $open: boolean }>`
    overflow: hidden;
    max-height: ${p => p.$open ? "200px" : "0"};
    opacity: ${p => p.$open ? 1 : 0};
    transition: max-height 0.25s ease, opacity 0.2s ease;
    border: ${p => p.$open ? "1px solid rgba(255,255,255,0.08)" : "none"};
    border-top: none;
    border-radius: 0 0 8px 8px;
    background: rgba(255,255,255,0.02);
    padding: ${p => p.$open ? "10px 12px" : "0 12px"};
    font-size: 11px;
    color: rgba(255,255,255,0.5);
    line-height: 1.6;
    font-style: italic;
`;

export function Collapsible({ label, children }: { label: string; children: ComponentChildren }) {
    const [open, setOpen] = useState(false);
    return (
        <div>
            <Header onClick={() => setOpen(o => !o)}>
                <Label>{label}</Label>
                <ChevronDown size={13} style={{ color: "#F5A623", transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
            </Header>
            <Body $open={open}>{children}</Body>
        </div>
    );
}
