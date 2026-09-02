import FlagBoard from "@/components/FlagBoard";
import InstallPrompt from "@/components/InstallPrompt";

export default function Home() {
  return (
    <div className="shell">
      <FlagBoard />
      <InstallPrompt />
    </div>
  );
}
