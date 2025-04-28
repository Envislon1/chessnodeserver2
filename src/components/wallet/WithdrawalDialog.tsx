
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormEvent, useState, useEffect } from 'react';
import { Loader2 } from "lucide-react";

interface WithdrawalDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  amount: string;
  bankCode: string;
  setBankCode: (value: string) => void;
  accountNumber: string;
  setAccountNumber: (value: string) => void;
  accountName: string;
  isVerifying: boolean;
  verifyAccount: () => void;
  handleWithdrawal: (e: FormEvent) => void;
  banks: any[];
  isProcessing?: boolean;
  error?: string;
  setAmount: (value: string) => void;
  walletBalance?: number;
  nairaRate?: number;
}

export const WithdrawalDialog = ({
  isOpen,
  onOpenChange,
  amount,
  bankCode,
  setBankCode,
  accountNumber,
  setAccountNumber,
  accountName,
  isVerifying,
  verifyAccount,
  handleWithdrawal,
  banks,
  isProcessing = false,
  error,
  setAmount,
  walletBalance = 0,
  nairaRate = 1000,
}: WithdrawalDialogProps) => {
  const [isInsufficientBalance, setIsInsufficientBalance] = useState(false);
  
  // Check for insufficient balance whenever amount changes
  useEffect(() => {
    const withdrawalAmount = Number(amount);
    const maxWithdrawalAmount = (walletBalance || 0) * nairaRate;
    
    setIsInsufficientBalance(
      withdrawalAmount <= 0 || 
      withdrawalAmount > maxWithdrawalAmount
    );
  }, [amount, walletBalance, nairaRate]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="bg-chess-dark border-chess-brown text-white">
        <DialogHeader>
          <DialogTitle>Withdrawal</DialogTitle>
          <DialogDescription>
            Enter your bank account details to withdraw ₦{Number(amount).toLocaleString() || '0'}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleWithdrawal} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Bank</label>
            <Select value={bankCode} onValueChange={setBankCode}>
              <SelectTrigger>
                <SelectValue placeholder="Select a bank" />
              </SelectTrigger>
              <SelectContent>
                {banks?.map((bank) => (
                  <SelectItem key={bank.code} value={bank.code}>
                    {bank.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Account Number</label>
            <Input
              type="text"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder="Enter 10-digit account number"
              maxLength={10}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <Button 
              type="button" 
              variant="outline" 
              onClick={verifyAccount}
              disabled={isVerifying || !bankCode || !accountNumber}
            >
              {isVerifying ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : 'Verify Account'}
            </Button>
            
            {accountName && (
              <div className="text-green-400 text-sm font-medium">
                {accountName}
              </div>
            )}
          </div>
          
          {error && (
            <div className="text-red-400 text-sm">
              {error}
            </div>
          )}
          
          {isInsufficientBalance && !error && (
            <div className="text-red-400 text-sm">
              Insufficient balance for this withdrawal amount
            </div>
          )}
          
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button 
              type="submit"
              disabled={!accountName || !bankCode || !accountNumber || isProcessing || isInsufficientBalance}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : 'Withdraw'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
