
import { SignInForm } from "@/components/SignInForm";

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-black to-gray-900 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-orange-500">Technautic</h1>
          <p className="text-gray-400">Advanced Inverter Monitoring System</p>
        </div>
        <SignInForm />
      </div>
    </div>
  );
};

export default Index;
