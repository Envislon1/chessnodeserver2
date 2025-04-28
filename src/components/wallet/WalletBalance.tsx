
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCcw, Loader2, WalletIcon } from "lucide-react";
import { Wallet } from "@/types";

interface WalletBalanceProps {
  wallet: Wallet | null;
  isRefreshing: boolean;
  onRefresh: () => void;
}

export const WalletBalance = ({ wallet, isRefreshing, onRefresh }: WalletBalanceProps) => {
  return (
    <Card className="border-chess-brown/50 bg-chess-dark/90">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Balance
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onRefresh}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
          </Button>
        </CardTitle>
        <CardDescription>Your current balance and transaction options</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="text-2xl font-bold">
            {`${wallet?.balance?.toFixed(2) || 0} coins`}
            {isRefreshing && <span className="ml-2 text-sm text-gray-400">(refreshing...)</span>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
