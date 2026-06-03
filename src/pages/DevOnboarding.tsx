import { useEffect } from "preact/hooks";
import OnboardingWizard from "../components/onboarding/OnboardingWizard";

export default function DevOnboarding() {
    // Ensure ?dev_mode=1 is always in the URL so the wizard loads mock data
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (!params.has("dev_mode")) {
            params.set("dev_mode", "1");
            window.history.replaceState(null, "", `?${params}`);
        }
    }, []);

    return (
        <OnboardingWizard
            serverId=""
            channelId=""
            onClose={() => {}}
        />
    );
}
