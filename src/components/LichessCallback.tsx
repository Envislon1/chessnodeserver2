
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Info } from 'lucide-react';

export const LichessCallback = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    // In production, this would handle the OAuth code exchange
    // For now, we're in demo mode so we just show the demo notice
    const timer = setTimeout(() => {
      navigate('/matches');
    }, 3000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="container mx-auto p-8">
      <Alert className="bg-chess-brown/20 border-chess-brown">
        <Info className="h-4 w-4 text-chess-accent" />
        <AlertTitle>Demo Mode Active</AlertTitle>
        <AlertDescription>
          <p className="mb-2">
            In a production environment, this page would handle the Lichess OAuth callback.
            You would exchange the authorization code for an access token here.
          </p>
          <p>
            Currently running in demo mode. Redirecting you back to matches...
          </p>
        </AlertDescription>
      </Alert>
    </div>
  );
};

export default LichessCallback;
