
import { ChessGame } from '@/components/chess/ChessGame';
import { WalletContainer } from '@/components/wallet/WalletContainer';

const WalletPage = () => {
  return (
    <div className="space-y-8">
      <WalletContainer />
      
      <div className="mt-8">
        <ChessGame />
      </div>
    </div>
  );
};

export default WalletPage;
