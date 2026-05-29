import styled from "styled-components/macro";

export const ChatBubble = styled.div<{ $role: "user" | "assistant" }>`
    max-width: 92%;
    align-self: ${p => p.$role === "user" ? "flex-end" : "flex-start"};
    background: ${p => p.$role === "user" ? "rgba(245,166,35,0.13)" : "rgba(255,255,255,0.05)"};
    border: 1px solid ${p => p.$role === "user" ? "rgba(245,166,35,0.28)" : "rgba(255,255,255,0.09)"};
    border-radius: ${p => p.$role === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px"};
    padding: 8px 12px;
    font-size: 13px;
    color: rgba(255,255,255,0.78);
    line-height: 1.5;
`;
