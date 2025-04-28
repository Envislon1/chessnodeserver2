
import HomePage from "./HomePage";
import { ConnectionStatus } from "@/components/chess/ConnectionStatus";

const Index = () => {
  return (
    <div className="space-y-4">
      <ConnectionStatus />
      <HomePage />
    </div>
  );
};

export default Index;
